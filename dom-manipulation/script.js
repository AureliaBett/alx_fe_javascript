// script.js - Dynamic Quote Generator with localStorage/sessionStorage + JSON import/export

const LOCAL_KEY = "quotes_data";          // localStorage key
const SESSION_LAST_INDEX = "last_viewed_index"; // sessionStorage key for last shown quote

let quotes = [];

// Utility: default quotes
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
      // If stored data not array, fall through to defaults
    } catch (err) {
      console.warn("Could not parse stored quotes, resetting to defaults:", err);
    }
  }
  quotes = defaultQuotes();
  saveQuotes();
}

// Show a specific quote by index
function showQuoteByIndex(index) {
  const display = document.getElementById("quoteDisplay");
  if (!quotes.length) {
    display.textContent = "No quotes available.";
    return;
  }
  const idx = Math.max(0, Math.min(index, quotes.length - 1));
  const q = quotes[idx];
  display.innerHTML = `<div class="quote-text">${escapeHtml(q.text)}</div><div class="small">Category: ${escapeHtml(String(q.category || ""))} — index ${idx}</div>`;
  // store last viewed in sessionStorage
  try {
    sessionStorage.setItem(SESSION_LAST_INDEX, String(idx));
  } catch (err) {
    console.warn("sessionStorage unavailable:", err);
  }
}

// Show a random quote
function showRandomQuote() {
  if (!quotes.length) {
    document.getElementById("quoteDisplay").textContent = "No quotes available.";
    return;
  }
  const randomIndex = Math.floor(Math.random() * quotes.length);
  showQuoteByIndex(randomIndex);
}

// Populate the stored quotes list on the page
function renderQuotesList() {
  const container = document.getElementById("quotesContainer");
  container.innerHTML = "";
  if (!quotes.length) {
    container.textContent = "No stored quotes.";
    return;
  }
  quotes.forEach((q, i) => {
    const item = document.createElement("div");
    item.className = "quote-item";
    const left = document.createElement("div");
    left.className = "quote-text";
    left.innerHTML = `<strong>${escapeHtml(q.text)}</strong><div class="small">Category: ${escapeHtml(String(q.category || ""))}</div>`;
    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "6px";
    const showBtn = document.createElement("button");
    showBtn.textContent = "Show";
    showBtn.addEventListener("click", () => showQuoteByIndex(i));
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      if (!confirm("Delete this quote?")) return;
      quotes.splice(i, 1);
      saveQuotes();
      renderQuotesList();
      // If we deleted the last viewed index, clear it
      const storedIndex = sessionStorage.getItem(SESSION_LAST_INDEX);
      if (storedIndex !== null && Number(storedIndex) === i) {
        sessionStorage.removeItem(SESSION_LAST_INDEX);
      }
    });
    right.appendChild(showBtn);
    right.appendChild(delBtn);

    item.appendChild(left);
    item.appendChild(right);
    container.appendChild(item);
  });
}

// Add a new quote from inputs
function addQuoteFromInputs() {
  const textInput = document.getElementById("newQuoteText");
  const categoryInput = document.getElementById("newQuoteCategory");
  const text = (textInput.value || "").trim();
  const category = (categoryInput.value || "").trim();
  if (!text) {
    alert("Please enter quote text.");
    return;
  }
  quotes.push({ text, category });
  saveQuotes();
  renderQuotesList();
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

// Import quotes from uploaded JSON file
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
      // Basic validation: each item should have a text property
      const validated = parsed.filter(item => item && typeof item.text === "string");
      if (!validated.length) {
        alert("No valid quotes found in file (expected objects with a 'text' string).");
        return;
      }
      // Replace current quotes with imported ones
      quotes = validated.map(item => ({ text: String(item.text), category: item.category ?? "" }));
      saveQuotes();
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
  renderQuotesList();
  document.getElementById("quoteDisplay").textContent = "Reset to default quotes.";
  sessionStorage.removeItem(SESSION_LAST_INDEX);
}

// Small helper to escape HTML (to avoid injection in innerHTML)
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// --- Initialize UI and events
window.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  const newQuoteBtn = document.getElementById("newQuote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");
  const addQuoteBtn = document.getElementById("addQuoteBtn");
  const clearBtn = document.getElementById("clearBtn");

  // Load quotes
  loadQuotes();
  renderQuotesList();

  // If sessionStorage has last viewed index, show that quote (session demo)
  const lastIdx = sessionStorage.getItem(SESSION_LAST_INDEX);
  if (lastIdx !== null && !isNaN(Number(lastIdx))) {
    showQuoteByIndex(Number(lastIdx));
  }

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
});
