const { Pool } = require('pg');
const { MilvusClient, DataType } = require('@zilliz/milvus2-sdk-node');
const { pipeline } = require('@xenova/transformers');
require('dotenv').config();

const config = {
    address: process.env.ZILLIZ_ENDPOINT,
    token: process.env.ZILLIZ_TOKEN,
    collectionName: 'recipe_vectors'
};

async function sync() {
    console.log('🚀 Starting Zilliz Sync Process...');

    // 1. Initialize Transformers (Local)
    console.log('⏳ Loading embedding model...');
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    // 2. Supabase Connection
    const pg = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    // 3. Zilliz Cloud Connection
    const milvus = new MilvusClient({
        address: config.address,
        token: config.token
    });

    try {
        // Create Collection in Zilliz
        console.log(`📡 Connecting to Zilliz at ${config.address}...`);
        const hasColl = await milvus.hasCollection({ collection_name: config.collectionName });
        if (hasColl.value) {
            console.log('🗑️  Dropping existing collection...');
            await milvus.dropCollection({ collection_name: config.collectionName });
        }

        await milvus.createCollection({
            collection_name: config.collectionName,
            fields: [
                { name: 'id', data_type: DataType.Int64, is_primary_key: true, auto_id: false },
                { name: 'embedding', data_type: DataType.FloatVector, dim: 384 }
            ]
        });

        console.log('✅ Collection created.');

        // 4. Fetch from Supabase
        const res = await pg.query('SELECT id, description FROM recipes');
        const recipes = res.rows;

        console.log(`📖 Read ${recipes.length} recipes from Supabase.`);

        const insertData = [];

        for (const recipe of recipes) {
            console.log(`  ✨ Vectorizing ID ${recipe.id}...`);
            const output = await extractor(recipe.description, { pooling: 'mean', normalize: true });

            insertData.push({
                id: recipe.id,
                embedding: Array.from(output.data)
            });
        }

        // 5. Insert into Zilliz
        console.log('📤 Uploading vectors to Zilliz Cloud...');
        await milvus.insert({
            collection_name: config.collectionName,
            fields_data: insertData
        });

        console.log('⏳ Creating index...');
        await milvus.createIndex({
            collection_name: config.collectionName,
            field_name: "embedding",
            index_name: "idx_embedding",
            index_type: "AUTOINDEX", // Zilliz Cloud handles indexing automatically with AUTOINDEX
            metric_type: "L2"
        });

        await milvus.loadCollectionSync({ collection_name: config.collectionName });

        console.log('✨ --- Sync Completed Successfully --- ✨');

    } catch (err) {
        console.error('❌ Sync failed:', err);
    } finally {
        await pg.end();
        process.exit();
    }
}

sync();
