require('dotenv').config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Generates an answer given a user query and a retrieved context string.
 *
 * Priority:
 *   1. Groq   (if GROQ_API_KEY is set)   — fast, generous free tier, no rate issues
 *   2. Gemini (if GEMINI_API_KEY is set)  — fallback
 *   3. OpenAI (if OPENAI_API_KEY is set)  — fallback
 *   4. Placeholder (no key set)           — returns raw retrieved context
 *
 * @param {string} query
 * @param {string} context
 * @returns {Promise<string>}
 */
async function generateAnswer(query, context) {
    const prompt = buildPrompt(query, context);

    if (GROQ_API_KEY) {
        console.log('[Generate] Using Groq (llama-3.3-70b-versatile)');
        return callGroq(prompt);
    }

    if (GEMINI_API_KEY) {
        console.log('[Generate] Using Gemini (gemini-2.0-flash)');
        return callGemini(prompt);
    }

    if (OPENAI_API_KEY) {
        console.log('[Generate] Using OpenAI (gpt-3.5-turbo)');
        return callOpenAI(prompt);
    }

    console.warn('[Generate] No API key set — returning placeholder.');
    return (
        '[No LLM key configured — set GROQ_API_KEY in .env]\n\n' +
        'Retrieved context:\n' + context
    );
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(query, context) {
    return (
        'You are a helpful assistant. Answer ONLY using the context below. ' +
        'Be concise and specific.\n\n' +
        'Context:\n' +
        context +
        '\n\nQuestion:\n' +
        query +
        "\n\nIf the answer is not found in the context, say 'Not found in documents.'"
    );
}

// ── Groq ──────────────────────────────────────────────────────────────────────

/**
 * Calls the Groq Chat Completions API.
 * Groq is OpenAI-compatible — same request/response shape.
 * Docs: https://console.groq.com/docs/openai
 *
 * Free tier: 30 RPM, 14,400 RPD, 6,000 tokens/min
 * Model: llama-3.3-70b-versatile — best quality on Groq free tier
 *
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function callGroq(prompt) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 512,
            temperature: 0.2,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        const msg = data?.error?.message || JSON.stringify(data);
        console.error('[Groq] API error:', msg);
        throw new Error(`Groq error: ${msg}`);
    }

    return data.choices[0].message.content.trim();
}

// ── Gemini (fallback) ─────────────────────────────────────────────────────────

async function callGemini(prompt, attempt = 1) {
    const MAX_ATTEMPTS = 3;
    const model = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        const msg = data?.error?.message || JSON.stringify(data);
        if (response.status === 429 && attempt < MAX_ATTEMPTS) {
            const secondsMatch = msg.match(/retry\s+in\s+([\d.]+)s/i);
            const waitMs = secondsMatch ? Math.ceil(parseFloat(secondsMatch[1])) * 1000 : 20000;
            console.warn(`[Gemini] Rate limited. Retrying in ${waitMs / 1000}s (attempt ${attempt}/${MAX_ATTEMPTS})...`);
            await new Promise(r => setTimeout(r, waitMs));
            return callGemini(prompt, attempt + 1);
        }
        console.error('[Gemini] API error:', msg);
        throw new Error(`Gemini error: ${msg}`);
    }

    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error('Gemini returned no candidates.');
    return candidate.content.parts[0].text.trim();
}

// ── OpenAI (fallback) ─────────────────────────────────────────────────────────

async function callOpenAI(prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 512,
            temperature: 0.2,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI error ${response.status}: ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
}

module.exports = { generateAnswer };
