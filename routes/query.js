const express = require('express');
const router = express.Router();
const { retrieveChunks, buildContext } = require('../rag/retrieve');
const { generateAnswer } = require('../rag/generate');

/**
 * POST /query
 *
 * Body:  { "query": "What did we discuss about Milvus?" }
 * Reply: { "answer": "...", "sources": [{ "document_id": 1, "text": "...", "score": 0.91 }] }
 */
router.post('/', async (req, res) => {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim() === '') {
        return res.status(400).json({ error: 'Field "query" is required and must be a non-empty string.' });
    }

    try {
        // Step 1 — Retrieve relevant chunks
        const chunks = await retrieveChunks(query.trim());

        if (chunks.length === 0) {
            return res.json({
                answer: 'Not found in documents.',
                sources: [],
            });
        }

        // Step 2 — Build context
        const context = buildContext(chunks);

        // Step 3 — Generate answer
        const answer = await generateAnswer(query.trim(), context);

        // Step 4 — Return response
        return res.json({
            answer,
            sources: chunks.map((c) => ({
                document_id: c.document_id,
                text: c.text,
                score: c.score,
            })),
        });
    } catch (err) {
        console.error('[/query] Error:', err.message);
        return res.status(500).json({ error: 'Internal server error.', details: err.message });
    }
});

module.exports = router;
