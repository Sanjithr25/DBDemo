require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const queryRouter = require('./routes/query');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/query', queryRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Start ─────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
    console.log(`[Server] Personal Knowledge Assistant running on http://localhost:${PORT}`);
    console.log(`[Server] POST /query  — ask questions about your documents`);
    console.log(`[Server] GET  /health — health check`);
});

// Allow up to 3 minutes per request so Gemini retry-backoff doesn't time out
server.setTimeout(3 * 60 * 1000);
