const { MilvusClient, DataType } = require('@zilliz/milvus2-sdk-node');
require('dotenv').config();

const COLLECTION_NAME = 'document_chunks';
const VECTOR_DIM = 384;

let clientInstance = null;

/**
 * Returns a singleton MilvusClient connected to Zilliz Cloud.
 */
function getClient() {
    if (!clientInstance) {
        const endpoint = process.env.ZILLIZ_ENDPOINT;
        const token = process.env.ZILLIZ_API_KEY || process.env.ZILLIZ_TOKEN;

        if (!endpoint || !token) {
            throw new Error('Missing ZILLIZ_ENDPOINT or ZILLIZ_API_KEY in environment variables.');
        }

        clientInstance = new MilvusClient({ address: endpoint, token });
    }
    return clientInstance;
}

/**
 * Creates the document_chunks collection if it does not already exist.
 */
async function ensureCollection() {
    const client = getClient();

    const exists = await client.hasCollection({ collection_name: COLLECTION_NAME });
    if (exists.value) {
        console.log(`[Zilliz] Collection "${COLLECTION_NAME}" already exists.`);
        return;
    }

    await client.createCollection({
        collection_name: COLLECTION_NAME,
        fields: [
            {
                name: 'id',
                data_type: DataType.Int64,
                is_primary_key: true,
                autoID: true,
            },
            {
                name: 'document_id',
                data_type: DataType.Int64,
            },
            {
                name: 'text',
                data_type: DataType.VarChar,
                max_length: 4096,
            },
            {
                name: 'embedding',
                data_type: DataType.FloatVector,
                dim: VECTOR_DIM,
            },
        ],
    });

    // Create an IVF_FLAT index on the embedding field for ANN search.
    await client.createIndex({
        collection_name: COLLECTION_NAME,
        field_name: 'embedding',
        index_type: 'IVF_FLAT',
        metric_type: 'COSINE',
        params: { nlist: 128 },
    });

    await client.loadCollection({ collection_name: COLLECTION_NAME });
    console.log(`[Zilliz] Collection "${COLLECTION_NAME}" created and loaded.`);
}

/**
 * Inserts chunks with their embeddings into Zilliz.
 * @param {{ document_id: number, text: string, embedding: number[] }[]} chunks
 */
async function insertChunks(chunks) {
    const client = getClient();
    await client.loadCollection({ collection_name: COLLECTION_NAME });

    const data = chunks.map((c) => ({
        document_id: c.document_id,
        text: c.text,
        embedding: c.embedding,
    }));

    const result = await client.insert({ collection_name: COLLECTION_NAME, data });
    return result;
}

/**
 * Searches for the top-k most similar chunks to a given query embedding.
 * @param {number[]} queryEmbedding
 * @param {number} topK
 * @returns {{ document_id: number, text: string, score: number }[]}
 */
async function searchChunks(queryEmbedding, topK = 5) {
    const client = getClient();
    await client.loadCollection({ collection_name: COLLECTION_NAME });

    const result = await client.search({
        collection_name: COLLECTION_NAME,
        data: [queryEmbedding],
        anns_field: 'embedding',
        params: { nprobe: 10 },
        limit: topK,
        output_fields: ['document_id', 'text'],
        metric_type: 'COSINE',
    });

    const hits = result.results || [];
    return hits.map((hit) => ({
        document_id: hit.document_id,
        text: hit.text,
        score: hit.score,
    }));
}

module.exports = { getClient, ensureCollection, insertChunks, searchChunks, COLLECTION_NAME };
