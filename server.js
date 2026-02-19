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

// ─── Rule-Based extraction logic ─────────────────────────────────────────────
function processQuery(userInput) {
    let semanticQuery = userInput.toLowerCase();
    const filters = [];

    const rules = [
        { kw: 'high calorie', sql: 'calories > 500' },
        { kw: 'low calorie', sql: 'calories < 300' },
        { kw: 'quick', sql: 'prep_time < 15' },
        { kw: 'snack', sql: "category @> ARRAY['snack']" },
        { kw: 'breakfast', sql: "category @> ARRAY['breakfast']" },
        { kw: 'dinner', sql: "category @> ARRAY['dinner']" }
    ];

    rules.forEach(rule => {
        if (semanticQuery.includes(rule.kw)) {
            filters.push(rule.sql);
            semanticQuery = semanticQuery.replace(rule.kw, '').trim();
        }
    });

    return { semanticQuery, filters };
}

// ─── Hybrid Search Endpoint ─────────────────────────────────────────────────
app.post('/search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'Query is required' });

        // 1. Extract Rules vs Semantic Intent
        const { semanticQuery, filters } = processQuery(query);
        const searchText = semanticQuery || query;
        console.log(`[Hybrid Search] semantic="${searchText}", filters=[${filters.join(', ')}]`);

        // 2. Step 1: Semantic Search in Zilliz
        if (!extractor) return res.status(503).json({ error: 'Model not initialized' });

        const output = await extractor(searchText, { pooling: 'mean', normalize: true });
        const vector = Array.from(output.data);

        const milvusRes = await milvus.search({
            collection_name: collectionName,
            vector: vector,
            limit: 20, // Get a wider range from Zilliz, filter later in SQL
            params: { nprobe: 10 }
        });

        const vectorIds = milvusRes.results.map(r => r.id);

        if (vectorIds.length === 0) {
            return res.json({
                results: [],
                queryInfo: { semantic: searchText, filters }
            });
        }

        // 3. Step 2: Structured SQL Join/Filter in Supabase
        // We fetch the relevant IDs and apply the rigid filters (Calories, Category, etc.)
        let sql = 'SELECT * FROM recipes WHERE id = ANY($1)';
        if (filters.length > 0) {
            sql += ' AND ' + filters.join(' AND ');
        }

        const pgRes = await pool.query(sql, [vectorIds]);

        // Re-sort results based on the original Zilliz relevance order
        const sortedResults = pgRes.rows.sort((a, b) => {
            return vectorIds.indexOf(a.id) - vectorIds.indexOf(b.id);
        });

        res.json({
            results: sortedResults,
            queryInfo: {
                semantic: searchText,
                filters,
                engine: 'Zilliz Cloud + Supabase'
            }
        });

    } catch (err) {
        console.error('[Search Error]', err);
        res.status(500).json({ error: 'Hybrid search failed', detail: err.message });
    }
});

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
