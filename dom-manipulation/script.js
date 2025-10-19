// script.js — Dynamic Quote Generator with server sync simulation & basic conflict handling

// Storage keys
const QUOTES_KEY = "quotes_data_sync";
const FILTER_KEY = "selected_filter";
const LAST_SYNC_KEY = "last_sync_ts";

// Local quotes (start dataset). Each quote should have a unique id property.
// Local ids start with "loc-" ; server ids start with "srv-"
let quotes = JSON.parse(localStorage.getItem(QUOTES_KEY)) || [
  { id: "loc-1", text: "this one", category: 1, updatedAt: Date.now() },
  { id: "loc-2", text: "this two", category: 2, updatedAt: Date.now() },
  { id: "loc-3", text: "this three", category: 3, updatedAt: Date.now() },
  { id: "loc-4", text: "this four", category: 4, updatedAt: Date.now() },
  { id: "loc-5", text: "this five", category: 5, updatedAt: Date.now() },
];

// Sync configuration
const SERVER_URL = "https://jsonplaceholder.typicode.com/posts"; // mock source
const SYNC_INTERVAL_MS = 30 * 1000; // 30 seconds

// UI refs (cached after DOM ready)
let quoteDisplay, categoryFilter, importFile, syncBanner, syncMessage, viewConflictsBtn, dismissBannerBtn, conflictModal, conflictList;

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

/* -----------------------
   Category + display logic
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
  if (!categoryFilter) categoryFilter = document.getElementById("categoryFilter");
  const selected = (categoryFilter && categoryFilter.value) ? categoryFilter.value : (localStorage.getItem(FILTER_KEY) || "all");
  const pool = selected !== "all" ? quotes.filter(q => String(q.category) === String(selected)) : quotes.slice();
  if (!pool.length) {
    quoteDisplay.innerHTML = `<em>No quotes in this category.</em>`;
    return;
  }
  const q = pool[Math.floor(Math.random() * pool.length)];
  quoteDisplay.innerHTML = `"${escapeHtml(q.text)}" <br><small>(${escapeHtml(String(q.category))})</small>`;
}

function escapeHtml(s) {
  return ("" + s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
}

/* -----------------------
   Add / Import / Export
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
      // Normalize imported items: ensure id exists (create server-style ids if missing)
      const normalized = imported.map((it, idx) => {
        const base = { text: String(it.text || ""), category: it.category ?? it.cat ?? "imported", updatedAt: Date.now() };
        if (it.id) base.id = it.id;
        else base.id = "srv-imp-" + (Date.now().toString(36) + "-" + idx);
        return base;
      });
      quotes.push(...normalized);
      saveQuotes();
      populateCategories();
      showRandomQuote();
      alert("Imported " + normalized.length + " quotes");
    } catch (err) {
      console.error("Import failed", err);
      alert("Import failed: " + err.message);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

/* -----------------------
   Server sync simulation
   ----------------------- */

/**
 * Fetch server quotes from a mock API and map them into our quote shape.
 * We use JSONPlaceholder posts: map -> { id: 'srv-{id}', text: title, category: userId }
 */
async function fetchServerQuotes() {
  try {
    const res = await fetch(SERVER_URL + "?_limit=20"); // limit to 20 items
    if (!res.ok) throw new Error("Network error: " + res.status);
    const data = await res.json();
    // Map posts to our quote shape
    const serverQuotes = data.map(post => ({
      id: "srv-" + post.id,
      text: post.title,
      category: post.userId,
      updatedAt: Date.now()
    }));
    return serverQuotes;
  } catch (err) {
    console.error("Failed to fetch server quotes:", err);
    return null;
  }
}

/**
 * Merge server data into local 'quotes' array.
 * Strategy: server wins on conflicts (same id but different text/category).
 * - If server has a quote id we don't have locally -> add it.
 * - If server has same id but different content -> it's a conflict: replace local with server (server wins) but record conflict to show UI.
 */
function mergeServerData(serverQuotes) {
  if (!Array.isArray(serverQuotes)) return { added:0, updated:0, conflicts:[] };
  const localById = new Map(quotes.map(q => [q.id, q]));
  const conflicts = [];
  let added = 0, updated = 0;

  serverQuotes.forEach(sq => {
    const local = localById.get(sq.id);
    if (!local) {
      // new server item -> add
      quotes.push(sq);
      added++;
    } else {
      // exists locally -> compare
      if (local.text !== sq.text || String(local.category) !== String(sq.category)) {
        // conflict detected — server takes precedence, but save conflict info for UI
        conflicts.push({ id: sq.id, local: {...local}, server: {...sq} });
        // replace local with server version
        const idx = quotes.findIndex(q => q.id === local.id);
        if (idx !== -1) {
          quotes[idx] = sq;
          updated++;
        }
      }
      // else identical -> no-op
    }
  });

  // Optionally, you might want to detect items that exist locally but were deleted on server. This example leaves them.
  saveQuotes();
  return { added, updated, conflicts };
}

/**
 * Perform a sync: fetch server quotes and merge.
 * If conflicts are found, keep server versions (server wins) but notify the user and allow manual inspection.
 */
async function performSync(showNotification=true) {
  const serverData = await fetchServerQuotes();
  if (!serverData) {
    if (showNotification) showBanner("Sync failed (network).", false);
    return;
  }
  const result = mergeServerData(serverData);
  localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
  populateCategories();
  if (result.added || result.updated) showRandomQuote();
  if (result.conflicts && result.conflicts.length) {
    // notify user and allow them to open conflict modal
    showBanner(`Sync finished: ${result.added} added, ${result.updated} updated. ${result.conflicts.length} conflicts resolved (server won).`, true, result.conflicts);
  } else if (showNotification) {
    showBanner(`Sync finished: ${result.added} added, ${result.updated} updated. No conflicts.`, false);
  }
}

/* -----------------------
   UI: banner + conflict modal
   ----------------------- */

function showBanner(message, hasConflicts=false, conflicts=[]) {
  if (!syncBanner) syncBanner = document.getElementById("syncBanner");
  if (!syncBanner) return;
  syncMessage = document.getElementById("syncMessage");
  viewConflictsBtn = document.getElementById("viewConflictsBtn");
  dismissBannerBtn = document.getElementById("dismissBannerBtn");

  syncMessage.textContent = message;
  syncBanner.style.display = "block";
  viewConflictsBtn.style.display = hasConflicts ? "inline-block" : "none";

  // attach handler to open modal with conflicts if any
  viewConflictsBtn.onclick = () => {
    openConflictModal(conflicts);
  };
  dismissBannerBtn.onclick = () => {
    syncBanner.style.display = "none";
  };
}

function openConflictModal(conflicts) {
  if (!conflictModal) conflictModal = document.getElementById("conflictModal");
  if (!conflictList) conflictList = document.getElementById("conflictList");
  if (!conflictModal || !conflictList) return;

  conflictList.innerHTML = "";
  conflicts.forEach(c => {
    const wrapper = document.createElement("div");
    wrapper.style.borderBottom = "1px solid #eee";
    wrapper.style.padding = "8px 0";
    wrapper.innerHTML = `<strong>ID:</strong> ${escapeHtml(c.id)}<br/>
      <strong>Local:</strong> ${escapeHtml(c.local.text)} (${escapeHtml(String(c.local.category))})<br/>
      <strong>Server:</strong> ${escapeHtml(c.server.text)} (${escapeHtml(String(c.server.category))})`;
    // add per-conflict buttons to pick one
    const keepLocalBtn = document.createElement("button"); keepLocalBtn.textContent = "Keep Local";
    const keepServerBtn = document.createElement("button"); keepServerBtn.textContent = "Keep Server";
    keepLocalBtn.style.marginRight = "8px";
    keepLocalBtn.onclick = () => {
      // revert server overwrite: replace the quote in local storage with local version
      const idx = quotes.findIndex(q => q.id === c.id);
      if (idx !== -1) {
        quotes[idx] = c.local;
        saveQuotes();
        populateCategories();
        showRandomQuote();
        wrapper.style.opacity = "0.5";
      }
    };
    keepServerBtn.onclick = () => {
      // ensure server version is present (already was set during merge, but keep for idempotency)
      const idx = quotes.findIndex(q => q.id === c.id);
      if (idx !== -1) {
        quotes[idx] = c.server;
        saveQuotes();
        populateCategories();
        showRandomQuote();
        wrapper.style.opacity = "0.5";
      }
    };
    wrapper.appendChild(keepLocalBtn);
    wrapper.appendChild(keepServerBtn);
    conflictList.appendChild(wrapper);
  });

  // wire modal-level buttons
  document.getElementById("acceptAllServer").onclick = () => {
    // already applied server wins during merge; just close modal
    alert("Server changes already applied.");
    closeConflictModal();
  };
  document.getElementById("rejectAllServer").onclick = () => {
    // revert all conflicts to their local versions
    conflicts.forEach(c => {
      const idx = quotes.findIndex(q => q.id === c.id);
      if (idx !== -1) quotes[idx] = c.local;
    });
    saveQuotes();
    populateCategories();
    showRandomQuote();
    alert("Local versions restored for conflicts.");
    closeConflictModal();
  };
  document.getElementById("closeConflictModal").onclick = closeConflictModal;

  conflictModal.style.display = "block";
}

function closeConflictModal() {
  if (!conflictModal) conflictModal = document.getElementById("conflictModal");
  if (conflictModal) conflictModal.style.display = "none";
}

/* -----------------------
   Wiring & auto-sync loop
   ----------------------- */

function wireUpUI() {
  quoteDisplay = document.getElementById("quoteDisplay");
  categoryFilter = document.getElementById("categoryFilter");
  importFile = document.getElementById("importFile");
  syncBanner = document.getElementById("syncBanner");
  conflictModal = document.getElementById("conflictModal");
  conflictList = document.getElementById("conflictList");

  document.getElementById("newQuote").addEventListener("click", showRandomQuote);
  document.getElementById("exportQuotes").addEventListener("click", exportToJson);
  document.getElementById("importQuotes").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", importFromJsonFile);
  document.getElementById("syncNow").addEventListener("click", () => performSync(true));
  document.getElementById("viewConflictsBtn")?.addEventListener("click", () => {}); // placeholder
}

async function init() {
  wireUpUI();
  loadQuotesFromStorage();
  populateCategories();
  createAddQuoteForm();
  // restore last selected filter
  const last = localStorage.getItem(FILTER_KEY) || "all";
  if (categoryFilter) categoryFilter.value = last;
  showRandomQuote();

  // initial sync
  await performSync(false);

  // periodic sync loop
  setInterval(() => performSync(true), SYNC_INTERVAL_MS);
}

// Init
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
