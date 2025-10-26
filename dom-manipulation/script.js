
// ------------------------------- Keys & state
const LOCAL_KEY = "quotes_data";                 // localStorage key for quotes array
const SESSION_LAST_INDEX = "last_viewed_index";  // sessionStorage key for last viewed quote index
const SELECTED_CATEGORY_KEY = "quotes_selected_category"; // localStorage key for last selected category filter
const SYNC_META_KEY = "quotes_sync_meta";        // optionally store metadata like last sync time

let quotes = [];               // array of quote objects
let conflicts = [];            // detected conflicts during last sync (objects)
let autoSyncInterval = null;   // interval id for auto sync
const SYNC_INTERVAL_MS = 30000; // 30 seconds auto-sync (adjust as desired)

// Mock server API base (JSONPlaceholder used as demo)
const SERVER_BASE = "https://jsonplaceholder.typicode.com";

// ------------------------------- Utilities & defaults
function defaultQuotes(){
  return [
    { id: `local-${Date.now()-3000}`, text: "This is my first quote", category: "1", updatedAt: Date.now()-3000 },
    { id: `local-${Date.now()-2000}`, text: "This is my second quote", category: "2", updatedAt: Date.now()-2000 },
    { id: `local-${Date.now()-1500}`, text: "This is my third quote", category: "3", updatedAt: Date.now()-1500 },
    { id: `local-${Date.now()-1000}`, text: "This is my fourth quote", category: "4", updatedAt: Date.now()-1000 }
  ];
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

// ------------------------------- Storage functions
function saveQuotes(){
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(quotes));
  } catch (err) {
    console.error("Failed saving quotes:", err);
  }
}

function loadQuotes(){
  const stored = localStorage.getItem(LOCAL_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) { quotes = parsed; return; }
    } catch (err) { console.warn("Could not parse stored quotes:", err); }
  }
  quotes = defaultQuotes();
  saveQuotes();
}

// ------------------------------- Category/filter utilities
function getUniqueCategories(){
  const set = new Set();
  quotes.forEach(q => {
    const cat = (q.category === undefined || q.category === null || String(q.category).trim() === "") ? "(none)" : String(q.category);
    set.add(cat);
  });
  return Array.from(set).sort((a,b) => a.localeCompare(b));
}

function populateCategories(){
  const select = document.getElementById("categoryFilter");
  if (!select) return;
  const current = localStorage.getItem(SELECTED_CATEGORY_KEY) || select.value || "all";
  select.innerHTML = "";
  const allOpt = document.createElement("option"); allOpt.value="all"; allOpt.textContent="All Categories"; select.appendChild(allOpt);
  getUniqueCategories().forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = (cat === "(none)") ? "(no category)" : cat;
    select.appendChild(opt);
  });
  const available = ["all", ...getUniqueCategories()];
  const restored = (current && available.includes(current)) ? current : "all";
  select.value = restored;
  localStorage.setItem(SELECTED_CATEGORY_KEY, restored);
}

// ------------------------------- UI rendering
function showQuoteByIndex(index){
  const display = document.getElementById("quoteDisplay");
  if (!quotes.length) { display.textContent = "No quotes available."; return; }
  const idx = Math.max(0, Math.min(index, quotes.length - 1));
  const q = quotes[idx];
  display.innerHTML = `<div class="quote-text">${escapeHtml(q.text)}</div><div class="small">Category: ${escapeHtml(String(q.category || "(none)"))} — index ${idx}</div>`;
  try { sessionStorage.setItem(SESSION_LAST_INDEX, String(idx)); } catch (err){}
}

function showRandomQuote(){
  if (!quotes.length) { document.getElementById("quoteDisplay").textContent = "No quotes available."; return; }
  const randomIndex = Math.floor(Math.random() * quotes.length);
  showQuoteByIndex(randomIndex);
}

function renderQuotesList(){
  const container = document.getElementById("quotesContainer");
  container.innerHTML = "";
  if (!quotes.length) { container.textContent = "No stored quotes."; return; }

  const selectedCategory = localStorage.getItem(SELECTED_CATEGORY_KEY) || "all";
  const toDisplay = [];
  quotes.forEach((q,idx) => {
    const cat = (q.category === undefined || q.category === null || String(q.category).trim() === "") ? "(none)" : String(q.category);
    if (selectedCategory === "all" || selectedCategory === cat) toDisplay.push({ q, idx, cat });
  });

  if (!toDisplay.length) { container.textContent = `No quotes for category '${selectedCategory}'.`; return; }

  toDisplay.forEach(item => {
    const { q, idx } = item;
    const el = document.createElement("div"); el.className = "quote-item";
    const left = document.createElement("div"); left.className = "quote-text";
    left.innerHTML = `<strong>${escapeHtml(q.text)}</strong><div class="small">Category: ${escapeHtml(String(q.category || "(none)"))}</div><div class="muted">id:${escapeHtml(String(q.id))} updated:${new Date(q.updatedAt).toLocaleString()}</div>`;
    const right = document.createElement("div"); right.style.display = "flex"; right.style.gap="6px";
    const showBtn = document.createElement("button"); showBtn.textContent="Show"; showBtn.addEventListener("click", ()=>showQuoteByIndex(idx));
    const delBtn = document.createElement("button"); delBtn.textContent="Delete"; delBtn.addEventListener("click", ()=>{
      if (!confirm("Delete this quote?")) return;
      quotes.splice(idx,1); saveQuotes(); populateCategories(); renderQuotesList();
    });
    right.appendChild(showBtn); right.appendChild(delBtn);
    el.appendChild(left); el.appendChild(right);
    container.appendChild(el);
  });
}

// ------------------------------- Add / import / export
function addQuoteFromInputs(){
  const txt = (document.getElementById("newQuoteText").value || "").trim();
  let cat = (document.getElementById("newQuoteCategory").value || "").trim();
  if (!txt) { alert("Please enter quote text."); return; }
  if (cat === "") cat = "";
  const q = { id: `local-${Date.now()}-${Math.floor(Math.random()*1000)}`, text: txt, category: cat, updatedAt: Date.now(), remoteId: null };
  quotes.push(q);
  saveQuotes();
  populateCategories();
  renderQuotesList();
  // schedule push of local changes to server
  pushLocalChanges();
  document.getElementById("newQuoteText").value=""; document.getElementById("newQuoteCategory").value="";
}

function exportQuotes(){
  try {
    const json = JSON.stringify(quotes, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quotes_export_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (err) { console.error("Export failed:",err); alert("Could not export quotes."); }
}

function importQuotesFile(file){
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e)=>{
    try {
      const parsed = JSON.parse(e.target.result);
      if (!Array.isArray(parsed)) { alert("Imported file must be a JSON array of quote objects."); return; }
      const validated = parsed.filter(it => it && typeof it.text === "string");
      if (!validated.length) { alert("No valid quotes found in file."); return; }
      // Map imported objects to our internal format (keep id if present)
      quotes = validated.map(item => ({
        id: item.id || `local-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        text: String(item.text),
        category: item.category ?? "",
        updatedAt: item.updatedAt ? Number(item.updatedAt) : Date.now(),
        remoteId: item.remoteId ?? item.remoteId ?? null
      }));
      saveQuotes(); populateCategories(); renderQuotesList(); alert(`Imported ${quotes.length} quote(s).`);
    } catch (err) { console.error(err); alert("Failed to import JSON."); }
  };
  reader.readAsText(file);
}

// ------------------------------- Server sync (mocked via JSONPlaceholder)
// Notes:
// - JSONPlaceholder does not really store our data; it is only used to simulate network calls.
// - We map server posts -> quotes with remoteId = "srv-{post.id}".
// - For real server integration, use your server's quotes endpoint and IDs.

async function fetchServerQuotes(limit = 6){
  try {
    const resp = await fetch(`${SERVER_BASE}/posts?_limit=${limit}`);
    if (!resp.ok) throw new Error("Server fetch failed");
    const posts = await resp.json();
    // map posts -> server quote objects
    const serverQuotes = posts.map(p => ({
      remoteId: `srv-${p.id}`,
      text: `${p.title}`.trim(),
      category: String(p.userId ?? ""),
      updatedAt: Date.now() // treat server-provided as just-updated for demo
    }));
    return serverQuotes;
  } catch (err) {
    console.warn("Server fetch failed:", err);
    return null; // caller will handle fallback
  }
}

// push local quotes that have no remoteId to server (simulate creating them)
async function pushLocalChanges(){
  // collect local-only quotes
  const localOnly = quotes.filter(q => !q.remoteId);
  if (!localOnly.length) return;
  for (const q of localOnly) {
    try {
      const payload = { title: q.text.slice(0,40) || "quote", body: q.text, userId: (q.category && Number(q.category)) ? Number(q.category) : 1 };
      const resp = await fetch(`${SERVER_BASE}/posts`, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) { console.warn("Push failed for", q); continue; }
      const created = await resp.json();
      // JSONPlaceholder returns an id (doesn't persist), we map it to remoteId
      q.remoteId = `srv-${created.id}`;
      // Option: update id mapping to keep stable id or keep both
      saveQuotes();
    } catch (err) { console.warn("Push error:", err); }
  }
}

// main sync: fetch server quotes, compare with local, merge and detect conflicts
async function syncWithServer({ autoResolveServerWins = true } = {}){
  // update UI status
  setSyncStatus("syncing...");
  const serverQuotes = await fetchServerQuotes(6);
  if (!serverQuotes) { setSyncStatus("sync failed (no server)"); return; }

  // create a simple map remoteId -> serverQ
  const serverMap = new Map(serverQuotes.map(sq => [sq.remoteId, sq]));

  // Step 1: merge server quotes into local storage.
  // Strategy: server wins. If a remoteId matches a local quote and the text differs and local.updatedAt > server.updatedAt -> conflict.
  // If conflict found, depending on autoResolveServerWins, either accept server (replace local) or add to conflicts list for manual resolution.

  conflicts = []; // reset

  // ensure we have remoteId fields for local quotes (null by default)
  quotes.forEach(q => { if (!('remoteId' in q)) q.remoteId = null; if (!('updatedAt' in q)) q.updatedAt = Date.now(); });

  // 1.a For each server quote:
  serverMap.forEach((serverQ, remoteId) => {
    // try find local with same remoteId
    const localIdx = quotes.findIndex(lq => lq.remoteId === remoteId);
    if (localIdx === -1) {
      // server has new quote we don't have locally -> add it
      const newLocal = { id: `srvproxy-${remoteId}-${Date.now()}`, text: serverQ.text, category: serverQ.category, updatedAt: serverQ.updatedAt, remoteId: remoteId };
      quotes.push(newLocal);
    } else {
      // we have same remote id, check for differences
      const localQ = quotes[localIdx];
      if (localQ.text !== serverQ.text || String(localQ.category) !== String(serverQ.category)) {
        // conflict if local appears newer than server
        const localNewer = (localQ.updatedAt && localQ.updatedAt > (serverQ.updatedAt || 0));
        if (localNewer && !autoResolveServerWins) {
          conflicts.push({ remoteId, local: { ...localQ }, server: { ...serverQ }, localIdx });
        } else {
          // server wins: overwrite local
          quotes[localIdx] = { ...localQ, text: serverQ.text, category: serverQ.category, updatedAt: Date.now(), remoteId };
        }
      } else {
        // no difference — but update timestamps to server's to keep in sync
        quotes[localIdx].updatedAt = Date.now();
      }
    }
  });

  // Step 1.b: Optionally, push local-only quotes to server
  await pushLocalChanges();

  // Save merged results
  saveQuotes();
  populateCategories();
  renderQuotesList();

  // update conflict UI
  if (conflicts.length) {
    showConflictsPanel();
  } else {
    hideConflictsPanel();
  }

  setSyncStatus(`last sync: ${new Date().toLocaleString()} (${conflicts.length} conflict${conflicts.length===1?'':'s'})`);
  updateConflictCount(conflicts.length);
}

// ------------------------------- UI: sync status & conflict panel
function setSyncStatus(text){
  const el = document.getElementById("syncStatus");
  if (el) el.textContent = text;
}

function updateConflictCount(n){
  const badge = document.getElementById("conflictCount");
  if (!badge) return;
  if (n>0) { badge.style.display = "inline-block"; badge.textContent = `${n} conflict${n===1?'':'s'}`; }
  else badge.style.display = "none";
}

function showConflictsPanel(){
  const panel = document.getElementById("conflictPanel");
  const list = document.getElementById("conflictList");
  if (!panel || !list) return;
  panel.style.display = "block";
  list.innerHTML = "";
  conflicts.forEach((c, idx) => {
    const item = document.createElement("div"); item.className = "conflict-item";
    item.innerHTML = `<div><strong>Server:</strong> ${escapeHtml(c.server.text)}<br/><span class="small">cat: ${escapeHtml(c.server.category)}</span></div>
                      <div style="margin-top:6px"><strong>Local:</strong> ${escapeHtml(c.local.text)}<br/><span class="small">cat: ${escapeHtml(c.local.category)}</span></div>`;
    const btns = document.createElement("div"); btns.className = "conflict-buttons";
    const acceptServer = document.createElement("button"); acceptServer.textContent="Accept server"; acceptServer.addEventListener("click", ()=>{
      // accept server: overwrite local
      if (typeof c.localIdx === "number" && quotes[c.localIdx]) {
        quotes[c.localIdx].text = c.server.text;
        quotes[c.localIdx].category = c.server.category;
        quotes[c.localIdx].updatedAt = Date.now();
        quotes[c.localIdx].remoteId = c.remoteId;
        saveQuotes(); populateCategories(); renderQuotesList();
        // remove this conflict entry and update UI
        conflicts.splice(idx,1); showConflictsPanel(); updateConflictCount(conflicts.length);
      }
    });
    const keepLocal = document.createElement("button"); keepLocal.textContent="Keep local (override server)"; keepLocal.addEventListener("click", async ()=>{
      // keep local: push local value back to server (simulate via POST)
      const localQ = c.local;
      try {
        const payload = { title: localQ.text.slice(0,40) || "quote", body: localQ.text, userId: (localQ.category && Number(localQ.category)) ? Number(localQ.category) : 1 };
        const resp = await fetch(`${SERVER_BASE}/posts`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
        const created = await resp.json();
        // map this local to the returned server id
        if (created && created.id) {
          if (quotes[c.localIdx]) { quotes[c.localIdx].remoteId = `srv-${created.id}`; quotes[c.localIdx].updatedAt = Date.now(); saveQuotes(); populateCategories(); renderQuotesList(); }
        }
        // remove conflict
        conflicts.splice(idx,1); showConflictsPanel(); updateConflictCount(conflicts.length);
        alert("Kept local value and pushed to server (simulated).");
      } catch (err) { console.warn("Could not push decision to server:", err); alert("Failed to push to server (simulation)."); }
    });
    btns.appendChild(acceptServer); btns.appendChild(keepLocal);
    item.appendChild(btns);
    list.appendChild(item);
  });
  updateConflictCount(conflicts.length);
  if (!conflicts.length) hideConflictsPanel();
}

function hideConflictsPanel(){ const panel = document.getElementById("conflictPanel"); if (panel) panel.style.display="none"; }

// ------------------------------- Controls: auto-sync toggling & manual sync
function enableAutoSync(enable){
  if (autoSyncInterval) { clearInterval(autoSyncInterval); autoSyncInterval = null; }
  if (enable) {
    autoSyncInterval = setInterval(()=> syncWithServer({ autoResolveServerWins: true }), SYNC_INTERVAL_MS);
  }
}

// ------------------------------- Initialization & event wiring
window.addEventListener("DOMContentLoaded", () => {
  // elements
  const newQuoteBtn = document.getElementById("newQuote");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");
  const addQuoteBtn = document.getElementById("addQuoteBtn");
  const clearBtn = document.getElementById("clearBtn");
  const categoryFilter = document.getElementById("categoryFilter");
  const syncNowBtn = document.getElementById("syncNowBtn");
  const autoSyncToggle = document.getElementById("autoSyncToggle");
  const closeConflictsBtn = document.getElementById("closeConflicts");
  const resolveAllServerBtn = document.getElementById("resolveAllServer");

  // load initial data
  loadQuotes();
  populateCategories();
  renderQuotesList();

  // restore last viewed quote if present
  const lastIdx = sessionStorage.getItem(SESSION_LAST_INDEX);
  if (lastIdx !== null && !isNaN(Number(lastIdx)) && quotes[Number(lastIdx)]) showQuoteByIndex(Number(lastIdx));

  // events
  newQuoteBtn.addEventListener("click", showRandomQuote);
  addQuoteBtn.addEventListener("click", addQuoteFromInputs);
  exportBtn.addEventListener("click", exportQuotes);
  importFile.addEventListener("change", (ev) => { const f = ev.target.files && ev.target.files[0]; if (f) { importQuotesFile(f); importFile.value=""; } });
  clearBtn.addEventListener("click", ()=>{
    if (!confirm("Reset to default quotes? This overwrites current local store.")) return;
    quotes = defaultQuotes(); saveQuotes(); populateCategories(); renderQuotesList();
  });
  categoryFilter.addEventListener("change", filterQuotes);

  // sync control events
  syncNowBtn.addEventListener("click", ()=> syncWithServer({ autoResolveServerWins: true }));
  autoSyncToggle.addEventListener("change", (e)=> enableAutoSync(e.target.checked));
  // conflict panel buttons
  document.getElementById("closeConflicts").addEventListener("click", ()=> hideConflictsPanel());
  document.getElementById("resolveAllServer").addEventListener("click", ()=>{
    // accept server for every conflict
    conflicts.forEach(c => {
      if (typeof c.localIdx === "number" && quotes[c.localIdx]) {
        quotes[c.localIdx].text = c.server.text; quotes[c.localIdx].category = c.server.category; quotes[c.localIdx].updatedAt = Date.now(); quotes[c.localIdx].remoteId = c.remoteId;
      }
    });
    conflicts = []; saveQuotes(); populateCategories(); renderQuotesList(); hideConflictsPanel(); updateConflictCount(0);
    alert("All conflicts accepted (server wins).");
  });

  // start auto-sync if enabled default state
  enableAutoSync(autoSyncToggle.checked);
  // initial sync on load (don't block UI)
  syncWithServer({ autoResolveServerWins: true });
});

// ------------------------------- Helper: filter handling (called from HTML inline)
function filterQuotes(){
  const select = document.getElementById("categoryFilter");
  if (!select) return;
  localStorage.setItem(SELECTED_CATEGORY_KEY, select.value);
  renderQuotesList();
}

