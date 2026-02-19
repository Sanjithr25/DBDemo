const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('results');
const loader = document.getElementById('loader');
const queryLogic = document.getElementById('queryLogic');
const semanticVal = document.getElementById('semanticVal');
const filtersVal = document.getElementById('filtersVal');

// ─── Pipeline Step Elements ──────────────────────────────────────────────────
const steps = {
    intent: document.getElementById('step-intent'),
    conn1: document.getElementById('conn-1'),
    milvus: document.getElementById('step-milvus'),
    conn2: document.getElementById('conn-2'),
    postgres: document.getElementById('step-postgres'),
};

// ─── Pipeline Animation Helpers ──────────────────────────────────────────────
function resetPipeline() {
    Object.values(steps).forEach(el => {
        el.classList.remove('active', 'done');
    });
}

function activateStep(id) {
    steps[id].classList.add('active');
}

function completeStep(id) {
    steps[id].classList.remove('active');
    steps[id].classList.add('done');
}

// Run the pipeline animation while awaiting the fetch.
// Returns a cleanup function that finalises all steps on response.
function runPipelineAnimation() {
    resetPipeline();

    // Step 1 — Parsing intent (instant, ~0 ms)
    activateStep('intent');

    // Step 1 — hold "Parsing Intent" visibly for ~1 s
    const t1 = setTimeout(() => {
        completeStep('intent');
        activateStep('conn1');
    }, 1000);

    // Connector 1 flows for ~600 ms before Zilliz lights up
    const t2 = setTimeout(() => {
        completeStep('conn1');
        activateStep('milvus');
    }, 1600);

    // Step 2 — Zilliz stays active for ~1.8 s (embedding + ANN search)
    const t3 = setTimeout(() => {
        completeStep('milvus');
        activateStep('conn2');
    }, 3400);

    // Connector 2 flows for ~600 ms before Postgres lights up
    const t4 = setTimeout(() => {
        completeStep('conn2');
        activateStep('postgres');
    }, 4000);

    // Return a "finish" function: marks remaining steps as done immediately
    return function finish() {
        clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
        // Mark everything done so the pipeline looks complete before hiding
        ['intent', 'conn1', 'milvus', 'conn2', 'postgres'].forEach(id => {
            steps[id].classList.remove('active');
            steps[id].classList.add('done');
        });
    };
}

// ─── Search ──────────────────────────────────────────────────────────────────
async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    // UI Reset
    resultsDiv.innerHTML = '';
    queryLogic.classList.add('hidden');
    loader.classList.remove('hidden');

    const finishAnimation = runPipelineAnimation();

    // Minimum display time so the animation is always fully visible.
    // The fetch and the timer race in parallel; results only show once BOTH finish.
    const MIN_DISPLAY_MS = 5000;

    try {
        const [response] = await Promise.all([
            fetch('/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            }),
            delay(MIN_DISPLAY_MS)   // guarantees animation plays fully
        ]);

        const data = await response.json();

        // All steps snap to ✓ done, hold briefly, then hide
        finishAnimation();
        await delay(700);
        loader.classList.add('hidden');

        displayLogic(data.queryInfo);

        if (data.results && data.results.length > 0) {
            displayResults(data.results);
        } else {
            resultsDiv.innerHTML = '<p class="no-results">No recipes matched your hybrid criteria. Try adjusting your search.</p>';
        }

    } catch (err) {
        console.error(err);
        finishAnimation();
        loader.classList.add('hidden');
        resultsDiv.innerHTML = '<p class="error">Failed to connect to the backend server.</p>';
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Display Helpers ─────────────────────────────────────────────────────────
function displayLogic(info) {
    if (!info) return;
    queryLogic.classList.remove('hidden');

    // Exact string embedded and sent to Zilliz Cloud
    semanticVal.textContent = `"${info.semantic}"`;

    // Exact SQL filter conditions applied in Postgres
    if (info.sqlQuery && info.sqlQuery !== 'None') {
        filtersVal.textContent = info.sqlQuery;
    } else {
        filtersVal.textContent = 'None (no structured filters applied)';
    }
}

function displayResults(recipes) {
    recipes.forEach((recipe, i) => {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        card.style.animationDelay = `${i * 80}ms`;

        const categories = Array.isArray(recipe.category) ? recipe.category : [];

        card.innerHTML = `
            <h3>${recipe.title}</h3>
            <div class="badge-row">
                <span class="badge cal">${recipe.calories} kcal</span>
                <span class="badge time">${recipe.prep_time} mins</span>
                ${categories.map(c => `<span class="badge cat">${c}</span>`).join('')}
            </div>
            <p>${recipe.description}</p>
            <div class="ingredients">
                <strong>Ingredients:</strong><br>
                ${recipe.ingredients}
            </div>
        `;
        resultsDiv.appendChild(card);
    });
}

function setQuery(text) {
    searchInput.value = text;
    performSearch();
}

searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});
