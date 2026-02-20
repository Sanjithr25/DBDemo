require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function migrate() {
    // Check connection by listing tables
    const { error } = await supabase.from('documents').select('id').limit(1);

    if (error && error.code === '42P01') {
        // Table does not exist — this is expected on first run.
        // We cannot run raw DDL via the JS client directly.
        // Print the SQL for the user to run manually.
        console.log('\n[Migration] The "documents" table does not exist yet.');
        console.log('[Migration] Please run the following SQL in your Supabase SQL Editor:');
        console.log('\n  https://supabase.com/dashboard/project/ixueumvcqhvqozhuleuy/sql/new\n');
        console.log('---');
        console.log(`CREATE TABLE IF NOT EXISTS documents (
  id      SERIAL PRIMARY KEY,
  title   TEXT NOT NULL,
  date    DATE,
  topic   TEXT,
  tags    TEXT[],
  content TEXT NOT NULL
);`);
        console.log('---\n');
        process.exit(1);
    } else if (error) {
        console.error('[Migration] Supabase error:', error.message);
        process.exit(1);
    } else {
        console.log('[Migration] ✓ "documents" table exists and Supabase connection is OK.');
    }
}

migrate();
