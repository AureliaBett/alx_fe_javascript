

const quotes = [
    {text: "this one", category: 1},
    {text: "this two", category: 2},
    {text: "this three", category: 3},
    {text: "this four", category: 4},
    {text: "this five", category: 5}
];

const STORAGE_KEY = 'dqg_quotes_v1';

const quoteDisplay = document.getElementById('quoteDisplay');
const newQuoteBtn = document.getElementById('newQuote');
const categorySelect = document.getElementById('categorySelect');
const toggleAddFormBtn = document.getElementById('toggleAddForm');
const addArea = document.getElementById('addArea');
const categoryList = document.getElementById('categoryList');
const clearStorageBtn = document.getElementById('clearStorage');

// --- Persistence helpers ---
function saveQuotes() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  } catch (e) {
    console.error('Failed to save quotes to localStorage', e);
  }
}

function loadQuotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // replace array contents while keeping the same reference
        quotes.length = 0;
        parsed.forEach(q => quotes.push(q));
      }
    }
  } catch (e) {
    console.error('Failed to load quotes from localStorage', e);
  }
}

function uniqueCategories() {
  return Array.from(new Set(quotes.map(q => q.category))).sort();
}

function renderCategories() {
  const cats = uniqueCategories();
  categorySelect.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = '— All categories —';
  categorySelect.appendChild(allOpt);
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    categorySelect.appendChild(opt);
  });
}

function showRandomQuote() {
  const selectedCategory = categorySelect.value;
  const pool = selectedCategory ? quotes.filter(q => q.category == selectedCategory) : quotes.slice();
  if (!pool.length) {
    quoteDisplay.innerHTML = `<p>No quotes in this category.</p>`;
    return;
  }
  const idx = Math.floor(Math.random() * pool.length);
  const q = pool[idx];
  quoteDisplay.innerHTML = '';
  const p = document.createElement('blockquote');
  p.style.margin = 0;
  p.textContent = q.text;
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `Category: ${q.category}`;
  quoteDisplay.appendChild(p);
  quoteDisplay.appendChild(meta);
}

// --- Import / Export ---
function exportToJson() {
  try {
    const dataStr = JSON.stringify(quotes, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quotes.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Export failed', e);
    alert('Failed to export quotes. See console for details.');
  }
}

function importFromJsonFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('JSON must be an array of quotes');
      // validate shape
      const valid = imported.every(item => item && typeof item.text === 'string' && ('category' in item));
      if (!valid) throw new Error('Each quote must have a text string and a category');
      // append imported quotes
      quotes.push(...imported);
      saveQuotes();
      renderCategories();
      showRandomQuote();
      alert('Quotes imported successfully!');
    } catch (err) {
      console.error('Import error', err);
      alert('Failed to import quotes: ' + err.message);
    } finally {
      // reset the input so the same file can be imported again if needed
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

// create simple UI controls for import/export so no HTML change required
function createImportExportControls() {
  const controls = document.getElementById('controls') || document.body;

  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.id = 'importFile';
  importInput.accept = '.json,application/json';
  importInput.style.display = 'none';
  importInput.addEventListener('change', importFromJsonFile);

  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.className = 'btn';
  importBtn.textContent = 'Import JSON';
  importBtn.addEventListener('click', () => importInput.click());

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'btn';
  exportBtn.textContent = 'Export JSON';
  exportBtn.addEventListener('click', exportToJson);

  controls.appendChild(importInput);
  controls.appendChild(importBtn);
  controls.appendChild(exportBtn);
}

newQuoteBtn.addEventListener('click', showRandomQuote);
categorySelect.addEventListener('change', showRandomQuote);

function init() {
  loadQuotes();
  renderCategories();
  createImportExportControls();
  showRandomQuote();
}

init();
