const { pipeline } = require('@xenova/transformers');

async function downloadModel() {
    console.log('Starting model download/load for "Xenova/all-MiniLM-L6-v2"...');
    try {
        // This will automatically download the model from Hugging Face if not already cached
        const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

        console.log('\nSuccess! Model downloaded and loaded.');

        // Test it with a simple sentence
        const output = await extractor('Hello world!', { pooling: 'mean', normalize: true });
        console.log('Test vector generated. Dimensions:', output.data.length);

    } catch (error) {
        console.error('Error downloading model:', error);
    }
}

downloadModel();
