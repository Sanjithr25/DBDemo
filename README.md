# Intent-Based Recipe Search (Hybrid: PostgreSQL + Milvus)

A high-performance recipe search engine that combines **Semantic Understanding** (Milvus) with **Structured Filtering** (PostgreSQL).

## 🚀 How it Works
This project implements a **Hybrid Search** pattern:

1.  **Semantic Search (Milvus)**: Understands the *intent* and *context* of a query (e.g., "comfort food" or "busy mornings") using vector embeddings.
2.  **Structured Filtering (PostgreSQL)**: Handles hard constraints like "calories < 300" or "prep_time < 15" using standard SQL.
3.  **Local Embeddings**: Uses `Xenova/all-MiniLM-L6-v2` to generate 384-dimensional vectors locally without external APIs.

## 🛠 Tech Stack
- **Frontend**: Vanilla HTML5/CSS3 + JavaScript
- **Backend**: Node.js (Express)
- **Vector DB**: Milvus (Attu for GUI)
- **RDBMS**: PostgreSQL
- **Embeddings**: Transformers.js (Local)

## 📋 Prerequisites
- **PostgreSQL**: Installed and running on port 5432.
- **Milvus**: Installed (usually via Docker) and running on port 19530.
- **Node.js**: v18+ installed.

## ⚙️ Setup Instructions

### 1. Database Setup
Run the following to initialize your PostgreSQL table:
```bash
psql -U postgres -f setup_db.sql
```

### 2. Environment Configuration
Update the `.env` file with your PostgreSQL password:
```env
PG_PASSWORD=your_actual_password
```

### 3. Populate Data
Run the sync script to generate embeddings and populate Milvus:
```bash
node sync.js
```

### 4. Start the Server
```bash
npm start
```

## 🔍 Query Logic
The system automatically extracts rules based on keywords:

| Keyword | Rule Applied |
| :--- | :--- |
| **high calorie** | `calories > 500` |
| **low calorie** | `calories < 300` |
| **quick** | `prep_time < 15` |
| **snack** | `category @> ARRAY['snack']` |
| **breakfast** | `category @> ARRAY['breakfast']` |
| **dinner** | `category @> ARRAY['dinner']` |

**Example**: *"quick high calorie snacks"*
- **Milvus Query**: "quick snacks" (Semantic retrieval)
- **Postgres Filter**: `calories > 500 AND prep_time < 15 AND category @> ARRAY['snack']`

## 📂 Project Structure
- `setup_db.sql`: Schema and intent-rich dataset.
- `sync.js`: Script to generate embeddings and sync Postgres IDs to Milvus.
- `server.js`: Express API for hybrid search.
- `public/`: Stunning frontend dashboard.
- `download_model.js`: Utility to pre-download the model.
