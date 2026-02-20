# Personal Knowledge Assistant (RAG System)

A backend-only RAG (Retrieval-Augmented Generation) system built with:

- **Node.js / Express** — API server  
- **Supabase (PostgreSQL)** — document metadata storage  
- **Zilliz Cloud (Milvus)** — vector search  
- **@xenova/transformers** — local embeddings (`Xenova/all-MiniLM-L6-v2`, dim=384)  
- **OpenAI gpt-3.5-turbo** — answer generation (optional; falls back to a placeholder)

---

## Project Structure

```
/db
  supabase.js        Supabase client
  migration.sql      CREATE TABLE statement (run in Supabase SQL Editor)
/vector
  zilliz.js          Zilliz Cloud / Milvus client + collection management
/embeddings
  embed.js           embedText(text) → number[384]
/rag
  retrieve.js        retrieveChunks(query) + buildContext()
  generate.js        generateAnswer(query, context)
/routes
  query.js           POST /query route handler
server.js            Express entry point
ingest.js            One-shot ingestion script
```

---

## Setup

### 1. Environment variables

Copy `.env` and fill in your values:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon or service-role key>

ZILLIZ_ENDPOINT=https://<cluster>.cloud.zilliz.com
ZILLIZ_API_KEY=<api-key>

OPENAI_API_KEY=           # optional; leave blank to use placeholder fallback
PORT=3000
```

### 2. Create the Supabase table

Run `db/migration.sql` in the [Supabase SQL Editor](https://supabase.com/dashboard):

```sql
CREATE TABLE IF NOT EXISTS documents (
  id      SERIAL PRIMARY KEY,
  title   TEXT NOT NULL,
  date    DATE,
  topic   TEXT,
  tags    TEXT[],
  content TEXT NOT NULL
);
```

### 3. Install dependencies

```bash
npm install
```

### 4. Ingest sample documents

```bash
npm run ingest
```

This will:
1. Ensure the Zilliz `document_chunks` collection exists  
2. Insert 3 sample MOM documents into Supabase  
3. Split each document into chunks, embed them, and upload to Zilliz  

### 5. Start the server

```bash
npm start
```

---

## API

### `POST /query`

**Request**
```json
{ "query": "What did we discuss about Milvus?" }
```

**Response**
```json
{
  "answer": "The team selected Milvus via Zilliz Cloud as the primary vector store...",
  "sources": [
    { "document_id": 1, "text": "...", "score": 0.91 },
    { "document_id": 2, "text": "...", "score": 0.78 }
  ]
}
```

### `GET /health`

Returns `{ "status": "ok" }`.

---

## How It Works

```
User query
    │
    ▼
embedText(query)          ← local model, no API call
    │
    ▼
Zilliz ANN search         ← top-5 chunks by COSINE similarity
    │
    ▼
buildContext(chunks)      ← concatenate, cap at ~1500 tokens
    │
    ▼
generateAnswer(query, ctx) ← OpenAI gpt-3.5-turbo (or placeholder)
    │
    ▼
{ answer, sources }
```

---

## Constraints / Non-Goals

- No LangChain
- No authentication
- No chat history / streaming
- No multi-agent systems
