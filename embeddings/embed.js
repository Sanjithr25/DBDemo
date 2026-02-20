let pipeline = null;

/**
 * Lazily loads the Xenova/all-MiniLM-L6-v2 pipeline once and reuses it.
 * @returns {Promise<Function>} The feature-extraction pipeline function.
 */
async function getPipeline() {
    if (!pipeline) {
        // Dynamic import because @xenova/transformers is ESM-only internally
        const { pipeline: createPipeline } = await import('@xenova/transformers');
        pipeline = await createPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('[Embeddings] Model loaded: Xenova/all-MiniLM-L6-v2');
    }
    return pipeline;
}

/**
 * Converts a text string into a 384-dimensional embedding vector.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedText(text) {
    const extractor = await getPipeline();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    // output.data is a Float32Array; convert to plain JS array
    return Array.from(output.data);
}

module.exports = { embedText };
