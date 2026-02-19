const express = require('express');
const { Pool } = require('pg');
const { MilvusClient } = require('@zilliz/milvus2-sdk-node');
const { pipeline } = require('@xenova/transformers');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const port = process.env.PORT || 3000;

// ─── Supabase Connection ─────────────────────────────────────────────────────
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// ─── Zilliz Cloud Connection ─────────────────────────────────────────────────
const milvus = new MilvusClient({
    address: process.env.ZILLIZ_ENDPOINT,
    token: process.env.ZILLIZ_TOKEN
});
const collectionName = 'recipe_vectors';

// ─── Embedding Model ────────────────────────────────────────────────────────
let extractor;
async function initModel() {
    try {
        console.log('⏳ Loading embedding model...');
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('✅ Model loaded.');
    } catch (e) {
        console.error("❌ Failed to load model", e);
    }
}
initModel();

// ─── Hybrid Intent Extraction ─────────────────────────────────────────────────
// Each rule maps one or more natural-language keyword patterns to a SQL filter.
// Matched keywords are stripped from the semantic query so Zilliz only receives
// the *pure descriptive intent* — not filter words that confuse the vector search.
const INTENT_RULES = [
    // ── Calorie / quantity intent ──
    { patterns: ['high calorie', 'high-calorie', 'high cal'], sql: 'calories > 500', strip: true },
    { patterns: ['low calorie', 'low-calorie', 'low cal'], sql: 'calories < 300', strip: true },
    { patterns: ['filling', 'hearty', 'substantial', 'heavy'], sql: 'calories > 400', strip: true },
    {
        patterns: ['light', 'low quantity', 'small portion', 'small',
            'not too much', 'not a lot'], sql: 'calories < 350', strip: true
    },

    // ── Prep-time intent ──
    {
        patterns: ['quick', 'fast', 'rapid', 'instant', 'speedy',
            '5 min', '10 min', 'under 15'], sql: 'prep_time < 15', strip: true
    },
    { patterns: ['slow', 'slow cook', 'long cook'], sql: 'prep_time > 30', strip: true },

    // ── Category intent ──
    { patterns: ['snack', 'snacks'], sql: "category @> ARRAY['snack']", strip: true },
    { patterns: ['breakfast'], sql: "category @> ARRAY['breakfast']", strip: true },
    { patterns: ['dinner'], sql: "category @> ARRAY['dinner']", strip: true },
    { patterns: ['italian'], sql: "category @> ARRAY['italian']", strip: true },
    { patterns: ['indian'], sql: "category @> ARRAY['indian']", strip: true },
    { patterns: ['comfort food', 'comfort'], sql: "category @> ARRAY['comfort']", strip: true },
    { patterns: ['japanese'], sql: "category @> ARRAY['japanese']", strip: true },
    { patterns: ['asian'], sql: "category @> ARRAY['asian']", strip: true },
    { patterns: ['salad'], sql: "category @> ARRAY['salad']", strip: true },
];

// Conflict resolution: only cancel if EXPLICIT opposites both appear.
// "filling" (>400) vs "low quantity" (<350) is NOT a true conflict —
// "filling" is a qualitative/semantic intent (handled by Milvus), while
// "low quantity" is a hard portioning filter (handled by Postgres).
// We only cancel when the user says something truly contradictory like
// "high calorie low calorie" (explicit keyword vs explicit keyword).
function resolveConflicts(filters) {
    // Explicit high-calorie keyword + explicit low-calorie keyword → cancel both
    const hasExplicitHigh = filters.includes('calories > 500'); // from 'high calorie'
    const hasExplicitLow = filters.includes('calories < 300'); // from 'low calorie'

    // Qualitative hints (from 'filling', 'hearty', 'light', 'small portion', etc.)
    const hasHeavy = filters.includes('calories > 400');
    const hasLight = filters.includes('calories < 350');

    let result = [...filters];

    // True contradiction: user said both "high calorie" AND "low calorie" explicitly
    if (hasExplicitHigh && hasExplicitLow) {
        result = result.filter(f => f !== 'calories > 500' && f !== 'calories < 300');
    }

    // Qualitative hint contradiction: 'filling' (>400) and 'light'/'small' (<350) both matched.
    // In this case keep the EXPLICIT quantity filter (<350) and drop the qualitative one (>400),
    // because Milvus will handle the "filling" semantic intent separately.
    if (hasHeavy && hasLight && !hasExplicitHigh) {
        result = result.filter(f => f !== 'calories > 400');
    }

    // Redundant: both >500 and >400 → keep only stricter
    if (result.includes('calories > 500') && result.includes('calories > 400')) {
        result = result.filter(f => f !== 'calories > 400');
    }
    // Redundant: both <300 and <350 → keep only stricter
    if (result.includes('calories < 300') && result.includes('calories < 350')) {
        result = result.filter(f => f !== 'calories < 350');
    }

    return result;
}

function processQuery(userInput) {
    let semanticQuery = userInput.toLowerCase();
    const filters = [];
    const matchedKeywords = [];

    for (const rule of INTENT_RULES) {
        for (const pattern of rule.patterns) {
            if (semanticQuery.includes(pattern)) {
                if (!filters.includes(rule.sql)) {
                    filters.push(rule.sql);
                }
                matchedKeywords.push(pattern);
                if (rule.strip) {
                    // Use a word-boundary-aware replace so 'light' doesn't eat 'lightning'
                    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    semanticQuery = semanticQuery.replace(new RegExp(`\\b${escaped}\\b`, 'g'), '').trim();
                }
                break; // Only match first pattern per rule to avoid double-counting
            }
        }
    }

    // ── Stopword / filler scrub ─────────────────────────────────────────────
    // After intent keywords are removed, strip residual connector/generic words
    // so Milvus gets only meaningful descriptive terms (not "but recipes").
    const STOPWORDS = [
        'but', 'and', 'or', 'for', 'with', 'that', 'are', 'is', 'the', 'a',
        'an', 'of', 'to', 'in', 'on', 'at', 'some', 'me', 'please', 'give',
        'show', 'want', 'need', 'find', 'get', 'recipe', 'recipes', 'dish',
        'dishes', 'food', 'foods', 'meal', 'meals', 'something', 'ideas'
    ];
    const stopRe = new RegExp(`\\b(${STOPWORDS.join('|')})\\b`, 'gi');
    semanticQuery = semanticQuery.replace(stopRe, ' ').replace(/\s{2,}/g, ' ').trim();

    // If nothing meaningful remains after all stripping, use the original query
    // (minus just the obvious generic words) so Milvus still has something useful.
    if (!semanticQuery || semanticQuery.length < 3) {
        semanticQuery = userInput.toLowerCase().replace(stopRe, ' ').replace(/\s{2,}/g, ' ').trim();
    }

    const resolvedFilters = resolveConflicts(filters);

    return { semanticQuery, filters: resolvedFilters, matchedKeywords };
}

// ─── Hybrid Search Endpoint ─────────────────────────────────────────────────
app.post('/search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'Query is required' });

        // 1. Extract structured SQL filters and the stripped semantic query
        const { semanticQuery, filters, matchedKeywords } = processQuery(query);
        const searchText = semanticQuery || query;

        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`[Hybrid Search] original  : "${query}"`);
        console.log(`[Hybrid Search] → Milvus  : "${searchText}"`);
        console.log(`[Hybrid Search] → Postgres : ${filters.length > 0 ? filters.join(' AND ') : 'None'}`);
        console.log(`[Hybrid Search] matched kw : [${matchedKeywords.join(', ')}]`);

        // 2. Semantic Search in Zilliz Cloud
        if (!extractor) return res.status(503).json({ error: 'Model not initialized' });

        const output = await extractor(searchText, { pooling: 'mean', normalize: true });
        const vector = Array.from(output.data);

        const milvusRes = await milvus.search({
            collection_name: collectionName,
            vector: vector,
            limit: 20,
            output_fields: ['id'],
            params: { nprobe: 10 }
        });

        // ── Score Threshold ──────────────────────────────────────────────────
        // Milvus returns cosine distances (lower = more similar for L2; for IP/cosine, higher = better).
        // all-MiniLM-L6-v2 with cosine: score is in [0,1] — keep only results with score >= 0.25
        // This prevents returning completely unrelated recipes.
        const SCORE_THRESHOLD = 0.25;
        const filteredMilvusResults = milvusRes.results.filter(r => r.score >= SCORE_THRESHOLD);

        console.log(`[Hybrid Search] Milvus hits: ${milvusRes.results.length} total, ${filteredMilvusResults.length} above threshold (≥${SCORE_THRESHOLD})`);

        if (filteredMilvusResults.length === 0) {
            return res.json({
                results: [],
                queryInfo: {
                    semantic: searchText,
                    filters,
                    sqlQuery: buildSqlPreview(filters),
                    engine: 'Zilliz Cloud + Supabase'
                }
            });
        }

        const vectorIds = filteredMilvusResults.map(r => r.id);

        // 3. Structured SQL Filter in Supabase/Postgres
        let sql = 'SELECT * FROM recipes WHERE id = ANY($1)';
        if (filters.length > 0) {
            sql += ' AND ' + filters.join(' AND ');
        }
        sql += ' LIMIT 6'; // Cap final results to avoid returning everything

        const pgRes = await pool.query(sql, [vectorIds]);

        // Re-sort results to match Zilliz relevance order
        const sortedResults = pgRes.rows.sort((a, b) => {
            return vectorIds.indexOf(a.id) - vectorIds.indexOf(b.id);
        });

        console.log(`[Hybrid Search] Final results: ${sortedResults.length}`);

        res.json({
            results: sortedResults,
            queryInfo: {
                semantic: searchText,
                filters,
                sqlQuery: buildSqlPreview(filters),
                engine: 'Zilliz Cloud + Supabase'
            }
        });

    } catch (err) {
        console.error('[Search Error]', err);
        res.status(500).json({ error: 'Hybrid search failed', detail: err.message });
    }
});

// ─── Helper: Build a human-readable SQL filter preview for the UI ────────────
// We only show the structured filter clauses (the interesting part).
// The id = ANY($1) clause from Milvus IDs is implied and not shown.
function buildSqlPreview(filters) {
    if (filters.length === 0) return 'None';
    return filters.join(' AND ');
}

// Test Route
app.get('/test', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM recipes');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Intent-Based Search Server: http://localhost:${port}`);
});
