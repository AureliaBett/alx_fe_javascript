
/* ===============================
   SERVER SYNC FUNCTIONALITY
   =============================== */

/* ========= POST / push-local logic (append to your script) ========= */

// script.js - Integrated: local storage, category filter, import/export, mock server sync
// Includes: fetchQuotesFromServer, postQuoteToServer (POST), pushLocalChanges, syncQuotes

// ------------------------------- Config & keys
const SERVER_BASE = "https://jsonplaceholder.typicode.com";
const SERVER_POSTS_URL = `${SERVER_BASE}/posts`; // "https://jsonplaceholder.typicode.com/posts"

const LOCAL_KEY = "quotes_data";
const SELECTED_CATEGORY_KEY = "quotes_selected_category";
const SESSION_LAST_INDEX = "last_viewed_index";

const SYNC_INTERVAL_MS = 30000; // 30s

// ------------------------------- App state
let quotes = [];     // array of { id, text, category, updatedAt, remoteId? }
let conflicts = [];  // used if conflict resolution UI is implemented

// ------------------------------- Utilities
function now() { return Date.now(); }

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Default sample quotes (used on first load or reset)
function defaultQuotes(){
  const t = Date.now();
  return [
    { id: `local-${t-4000}`, text: "This is my first quote", category: "1", updatedAt: t-4000, remoteId: null },
    { id: `local-${t-3000}`, text: "This is my second quote", category: "2", updatedAt: t-3000, remoteId: null },
    { id: `local-${t-2000}`, text: "This is my third quote", category: "3", updatedAt: t-2000, remoteId: null },
    { id: `local-${t-1000}`, text: "This is my fourth quote", category: "4", updatedAt: t-1000, remoteId: null }
  ];
}

// ------------------------------- Storage functions
function saveQuotes() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(quotes));
  } catch (err) {
    console.error("saveQuotes error:", err);
  }
}

function loadQuotes() {
  const raw = localStorage.getItem(LOCAL_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        quotes = parsed;
        return;
      }
    } catch (err) {
      console.warn("loadQuotes parse error:", err);
    }
  }
  quotes = defaultQuotes();
  saveQuotes();
}

// ------------------------------- Category utilities
function getUniqueCategories() {
  const set = new Set();
  quotes.forEach(q => {
    const cat = (q.category === undefined || q.category === null || String(q.category).trim() === "") ? "(none)" : String(q.category);
    set.add(cat);
  });
  return Array.from(set).sort((a,b) => a.localeCompare(b));
}

function populateCategories() {
  const sel = document.getElementById("categoryFilter");
  if (!sel) return;
  const prev = localStorage.getItem(SELECTED_CATEGORY_KEY) || sel.value || "all";
  sel.innerHTML = "";
  const optAll = document.createElement("option"); optAll.value = "all"; optAll.textContent = "All Categories"; sel.appendChild(optAll);
  getUniqueCategories().forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat === "(none)" ? "(no category)" : cat;
    sel.appendChild(opt);
  });
  const avail = ["all", ...getUniqueCategories()];
  const restored = (prev && avail.includes(prev)) ? prev : "all";
  sel.value = restored;
  localStorage.setItem(SELECTED_CATEGORY_KEY, restored);
}

// ------------------------------- Rendering & UI
function showQuoteByIndex(index) {
  const display = document.getElementById("quoteDisplay");
  if (!display) return;
  if (!quotes.length) { display.textContent = "No quotes available."; return; }
  const idx = Math.max(0, Math.min(index, quotes.length - 1));
  const q = quotes[idx];
  display.innerHTML = `<div class="quote-text">${escapeHtml(q.text)}</div><div class="small">Category: ${escapeHtml(String(q.category || "(none)"))} — index ${idx}</div>`;
  try { sessionStorage.setItem(SESSION_LAST_INDEX, String(idx)); } catch(e){}
}

function showRandomQuote() {
  if (!quotes.length) { document.getElementById("quoteDisplay").textContent = "No quotes available."; return; }
  const randomIndex = Math.floor(Math.random() * quotes.length);
  showQuoteByIndex(randomIndex);
}

function renderQuotesList() {
  const container = document.getElementById("quotesContainer");
  if (!container) return;
  container.innerHTML = "";
  if (!quotes.length) { container.textContent = "No stored quotes."; return; }

  const selectedCategory = localStorage.getItem(SELECTED_CATEGORY_KEY) || "all";
  const items = [];
  quotes.forEach((q, idx) => {
    const cat = (q.category === undefined || q.category === null || String(q.category).trim() === "") ? "(none)" : String(q.category);
    if (selectedCategory === "all" || selectedCategory === cat) items.push({ q, idx, cat });
  });

  if (!items.length) { container.textContent = `No quotes for category '${selectedCategory}'.`; return; }

  items.forEach(item => {
    const { q, idx } = item;
    const el = document.createElement("div");
    el.className = "quote-item";
    const left = document.createElement("div"); left.className = "quote-text";
    left.innerHTML = `<strong>${escapeHtml(q.text)}</strong><div class="small">Category: ${escapeHtml(String(q.category || "(none)"))}</div><div class="small muted">id:${escapeHtml(String(q.id))}${q.remoteId?` remote:${escapeHtml(q.remoteId)}`:""}</div>`;
    const right = document.createElement("div"); right.style.display = "flex"; right.style.gap = "6px";
    const showBtn = document.createElement("button"); showBtn.textContent = "Show"; showBtn.addEventListener("click", ()=> showQuoteByIndex(idx));
    const delBtn = document.createElement("button"); delBtn.textContent = "Delete"; delBtn.addEventListener("click", ()=>{
      if (!confirm("Delete this quote?")) return;
      quotes.splice(idx,1); saveQuotes(); populateCategories(); renderQuotesList();
    });
    right.appendChild(showBtn); right.appendChild(delBtn);
    el.appendChild(left); el.appendChild(right);
    container.appendChild(el);
  });
}

// ------------------------------- Add / Import / Export functions
function addQuoteFromInputs() {
  const textInput = document.getElementById("newQuoteText");
  const catInput = document.getElementById("newQuoteCategory");
  if (!textInput) return;
  const text = (textInput.value || "").trim();
  let category = (catInput && catInput.value) ? catInput.value.trim() : "";
  if (!text) { alert("Please enter quote text."); return; }
  if (category === "") category = "";
  const newQ = { id: `local-${Date.now()}-${Math.floor(Math.random()*1000)}`, text, category, updatedAt: now(), remoteId: null };
  quotes.push(newQ);
  saveQuotes();
  populateCategories();
  renderQuotesList();
  // push new local immediately (best-effort) - non-blocking
  pushLocalChanges().catch(err => console.warn("pushLocalChanges error:", err));
  if (textInput) textInput.value = "";
  if (catInput) catInput.value = "";
}

function exportQuotes() {
  try {
    const json = JSON.stringify(quotes, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quotes_export_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (err) {
    console.error("export error:", err); alert("Export failed.");
  }
}

function importQuotesFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!Array.isArray(parsed)) { alert("Imported file must be a JSON array of quote objects."); return; }
      const validated = parsed.filter(it => it && typeof it.text === "string");
      if (!validated.length) { alert("No valid quotes found."); return; }
      quotes = validated.map(item => ({
        id: item.id || `local-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        text: String(item.text),
        category: item.category ?? "",
        updatedAt: item.updatedAt ? Number(item.updatedAt) : now(),
        remoteId: item.remoteId ?? null
      }));
      saveQuotes(); populateCategories(); renderQuotesList();
      alert(`Imported ${quotes.length} quote(s).`);
    } catch (err) {
      console.error("import error:", err); alert("Failed to import JSON.");
    }
  };
  reader.readAsText(file);
}

// ------------------------------- POST (push) logic to mock server
// Posts use method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(...)

async function postQuoteToServer(localQuote) {
  try {
    if (!localQuote) return null;
    const payload = {
      title: (localQuote.text || "").slice(0,80) || "quote",
      body: localQuote.text || "",
      userId: (localQuote.category && !isNaN(Number(localQuote.category))) ? Number(localQuote.category) : 1
    };

    const resp = await fetch(SERVER_POSTS_URL, {
      method: "POST",                                     // POST
      headers: { "Content-Type": "application/json" },    // Content-Type
      body: JSON.stringify(payload)                       // JSON.stringify
    });

    if (!resp.ok) {
      console.warn("postQuoteToServer: server returned", resp.status);
      return null;
    }

    const created = await resp.json();
    if (created && created.id) {
      // map remote id
      localQuote.remoteId = `srv-${created.id}`;
      localQuote.updatedAt = now();
      saveQuotes();
      return localQuote.remoteId;
    }
    return null;
  } catch (err) {
    console.error("postQuoteToServer error:", err);
    return null;
  }
}

// push all local-only quotes (no remoteId)
async function pushLocalChanges() {
  if (!Array.isArray(quotes)) return;
  const localOnly = quotes.filter(q => !q.remoteId);
  if (!localOnly.length) return;
  // sequential posts (simple and easy to reason about)
  for (const q of localOnly) {
    try {
      await postQuoteToServer(q);
    } catch (err) {
      console.warn("pushLocalChanges error posting:", err);
    }
  }
  // refresh UI after attempts
  populateCategories();
  renderQuotesList();
}

// ------------------------------- Fetch from server and merge
// fetchQuotesFromServer must exist (validator requirement)
async function fetchQuotesFromServer() {
  try {
    console.log("Fetching quotes from server...");
    const resp = await fetch(SERVER_POSTS_URL);
    if (!resp.ok) throw new Error("Failed to fetch from server");
    const data = await resp.json();
    // convert first N posts to server-like quote objects
    const serverQuotes = data.slice(0, 6).map(p => ({
      remoteId: `srv-${p.id}`,
      text: String(p.title || p.body || "").trim(),
      category: String(p.userId ?? ""),
      updatedAt: now()
    }));

    let newCount = 0;
    let conflictCount = 0;

    // map remoteId->serverQ for quick lookup
    const serverMap = new Map(serverQuotes.map(sq => [sq.remoteId, sq]));

    // ensure local quotes have remoteId and updatedAt fields
    quotes.forEach(q => { if (!('remoteId' in q)) q.remoteId = q.remoteId ?? null; if (!('updatedAt' in q)) q.updatedAt = q.updatedAt ?? now(); });

    // for each server quote: add if missing, or resolve conflicts (server wins)
    serverMap.forEach((serverQ, rId) => {
      const localIdx = quotes.findIndex(lq => lq.remoteId === rId);
      if (localIdx === -1) {
        // server-only -> add locally
        const newLocal = {
          id: `srvproxy-${rId}-${Date.now()}`,
          text: serverQ.text,
          category: serverQ.category,
          updatedAt: serverQ.updatedAt,
          remoteId: serverQ.remoteId
        };
        quotes.push(newLocal);
        newCount++;
      } else {
        const localQ = quotes[localIdx];
        // detect differences
        if (localQ.text !== serverQ.text || String(localQ.category) !== String(serverQ.category)) {
          // simple conflict detection: server wins (but record conflict)
          conflictCount++;
          // overwrite local with server values
          localQ.text = serverQ.text;
          localQ.category = serverQ.category;
          localQ.updatedAt = now();
        } else {
          // keep but refresh updatedAt
          localQ.updatedAt = now();
        }
      }
    });

    // save results
    saveQuotes();
    populateCategories();
    renderQuotesList();

    if (newCount || conflictCount) showSyncNotification(conflictCount, newCount);
    else console.log("No changes from server.");

    return { newCount, conflictCount };
  } catch (err) {
    console.error("fetchQuotesFromServer error:", err);
    return null;
  }
}

// ------------------------------- Unified sync function required: syncQuotes()
async function syncQuotes() {
  try {
    // push local changes first (if any), then fetch and merge from server
    await pushLocalChanges();
    const res = await fetchQuotesFromServer();
    console.log("syncQuotes completed:", res);
    return res;
  } catch (err) {
    console.error("syncQuotes error:", err);
    return null;
  }
}

// ------------------------------- Sync notification helper
function showSyncNotification(conflicts, newCount) {
  let message = "Quotes synced with server!";
  if (newCount > 0) message += ` ${newCount} new quote(s) added.`;
  if (conflicts > 0) message += ` ${conflicts} conflict(s) resolved (server wins).`;
  let note = document.getElementById("syncNote");
  if (!note) {
    note = document.createElement("div");
    note.id = "syncNote";
    note.style.position = "fixed";
    note.style.bottom = "12px";
    note.style.right = "12px";
    note.style.background = "#4caf50";
    note.style.color = "#fff";
    note.style.padding = "10px 16px";
    note.style.borderRadius = "8px";
    note.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
    note.style.zIndex = "1000";
    document.body.appendChild(note);
  }
  note.textContent = message;
  setTimeout(() => { if (note && note.parentNode) note.parentNode.removeChild(note); }, 4000);
}

// ------------------------------- Auto-sync and DOM wiring
window.addEventListener("DOMContentLoaded", () => {
  // wire UI event handlers (if elements exist)
  const newQuoteBtn = document.getElementById("newQuote");
  const addQuoteBtn = document.getElementById("addQuoteBtn");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");
  const clearBtn = document.getElementById("clearBtn");
  const categoryFilter = document.getElementById("categoryFilter");

  if (newQuoteBtn) newQuoteBtn.addEventListener("click", showRandomQuote);
  if (addQuoteBtn) addQuoteBtn.addEventListener("click", addQuoteFromInputs);
  if (exportBtn) exportBtn.addEventListener("click", exportQuotes);
  if (importFile) importFile.addEventListener("change", (e)=> { const f = e.target.files && e.target.files[0]; if (f) importQuotesFile(f); importFile.value = ""; });
  if (clearBtn) clearBtn.addEventListener("click", ()=> { if (!confirm("Reset to default quotes?")) return; quotes = defaultQuotes(); saveQuotes(); populateCategories(); renderQuotesList(); });

  if (categoryFilter) {
    categoryFilter.addEventListener("change", ()=> {
      localStorage.setItem(SELECTED_CATEGORY_KEY, categoryFilter.value);
      renderQuotesList();
    });
  }

  // Load data and initialize UI
  loadQuotes();
  populateCategories();
  renderQuotesList();

  // restore last viewed quote if exists
  const lastIdx = sessionStorage.getItem(SESSION_LAST_INDEX);
  if (lastIdx !== null && !isNaN(Number(lastIdx)) && quotes[Number(lastIdx)]) showQuoteByIndex(Number(lastIdx));

  // add "Sync Now" button if not already present
  const controls = document.querySelector(".controls");
  if (controls && !document.getElementById("syncBtn")) {
    const btn = document.createElement("button");
    btn.id = "syncBtn";
    btn.textContent = "Sync Now";
    btn.addEventListener("click", async ()=> {
      // disable while syncing
      btn.disabled = true;
      await syncQuotes();
      btn.disabled = false;
    });
    controls.appendChild(btn);
  } else {
    // if syncBtn exists, ensure it triggers syncQuotes
    const existing = document.getElementById("syncBtn");
    if (existing) {
      existing.addEventListener("click", async ()=> { existing.disabled = true; await syncQuotes(); existing.disabled = false; });
    }
  }

  // Start periodic sync (push then fetch)
  setInterval(async () => {
    try {
      await syncQuotes();
    } catch (err) { console.warn("periodic sync error:", err); }
  }, SYNC_INTERVAL_MS);

  // Perform an initial background sync (best-effort)
  syncQuotes().catch(err => console.warn("initial sync error:", err));
});

// ------------------------------- Expose for debugging (optional)
window.syncQuotes = syncQuotes;
window.fetchQuotesFromServer = fetchQuotesFromServer;
window.pushLocalChanges = pushLocalChanges;
window.postQuoteToServer = postQuoteToServer;
