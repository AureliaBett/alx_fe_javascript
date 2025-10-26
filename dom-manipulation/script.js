// script.js - Dynamic Quote Generator with category filter persisted to localStorage

const LOCAL_KEY = "quotes_data";                 // localStorage key for quotes array
const SESSION_LAST_INDEX = "last_viewed_index";  // sessionStorage key for last viewed quote index
const SELECTED_CATEGORY_KEY = "quotes_selected_category"; // localStorage key for last selected category filter

let quotes = [];

// Default quotes
function defaultQuotes() {
  return [
    { text: "This is my first quote", category: "1" },
    { text: "This is my second quote", category: "2" },
    { text: "This is my third quote", category: "3" },
    { text: "This is my fourth quote", category: "4" }
  ];
}

// Save current quotes array to localStorage
function saveQuotes() {
  try {
    const json = JSON.stringify(quotes);
    localStorage.setItem(LOCAL_KEY, json);
  } catch (err) {
    console.error("Failed to save quotes:", err);
  }
}

// Load quotes from localStorage (or initialize defaults)
function loadQuotes() {
  const stored = localStorage.getItem(LOCAL_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        quotes = parsed;
        return;
      }
    } catch (err) {
      console.warn("Could not parse stored quotes, resetting to defaults:", err);
    }
  }
  quotes = defaultQuotes();
  saveQuotes();
}

// Helper: escape HTML in strings before injecting into innerHTML
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// --- Category utilities

// Return array of unique category strings present in quotes (empty category becomes "(none)")
function getUniqueCategories() {
  const set = new Set();
  quotes.forEach(q => {
    const cat = (q.category === undefined || q.category === null || String(q.category).trim() === "") ? "(none)" : String(q.category);
    set.add(cat);
  });
  return Array.from(set).sort((a,b) => a.localeCompare(b));
}

// Populate #categoryFilter dropdown from quotes
function populateCategories() {
  const select = document.getElementById("categoryFilter");
  if (!select) return;
  // preserve current chosen value (if any)
  const current = localStorage.getItem(SELECTED_CATEGORY_KEY) || select.value || "all";

  // clear all options and add the "All" option
  select.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "All Categories";
  select.appendChild(allOpt);

  const categories = getUniqueCategories();
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat === "(none)" ? "(no category)" : cat;
    select.appendChild(opt);
  });

  // restore previously selected category if still available, otherwise default to "all"
  const availableValues = ["all", ...categories];
  const restored = (current && availableValues.includes(current)) ? current : "all";
  select.value = restored;
  // persist restored selection (this ensures a value is stored in localStorage)
  localStorage.setItem(SELECTED_CATEGORY_KEY, restored);
}

// --- Display / filtering logic

// Show a specific quote by index (unfiltered index into quotes array)
function showQuoteByIndex(index) {
  const display = document.getElementById("quoteDisplay");
  if (!quotes.length) {
    display.textContent = "No quotes available.";
    return;
  }
  const idx = Math.max(0, Math.min(index, quotes.length - 1));
  const q = quotes[idx];
  display.innerHTML = `<div class="quote-text">${escapeHtml(q.text)}</div><div class="small">Category: ${escapeHtml(String(q.category || "(none)"))} — index ${idx}</div>`;
  try {
    sessionStorage.setItem(SESSION_LAST_INDEX, String(idx));
  } catch (err) { console.warn("sessionStorage unavailable:", err); }
}

// Create and show a random quote (no filter applied to random selection)
function showRandomQuote() {
  if (!quotes.length) {
    document.getElementById("quoteDisplay").textContent = "No quotes available.";
    return;
  }
  const randomIndex = Math.floor(Math.random() * quotes.length);
  showQuoteByIndex(randomIndex);
}

// Render list of stored quotes, optionally filtered by category
function renderQuotesList() {
  const container = document.getElementById("quotesContainer");
  container.innerHTML = "";
  if (!quotes.length) {
    container.textContent = "No stored quotes.";
    return;
  }

  const selectedCategory = localStorage.getItem(SELECTED_CATEGORY_KEY) || "all";

  // build an array of indices to display (we need original indices for Show/Delete actions)
  const toDisplay = [];
  quotes.forEach((q, idx) => {
    const cat = (q.category === undefined || q.category === null || String(q.category).trim() === "") ? "(none)" : String(q.category);
    if (selectedCategory === "all" || selectedCategory === cat) {
      toDisplay.push({ q, idx, cat });
    }
  });

  if (toDisplay.length === 0) {
    container.textContent = `No quotes for category '${selectedCategory}'.`;
    return;
  }

  toDisplay.forEach(item => {
    const { q, idx } = item;
    const itemDiv = document.createElement("div");
    itemDiv.className = "quote-item";

    const left = document.createElement("div");
    left.className = "quote-text";
    left.innerHTML = `<strong>${escapeHtml(q.text)}</strong><div class="small">Category: ${escapeHtml(String(q.category || "(none)"))}</div>`;

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "6px";

    const showBtn = document.createElement("button");
    showBtn.textContent = "Show";
    showBtn.addEventListener("click", () => showQuoteByIndex(idx));

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      if (!confirm("Delete this quote?")) return;
      quotes.splice(idx, 1);
      saveQuotes();
      // after deletion we must repopulate categories and re-render list
      populateCategories();
      renderQuotesList();
      // adjust last viewed index stored in sessionStorage if needed
      const storedIndex = sessionStorage.getItem(SESSION_LAST_INDEX);
      if (storedIndex !== null && Number(storedIndex) === idx) {
        sessionStorage.removeItem(SESSION_LAST_INDEX);
      }
    });

    right.appendChild(showBtn);
    right.appendChild(delBtn);

    itemDiv.appendChild(left);
    itemDiv.appendChild(right);
    container.appendChild(itemDiv);
  });
}

// Called when user changes the category filter dropdown; persists selection and updates list
function filterQuotes() {
  const select = document.getElementById("categoryFilter");
  if (!select) return;
  const selected = select.value;
  localStorage.setItem(SELECTED_CATEGORY_KEY, selected);
  renderQuotesList();
}

// Add a new quote from the input fields; also updates categories and persists everything
function addQuoteFromInputs() {
  const textInput = document.getElementById("newQuoteText");
  const categoryInput = document.getElementById("newQuoteCategory");
  const text = (textInput.value || "").trim();
  let category = (categoryInput.value || "").trim();
  if (!text) {
    alert("Please enter quote text.");
    return;
  }
  // normalize empty category to empty string (rendering will show "(no category)")
  if (category === "") category = "";
  quotes.push({ text, category });
  saveQuotes();
  // update categories dropdown in case the new category is new
  populateCategories();
  // after populating categories, ensure the current selected category (if matches new) remains selected
  renderQuotesList();
  // clear inputs
  textInput.value = "";
  categoryInput.value = "";
}

// Export quotes to JSON file
function exportQuotes() {
  try {
    const json = JSON.stringify(quotes, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filename = `quotes_export_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.json`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Export failed:", err);
    alert("Could not export quotes. See console for details.");
  }
}

// Import quotes from uploaded JSON file (replaces current quotes). Then update categories and UI.
function importQuotesFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!Array.isArray(parsed)) {
        alert("Imported file must be a JSON array of quote objects.");
        return;
      }
      const validated = parsed.filter(item => item && typeof item.text === "string");
      if (!validated.length) {
        alert("No valid quotes found in file (expected objects with a 'text' string).");
        return;
      }
      quotes = validated.map(item => ({ text: String(item.text), category: item.category ?? "" }));
      saveQuotes();
      populateCategories();
      renderQuotesList();
      alert(`Imported ${quotes.length} quote(s).`);
    } catch (err) {
      console.error("Import error:", err);
      alert("Failed to read JSON file. Make sure it's valid JSON.");
    }
  };
  reader.onerror = (err) => {
    console.error("File read error:", err);
    alert("Failed to read file.");
  };
  reader.readAsText(file);
}

// Reset quotes to defaults (and save)
function resetToDefaults() {
  if (!confirm("Reset quotes to default set? This will overwrite current stored quotes.")) return;
  quotes = defaultQuotes();
  saveQuotes();
  populateCategories();
  renderQuotesList();
  document.getElementById("quoteDisplay").textContent = "Reset to default quotes.";
  sessionStorage.removeItem(SESSION_LAST_INDEX);
  localStorage.removeItem(SELECTED_CATEGORY_KEY);
}

// --- Initialize UI and events
window.addEventListener("DOMContentLoaded", () => {
  const newQuoteBtn = document.getElementById("newQuote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");
  const addQuoteBtn = document.getElementById("addQuoteBtn");
  const clearBtn = document.getElementById("clearBtn");
  const categoryFilter = document.getElementById("categoryFilter");

  loadQuotes();
  populateCategories();
  renderQuotesList();

  // If sessionStorage has last viewed index, show that quote
  const lastIdx = sessionStorage.getItem(SESSION_LAST_INDEX);
  if (lastIdx !== null && !isNaN(Number(lastIdx)) && quotes[Number(lastIdx)]) {
    showQuoteByIndex(Number(lastIdx));
  }

  // restore selected category and re-render list (populateCategories already stored it)
  renderQuotesList();

  // Events
  newQuoteBtn.addEventListener("click", showRandomQuote);
  addQuoteBtn.addEventListener("click", addQuoteFromInputs);
  exportBtn.addEventListener("click", exportQuotes);

  importFile.addEventListener("change", (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (file) {
      importQuotesFile(file);
      // reset file input so same file can be re-imported if needed
      importFile.value = "";
    }
  });

  clearBtn.addEventListener("click", resetToDefaults);

  // category filter change -> filterQuotes behavior
  // the select already has inline onchange="filterQuotes()" — add event listener for robustness
  if (categoryFilter) categoryFilter.addEventListener("change", filterQuotes);
});
