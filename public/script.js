const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('results');
const loader = document.getElementById('loader');
const queryLogic = document.getElementById('queryLogic');
const semanticVal = document.getElementById('semanticVal');
const filtersVal = document.getElementById('filtersVal');

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    // UI Reset
    resultsDiv.innerHTML = '';
    loader.classList.remove('hidden');
    queryLogic.classList.add('hidden');

    try {
        const response = await fetch('/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const data = await response.json();

        loader.classList.add('hidden');

        if (data.results && data.results.length > 0) {
            displayLogic(data.queryInfo);
            displayResults(data.results);
        } else {
            resultsDiv.innerHTML = '<p class="no-results">No recipes found matching your hybrid criteria.</p>';
        }

    } catch (err) {
        console.error(err);
        loader.classList.add('hidden');
        resultsDiv.innerHTML = '<p class="error">Failed to connect to the backend server.</p>';
    }
}

function displayLogic(info) {
    queryLogic.classList.remove('hidden');
    semanticVal.textContent = `"${info.semantic}"`;
    filtersVal.textContent = info.filters.length > 0 ? info.filters.join(' AND ') : 'None';
}

function displayResults(recipes) {
    recipes.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'recipe-card';

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
