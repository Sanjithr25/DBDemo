/**
 * ingest.js — Data Ingestion Script
 *
 * Usage:
 *   node ingest.js
 *
 * Drop your MOM files (.txt or .md) into the /moms folder, then run this.
 * Each file becomes one document in Supabase + Zilliz.
 *
 * ── File naming convention (optional but recommended) ────────────────────────
 *
 *   Frontmatter block at the top of the file (YAML-style):
 *
 *     ---
 *     title: Q1 Planning Meeting
 *     date: 2025-10-01
 *     topic: Product Roadmap
 *     tags: planning, roadmap, q1
 *     ---
 *     <rest of content>
 *
 *   If frontmatter is absent, the script derives values from the filename:
 *     • title  → filename without extension (underscores → spaces, capitalised)
 *     • date   → today's date
 *     • topic  → "General"
 *     • tags   → []
 *
 * ── What it does ──────────────────────────────────────────────────────────────
 *   1. Reads every .txt / .md file from /moms
 *   2. Parses optional frontmatter
 *   3. Stores metadata → Supabase (documents table)
 *   4. Chunks content → embeds with all-MiniLM-L6-v2 → uploads to Zilliz
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const supabase = require('./db/supabase');
const { ensureCollection, insertChunks } = require('./vector/zilliz');
const { embedText } = require('./embeddings/embed');

// ── Config ────────────────────────────────────────────────────────────────────

const MOMS_DIR = path.join(__dirname, 'moms');
const MIN_WORDS = 100;
const MAX_WORDS = 300;

// ── Frontmatter parser ────────────────────────────────────────────────────────

/**
 * Parses an optional YAML-style frontmatter block:
 *   ---
 *   key: value
 *   ---
 *
 * Returns { meta, body } where meta contains the parsed fields and body is the
 * rest of the file content (without the frontmatter block).
 *
 * @param {string} raw   Full file content
 * @param {string} file  Filename (used as fallback for title)
 * @returns {{ meta: { title:string, date:string, topic:string, tags:string[] }, body:string }}
 */
function parseFrontmatter(raw, file) {
    const fenceRe = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = raw.match(fenceRe);

    let body = raw;
    let meta = {};

    if (match) {
        body = match[2];
        // Parse simple "key: value" lines (no nested YAML)
        for (const line of match[1].split('\n')) {
            const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
            if (kv) meta[kv[1].trim()] = kv[2].trim();
        }
    }

    // Derive defaults from filename if a field is missing
    const stem = path.basename(file, path.extname(file));
    const derivedTitle = stem.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const today = new Date().toISOString().slice(0, 10);  // YYYY-MM-DD

    return {
        meta: {
            title: meta.title || derivedTitle,
            date: meta.date || today,
            topic: meta.topic || 'General',
            tags: meta.tags ? meta.tags.split(',').map(t => t.trim()) : [],
        },
        body: body.trim(),
    };
}

// ── Chunking ──────────────────────────────────────────────────────────────────

/**
 * Splits text into sentence-aware chunks of 100–300 words.
 * Never cuts mid-sentence.
 *
 * @param {string} text
 * @returns {string[]}
 */
function chunkText(text) {
    const sentences = text
        .replace(/\r\n/g, '\n')
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean);

    const chunks = [];
    let current = [];
    let wordCount = 0;

    for (const sentence of sentences) {
        const words = sentence.split(/\s+/).length;
        if (wordCount + words > MAX_WORDS && wordCount >= MIN_WORDS) {
            chunks.push(current.join(' '));
            current = [sentence];
            wordCount = words;
        } else {
            current.push(sentence);
            wordCount += words;
        }
    }

    if (current.length > 0) chunks.push(current.join(' '));
    return chunks;
}

// ── Ingestion ─────────────────────────────────────────────────────────────────

/**
 * Ingests a single file: saves metadata to Supabase, embeds chunks, uploads to Zilliz.
 *
 * @param {string} filePath   Absolute path to the MOM file
 */
async function ingestFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const file = path.basename(filePath);

    const { meta, body } = parseFrontmatter(raw, file);

    console.log(`\n[Ingest] "${meta.title}"  (${file})`);
    console.log(`         date=${meta.date}  topic=${meta.topic}  tags=[${meta.tags.join(', ')}]`);

    if (!body) {
        console.warn('  [Skip] File is empty after stripping frontmatter.');
        return;
    }

    // 1. Save metadata to Supabase
    const { data, error } = await supabase
        .from('documents')
        .insert({ title: meta.title, date: meta.date, topic: meta.topic, tags: meta.tags, content: body })
        .select('id')
        .single();

    if (error) {
        console.error(`  [Supabase] Insert failed: ${error.message}`);
        throw error;
    }

    const documentId = data.id;
    console.log(`  [Supabase] Saved → id=${documentId}`);

    // 2. Chunk
    const chunks = chunkText(body);
    console.log(`  [Chunk] ${chunks.length} chunk(s)`);

    // 3. Embed + collect
    const vectorChunks = [];
    for (let i = 0; i < chunks.length; i++) {
        process.stdout.write(`  [Embed] ${i + 1}/${chunks.length}...`);
        const embedding = await embedText(chunks[i]);
        vectorChunks.push({ document_id: documentId, text: chunks[i], embedding });
        process.stdout.write(' ✓\n');
    }

    // 4. Upload to Zilliz
    await insertChunks(vectorChunks);
    console.log(`  [Zilliz] Uploaded ${vectorChunks.length} vector(s) for document id=${documentId}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('=== Personal Knowledge Assistant — Ingestion ===\n');

    // Discover eligible files
    if (!fs.existsSync(MOMS_DIR)) {
        console.error(`[Error] Folder not found: ${MOMS_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(MOMS_DIR)
        .filter(f => /\.(txt|md)$/i.test(f) && !f.startsWith('_') && f !== '.gitkeep')
        .sort();

    if (files.length === 0) {
        console.error('[Error] No .txt or .md files found in /moms');
        console.error('        Drop your MOM files there and re-run: node ingest.js');
        process.exit(1);
    }

    console.log(`Found ${files.length} file(s) in /moms:\n${files.map(f => '  • ' + f).join('\n')}\n`);

    // Ensure Zilliz collection exists
    console.log('[Setup] Ensuring Zilliz collection exists...');
    await ensureCollection();

    // Ingest each file
    let succeeded = 0;
    for (const file of files) {
        try {
            await ingestFile(path.join(MOMS_DIR, file));
            succeeded++;
        } catch (err) {
            console.error(`  [Error] Failed to ingest "${file}": ${err.message}`);
        }
    }

    console.log(`\n=== Done — ${succeeded}/${files.length} file(s) ingested ===`);
    console.log('Start the server and query:  npm start');
}

main().catch(err => {
    console.error('[Fatal]', err.message);
    process.exit(1);
});
