const { embedText } = require('../embeddings/embed');
const { searchChunks } = require('../vector/zilliz');

/**
 * Retrieves the top-k most relevant chunks for a user query.
 *
 * @param {string} query  The natural-language question from the user.
 * @param {number} topK   Number of chunks to retrieve (default: 5).
 * @returns {Promise<{ document_id: number, text: string, score: number }[]>}
 */
async function retrieveChunks(query, topK = 5) {
    const queryEmbedding = await embedText(query);
    const results = await searchChunks(queryEmbedding, topK);
    return results;
}

/**
 * Builds a context string from retrieved chunks, capped at ~1500 tokens
 * (approximated as 6000 characters, since ~1 token ≈ 4 chars).
 *
 * @param {{ text: string }[]} chunks
 * @returns {string}
 */
function buildContext(chunks) {
    const MAX_CHARS = 6000; // ~1500 tokens
    let context = '';
    for (const chunk of chunks) {
        const candidate = context ? context + '\n\n' + chunk.text : chunk.text;
        if (candidate.length > MAX_CHARS) break;
        context = candidate;
    }
    return context;
}

module.exports = { retrieveChunks, buildContext };
