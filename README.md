# MeeMem — Meeting Memory Assistant 🧠

MeeMem is a professional-grade RAG (Retrieval-Augmented Generation) application designed to serve as a persistent "memory" for meeting minutes (MOMs). It transforms static text files into a searchable, interactive knowledge base with a stunning, responsive interface.

---

## 🏗️ Detailed File Structure

```text
DBDemo/
├── db/                 # Relational Data Layer
│   ├── supabase.js     # Supabase client (PostgreSQL)
│   └── migration.sql   # Database schema for the 'documents' table
├── vector/             # Vector Database Layer
│   └── zilliz.js       # Zilliz Cloud (Milvus) client & collection management
├── embeddings/         # Machine Learning Layer
│   └── embed.js        # Local embedding logic via @xenova/transformers
├── rag/                # Business Logic (RAG Engine)
│   ├── retrieve.js     # Semantic search + logic for assembling context
│   └── generate.js     # Multi-LLM tiered generator (Groq -> Gemini -> OpenAI)
├── public/             # Frontend (SPA)
│   ├── index.html      # Mobile-ready UI with theme toggle & RAG visualizer
│   ├── style.css       # Premium responsive design system (Red-accented)
│   └── script.js       # WebGL-based pipeline animations & API handling
├── moms/               # Data Ingestion Source
│   └── *.txt           # Raw meeting minutes/notes (.txt or .md)
├── server.js           # API Entry Point (Express)
├── ingest.js           # Automated data pipeline (Parse -> Embed -> Upload)
└── .env                # Secrets & API Keys
```

---

## 🛠️ Implementation Deep Dive

### 1. The Ingestion Pipeline (`ingest.js`)
MeeMem processes data in a structured, non-destructive way:
*   **Metadata Extraction**: Parses optional YAML frontmatter for meeting titles, dates, and topics.
*   **Relational Storage**: Stores the full document and metadata in **Supabase** to generate a unique `document_id`.
*   **Smart Chunking**: Splits text into contextually relevant pieces (100–300 words), ensuring no chunk cuts off mid-sentence.
*   **Local Embedding**: Uses `@xenova/transformers` to generate 384-dimensional vectors locally—no API costs or data leakage during embedding.
*   **Vector Persistence**: Uploads embeddings and `document_id` references to **Zilliz Cloud**.

### 2. The Multi-LLM Generative Layer (`rag/generate.js`)
MeeMem uses a tiered fallback strategy to ensure high performance and reliability:
*   **Tier 1 (Groq)**: The primary engine. Leverages LLaMA 3.3 70B for near-instant (sub-500ms) generation.
*   **Tier 2 (Gemini)**: If Groq reaches a rate limit, the system falls back to Gemini 2.0 Flash. It includes a custom **Retry-with-Backoff** mechanism that reads Gemini's `429` error body to wait the exact amount of seconds requested before retrying.
*   **Tier 3 (OpenAI)**: Final emergency fallback.

---

## � Request Flow: Step-by-Step

When a user asks: *"What rules were discussed for email communication?"*

| Stage | Action | Component |
| :--- | :--- | :--- |
| **1. UI Event** | Question is sent via `/query` endpoint. | `public/script.js` |
| **2. Vectorization** | The question is embedded into a 384-length vector. | `embeddings/embed.js` |
| **3. Retrieval** | Zilliz performs a Cosine Similarity search on the top-5 chunks. | `vector/zilliz.js` |
| **4. Context Build** | The system fetches full text from Supabase for those chunks. | `rag/retrieve.js` |
| **5. Prompting** | A prompt is formed using the retrieved facts as ground truth. | `rag/generate.js` |
| **6. Generation** | The LLM generates a response based *only* on the provided context. | `rag/generate.js` |
| **7. Final Render** | UI shows the answer + sources with color-coded quality scores. | `public/script.js` |

---

## �️ UI & Performance Features

### Dynamic Theme Engine
A high-contrast design system allowing users to switch between **OLED Dark Mode** and **Clean Light Mode**.
*   **Mobile Sidebar**: A slide-in drawer with a blurred backdrop for phone-sized browsers.
*   **Safari Optimizer**: Uses `100dvh` and `safe-area-inset-bottom` to prevent URL bars from overlaying input fields on iPhones.

### RAG Visualizer
A 3-stage animated monitor that keeps users informed during the RAG process:
1.  **Embedding**: Converting text to math.
2.  **Vector Search**: Scanning billions of potential matches.
3.  **Generating**: Synthesizing the final human-readable answer.

---

## � Setup & Execution

### 1. Environment Configuration
Create a `.env` with your credentials:
```env
SUPABASE_URL=...
SUPABASE_KEY=...
ZILLIZ_ENDPOINT=...
ZILLIZ_API_KEY=...
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=...
PORT=3000
```

### 2. Database Setup
Run the `db/migration.sql` in your Supabase SQL editor to create the `documents` table.

### 3. Data Ingestion
Drop your meeting files into `/moms` and process them:
```bash
npm install
node ingest.js
```

### 4. Running the App
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) on your desktop or mobile.
