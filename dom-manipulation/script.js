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

// Persistence helpers
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
        quotes.length = 0;
        parsed.forEach(q => quotes.push(q));
      }
    }
  } catch (e) {
    console.error('Failed to load quotes from localStorage', e);
  }
}

function uniqueCategories() {
  return Array.from(new Set(quotes.map(q => q.category))).sort((a,b)=> (a>b?1:(a<b?-1:0)));
}

function renderCategories() {
  const cats = uniqueCategories();
  if (!categorySelect) return;
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

// Display a random quote (merged & fixed from both versions)
function showRandomQuote() {
  const display = quoteDisplay || document.getElementById('quoteDisplay');
  if (!display) return;
  const selectedCategory = categorySelect && categorySelect.value;
  const pool = selectedCategory ? quotes.filter(q => String(q.category) == String(selectedCategory)) : quotes.slice();
  if (!pool.length) {
    display.innerHTML = `<p>No quotes in this category.</p>`;
    return;
  }
  const randomIndex = Math.floor(Math.random() * pool.length);
  const quote = pool[randomIndex];
  display.innerHTML = `"${quote.text}" <br> <em>(${quote.category})</em>`;
}

// Add a quote (integrated with persistence and categories)
function addQuote() {
  const textInput = document.getElementById('newQuoteText');
  const categoryInput = document.getElementById('newQuoteCategory');
  if (!textInput || !categoryInput) return;
  const text = textInput.value.trim();
  let category = categoryInput.value.trim();
  if (text === '' || category === '') {
    alert('Please enter both a quote and a category.');
    return;
  }
  // try to coerce numeric categories to numbers
  if (!isNaN(category) && category !== '') category = Number(category);
  quotes.push({ text, category });
  saveQuotes();
  renderCategories();
  document.getElementById('quoteDisplay').innerHTML = `New quote added: "${text}" — (${category})`;
  // clear the input fields
  textInput.value = '';
  categoryInput.value = '';
}

// Create an inline add-quote form and insert it after the Show New Quote button
function createAddQuoteFormInline() {
  // if form already exists, do nothing
  if (document.getElementById('addQuoteForm')) return;
  const form = document.createElement('div');
  form.id = 'addQuoteForm';
  form.style.marginTop = '12px';
  const quoteInput = document.createElement('input');
  quoteInput.id = 'newQuoteText';
  quoteInput.type = 'text';
  quoteInput.placeholder = 'Enter a new quote';
  quoteInput.style.marginRight = '8px';
  const categoryInput = document.createElement('input');
  categoryInput.id = 'newQuoteCategory';
  categoryInput.type = 'text';
  categoryInput.placeholder = 'Enter quote category';
  categoryInput.style.marginRight = '8px';
  const addButton = document.createElement('button');
  addButton.textContent = 'Add Quote';
  addButton.type = 'button';
  addButton.className = 'btn';
  addButton.addEventListener('click', addQuote);
  form.appendChild(quoteInput);
  form.appendChild(categoryInput);
  form.appendChild(addButton);
  if (newQuoteBtn && newQuoteBtn.parentNode) {
    newQuoteBtn.insertAdjacentElement('afterend', form);
  } else {
    document.body.appendChild(form);
  }
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
      const valid = imported.every(item => item && typeof item.text === 'string' && ('category' in item));
      if (!valid) throw new Error('Each quote must have a text string and a category');
      quotes.push(...imported);
      saveQuotes();
      renderCategories();
      showRandomQuote();
      alert('Quotes imported successfully!');
    } catch (err) {
      console.error('Import error', err);
      alert('Failed to import quotes: ' + err.message);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

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

// Wire up basic listeners
if (newQuoteBtn) newQuoteBtn.addEventListener('click', showRandomQuote);
if (categorySelect) categorySelect.addEventListener('change', showRandomQuote);

function init() {
  loadQuotes();
  renderCategories();
  createImportExportControls();
  createAddQuoteFormInline();
  showRandomQuote();
}

init();

