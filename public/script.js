// ─── DOM refs ──────────────────────────────────────────────────────────────
const queryInput = document.getElementById('queryInput');
const sendBtn = document.getElementById('sendBtn');
const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const resultState = document.getElementById('resultState');
const errorState = document.getElementById('errorState');
const resultQuery = document.getElementById('resultQuery');
const answerBody = document.getElementById('answerBody');
const sourcesList = document.getElementById('sourcesList');
const sourceCount = document.getElementById('sourceCount');

// Pipeline elements
const PS = {
    embed: document.getElementById('ps-embed'),
    arr1: document.getElementById('pa-1'),
    retrieve: document.getElementById('ps-retrieve'),
    arr2: document.getElementById('pa-2'),
    generate: document.getElementById('ps-generate'),
};

// ─── Auto-resize textarea ───────────────────────────────────────────────────
queryInput.addEventListener('input', () => {
    queryInput.style.height = 'auto';
    queryInput.style.height = Math.min(queryInput.scrollHeight, 150) + 'px';
});

// ─── Enter to send, Shift+Enter for newline ─────────────────────────────────
queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitQuery();
    }
});

// ─── Pipeline animation ─────────────────────────────────────────────────────
function resetPipeline() {
    Object.values(PS).forEach(el => el.classList.remove('active', 'done'));
}

function activate(id) { PS[id].classList.add('active'); }
function complete(id) { PS[id].classList.remove('active'); PS[id].classList.add('done'); }

let pipelineTimers = [];

function runPipeline() {
    resetPipeline();
    pipelineTimers.forEach(clearTimeout);
    pipelineTimers = [];

    // Step 1 — Embedding
    activate('embed');
    pipelineTimers.push(setTimeout(() => { complete('embed'); activate('arr1'); }, 1200));
    pipelineTimers.push(setTimeout(() => { complete('arr1'); activate('retrieve'); }, 1800));

    // Step 2 — Retrieval (takes longest — embedding + Zilliz search)
    pipelineTimers.push(setTimeout(() => { complete('retrieve'); activate('arr2'); }, 3600));
    pipelineTimers.push(setTimeout(() => { complete('arr2'); activate('generate'); }, 4200));

    return function finishPipeline() {
        pipelineTimers.forEach(clearTimeout);
        Object.values(PS).forEach(el => { el.classList.remove('active'); el.classList.add('done'); });
    };
}

// ─── Show / Hide panels ─────────────────────────────────────────────────────
function showOnly(id) {
    [emptyState, loadingState, resultState, errorState].forEach(el => el.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// ─── Score badge ─────────────────────────────────────────────────────────────
function scoreBadge(score) {
    const pct = Math.round(score * 100);
    const cls = score >= 0.65 ? 'score-high' : score >= 0.4 ? 'score-mid' : 'score-low';
    return `<span class="source-score ${cls}">${pct}%</span>`;
}

// ─── Render result ──────────────────────────────────────────────────────────
function renderResult(query, data) {
    resultQuery.textContent = query;
    answerBody.textContent = data.answer || 'No answer returned.';

    sourcesList.innerHTML = '';
    const sources = data.sources || [];
    sourceCount.textContent = `${sources.length} chunk${sources.length !== 1 ? 's' : ''}`;

    sources.forEach((s, i) => {
        const item = document.createElement('div');
        item.className = 'source-item';
        item.innerHTML = `
      ${scoreBadge(s.score)}
      <div class="source-content">
        <div class="source-doc-id">Document ID: ${s.document_id} &nbsp;·&nbsp; Chunk ${i + 1}</div>
        <div class="source-text">${escHtml(s.text)}</div>
      </div>
    `;
        sourcesList.appendChild(item);
    });

    showOnly('resultState');
}

function escHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ─── Main submit ────────────────────────────────────────────────────────────
async function submitQuery() {
    const query = queryInput.value.trim();
    if (!query) return;

    sendBtn.disabled = true;
    showOnly('loadingState');
    const finish = runPipeline();

    const MIN_MS = 4800;

    // Show a "taking longer" hint after 8s (can happen during Gemini rate-limit retry)
    const slowTimer = setTimeout(() => {
        const sub = document.getElementById('ps-generate')?.querySelector('.ps-sub');
        if (sub) sub.textContent = 'Retrying… please wait';
    }, 8000);

    try {
        const [response] = await Promise.all([
            fetch('/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            }),
            delay(MIN_MS),
        ]);

        clearTimeout(slowTimer);
        const data = await response.json();

        finish();
        await delay(500);

        if (!response.ok) {
            showError(data.error || `Server error ${response.status}`);
        } else {
            renderResult(query, data);
        }

    } catch (err) {
        finish();
        showError('Could not reach the server. Is it running on port 3000?');
        console.error(err);
    } finally {
        sendBtn.disabled = false;
    }
}

function showError(msg) {
    document.getElementById('errorMsg').textContent = msg;
    showOnly('errorState');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Suggestion helper ───────────────────────────────────────────────────────
function setQuery(text) {
    queryInput.value = text;
    queryInput.style.height = 'auto';
    queryInput.style.height = Math.min(queryInput.scrollHeight, 150) + 'px';
    submitQuery();
}
