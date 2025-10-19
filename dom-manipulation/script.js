// script.js — Dynamic Quote Generator with server sync simulation & basic conflict handling

const QUOTES_KEY = "quotes_data_sync";
const FILTER_KEY = "selected_filter";
const LAST_SYNC_KEY = "last_sync_ts";

let quotes = JSON.parse(localStorage.getItem(QUOTES_KEY)) || [
  { id: "loc-1", text: "this one", category: 1, updatedAt: Date.now() },
  { id: "loc-2", text: "this two", category: 2, updatedAt: Date.now() },
  { id: "loc-3", text: "this three", category: 3, updatedAt: Date.now() },
  { id: "loc-4", text: "this four", category: 4, updatedAt: Date.now() },
  { id: "loc-5", text: "this five", category: 5, updatedAt: Date.now() },
];

const SERVER_URL = "https://jsonplaceholder.typicode.com/posts";
const SYNC_INTERVAL_MS = 30000;

let quoteDisplay, categoryFilter, importFile;
let syncBanner, syncMessage, viewConflictsBtn, dismissBannerBtn;
let conflictModal, conflictList;

/* -----------------------
   Helpers
----------------------- */
function saveQuotes() {
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}

function loadQuotesFromStorage() {
  const raw = localStorage.getItem(QUOTES_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) quotes = parsed;
  } catch (e) {
    console.error("Failed to parse stored quotes:", e);
  }
}

function escapeHtml(s) {
  return ("" + s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
}

/* -----------------------
   Display + Categories
----------------------- */
function populateCategories() {
  if (!categoryFilter) categoryFilter = document.getElementById("categoryFilter");
  if (!categoryFilter) return;
  const unique = [...new Set(quotes.map(q => q.category))];
  const prev = localStorage.getItem(FILTER_KEY) || "all";
  categoryFilter.innerHTML = '<option value="all">All Categories</option>';
  unique.forEach(c => {
    const opt = document.createElement("option");
    opt.value = String(c);
    opt.textContent = String(c);
    categoryFilter.appendChild(opt);
  });
  if ([...categoryFilter.options].some(o => o.value === prev)) categoryFilter.value = prev;
  else categoryFilter.value = "all";
}

function filterQuotes() {
  const selected = categoryFilter ? categoryFilter.value : (localStorage.getItem(FILTER_KEY) || "all");
  localStorage.setItem(FILTER_KEY, selected);
  showRandomQuote();
}

function showRandomQuote() {
  if (!quoteDisplay) quoteDisplay = document.getElementById("quoteDisplay");
  const selected = categoryFilter ? categoryFilter.value : "all";
  const pool = selected !== "all" ? quotes.filter(q => String(q.category) === String(selected)) : quotes.slice();
  if (!pool.length) {
    quoteDisplay.innerHTML = `<em>No quotes in this category.</em>`;
    return;
  }
  const q = pool[Math.floor(Math.random() * pool.length)];
  quoteDisplay.innerHTML = `"${escapeHtml(q.text)}" <br><small>(${escapeHtml(String(q.category))})</small>`;
}

/* -----------------------
   Add, Import, Export
----------------------- */
function createAddQuoteForm() {
  const container = document.getElementById("addQuoteForm");
  if (!container) return;
  container.innerHTML = "";
  const textInput = document.createElement("input");
  textInput.id = "newQuoteText";
  textInput.placeholder = "Enter a new quote";
  const categoryInput = document.createElement("input");
  categoryInput.id = "newQuoteCategory";
  categoryInput.placeholder = "Enter quote category";
  const addBtn = document.createElement("button");
  addBtn.textContent = "Add Quote";
  addBtn.addEventListener("click", () => {
    const text = (textInput.value || "").trim();
    let category = (categoryInput.value || "").trim();
    if (!text || !category) return alert("Enter both quote and category");
    if (!isNaN(category)) category = Number(category);
    const id = "loc-" + (Date.now().toString(36) + "-" + Math.floor(Math.random()*1000));
    const newQ = { id, text, category, updatedAt: Date.now() };
    quotes.push(newQ);
    saveQuotes();
    populateCategories();
    categoryFilter.value = String(category);
    localStorage.setItem(FILTER_KEY, String(category));
    showRandomQuote();
    textInput.value = "";
    categoryInput.value = "";
  });
  container.appendChild(textInput);
  container.appendChild(categoryInput);
  container.appendChild(addBtn);
}

function exportToJson() {
  const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importFromJsonFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error("JSON must be an array");
      const normalized = imported.map((it, idx) => ({
        id: it.id || "srv-imp-" + (Date.now().toString(36) + "-" + idx),
        text: String(it.text || ""),
        category: it.category ?? "imported",
        updatedAt: Date.now()
      }));
      quotes.push(...normalized);
      saveQuotes();
      populateCategories();
      showRandomQuote();
      alert("Imported " + normalized.length + " quotes");
    } catch (err) {
      alert("Import failed: " + err.message);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

/* -----------------------
   SERVER SYNC
----------------------- */

/**
 * ✅ This is the required function name
 * Simulates fetching quotes from the server (mock API)
 */
async function fetchQuotesFromServer() {
  try {
    const res = await fetch(SERVER_URL + "?_limit=20");
    if (!res.ok) throw new Error("Network error: " + res.status);
    const data = await res.json();
    return data.map(post => ({
      id: "srv-" + post.id,
      text: post.title,
      category: post.userId,
      updatedAt: Date.now()
    }));
  } catch (err) {
    console.error("Failed to fetch server quotes:", err);
    return null;
  }
}

/**
 * Merge server data into local quotes — server wins conflicts
 */
function mergeServerData(serverQuotes) {
  if (!Array.isArray(serverQuotes)) return { added: 0, updated: 0, conflicts: [] };
  const localById = new Map(quotes.map(q => [q.id, q]));
  const conflicts = [];
  let added = 0, updated = 0;

  serverQuotes.forEach(sq => {
    const local = localById.get(sq.id);
    if (!local) {
      quotes.push(sq);
      added++;
    } else if (local.text !== sq.text || String(local.category) !== String(sq.category)) {
      conflicts.push({ id: sq.id, local: { ...local }, server: { ...sq } });
      const idx = quotes.findIndex(q => q.id === local.id);
      if (idx !== -1) {
        quotes[idx] = sq;
        updated++;
      }
    }
  });

  saveQuotes();
  return { added, updated, conflicts };
}

/**
 * Perform synchronization
 */
async function performSync(showNotification = true) {
  const serverData = await fetchQuotesFromServer();
  if (!serverData) {
    if (showNotification) showBanner("Sync failed (network).", false);
    return;
  }
  const result = mergeServerData(serverData);
  localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
  populateCategories();
  if (result.added || result.updated) showRandomQuote();
  if (result.conflicts.length) {
    showBanner(
      `Sync finished: ${result.added} added, ${result.updated} updated. ${result.conflicts.length} conflicts resolved.`,
      true,
      result.conflicts
    );
  } else if (showNotification) {
    showBanner(`Sync finished: ${result.added} added, ${result.updated} updated.`, false);
  }
}

/* -----------------------
   UI Notifications + Conflicts
----------------------- */
function showBanner(message, hasConflicts = false, conflicts = []) {
  syncBanner = document.getElementById("syncBanner");
  syncMessage = document.getElementById("syncMessage");
  viewConflictsBtn = document.getElementById("viewConflictsBtn");
  dismissBannerBtn = document.getElementById("dismissBannerBtn");

  syncMessage.textContent = message;
  syncBanner.style.display = "block";
  viewConflictsBtn.style.display = hasConflicts ? "inline-block" : "none";

  viewConflictsBtn.onclick = () => openConflictModal(conflicts);
  dismissBannerBtn.onclick = () => (syncBanner.style.display = "none");
}

function openConflictModal(conflicts) {
  conflictModal = document.getElementById("conflictModal");
  conflictList = document.getElementById("conflictList");
  conflictList.innerHTML = "";
  conflicts.forEach(c => {
    const div = document.createElement("div");
    div.innerHTML = `<strong>${c.id}</strong><br>
      Local: ${escapeHtml(c.local.text)}<br>
      Server: ${escapeHtml(c.server.text)}<hr>`;
    conflictList.appendChild(div);
  });
  conflictModal.style.display = "block";

  document.getElementById("closeConflictModal").onclick = () => (conflictModal.style.display = "none");
}

/* -----------------------
   Setup + Init
----------------------- */
function wireUpUI() {
  quoteDisplay = document.getElementById("quoteDisplay");
  categoryFilter = document.getElementById("categoryFilter");
  importFile = document.getElementById("importFile");

  document.getElementById("newQuote").addEventListener("click", showRandomQuote);
  document.getElementById("exportQuotes").addEventListener("click", exportToJson);
  document.getElementById("importQuotes").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", importFromJsonFile);
  document.getElementById("syncNow").addEventListener("click", () => performSync(true));
}

async function init() {
  wireUpUI();
  loadQuotesFromStorage();
  populateCategories();
  createAddQuoteForm();
  showRandomQuote();
  await performSync(false);
  setInterval(() => performSync(true), SYNC_INTERVAL_MS);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
