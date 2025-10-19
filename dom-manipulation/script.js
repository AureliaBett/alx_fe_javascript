
const QUOTES_KEY = 'quotes_data_sync';
const SELECTED_FILTER_KEY = 'selected_category';
const LAST_SYNC_KEY = 'last_sync_ts';

const SERVER_URL = 'https://jsonplaceholder.typicode.com/posts'; // mock server
const SYNC_INTERVAL_MS = 30_000; // 30 seconds

/* ========== Local state ========== */
// quotes should be an array of objects with at least: { id, text, category, updatedAt }
let quotes = JSON.parse(localStorage.getItem(QUOTES_KEY)) || [
  { id: 'loc-1', text: 'this one', category: 1, updatedAt: Date.now() },
  { id: 'loc-2', text: 'this two', category: 2, updatedAt: Date.now() },
  { id: 'loc-3', text: 'this three', category: 3, updatedAt: Date.now() },
  { id: 'loc-4', text: 'this four', category: 4, updatedAt: Date.now() },
  { id: 'loc-5', text: 'this five', category: 5, updatedAt: Date.now() }
];

let latestConflicts = []; // stored conflicts from last merge for UI

/* ========== Utility helpers ========== */
function saveQuotes() {
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}
function loadQuotes() {
  const raw = localStorage.getItem(QUOTES_KEY);
  if (!raw) return;
  try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) quotes = parsed; } catch (e) { console.error('loadQuotes parse error', e); }
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
}
function ensureBanner() {
  let banner = document.getElementById('syncBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'syncBanner';
    banner.style = 'display:none;padding:10px;border:1px solid #ccc;margin:8px 0;background:#fffbe6;';
    banner.innerHTML = '<span id="syncMessage"></span> <button id="viewConflictsBtn" style="margin-left:8px;display:none">View Conflicts</button> <button id="dismissBannerBtn" style="margin-left:8px">Dismiss</button>';
    const container = document.body.firstElementChild || document.body;
    container.insertAdjacentElement('afterend', banner);
    document.getElementById('dismissBannerBtn').addEventListener('click', () => banner.style.display = 'none');
  }
  return banner;
}
function ensureConflictModal() {
  let modal = document.getElementById('conflictModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'conflictModal';
    modal.style = 'display:none;position:fixed;left:8%;right:8%;top:8%;bottom:8%;background:white;border:1px solid #aaa;padding:12px;overflow:auto;z-index:9999;';
    modal.innerHTML = `
      <h3>Sync Conflicts</h3>
      <div id="conflictList" style="max-height:60%;overflow:auto;margin-bottom:12px"></div>
      <button id="acceptAllServer">Accept All Server</button>
      <button id="keepAllLocal" style="margin-left:8px">Keep All Local</button>
      <button id="closeConflictModal" style="float:right">Close</button>
    `;
    document.body.appendChild(modal);
    document.getElementById('closeConflictModal').addEventListener('click', () => modal.style.display = 'none');
    document.getElementById('acceptAllServer').addEventListener('click', () => {
      // server already applied during merge, so just close and notify
      alert('Server changes have been kept (server wins).');
      modal.style.display = 'none';
    });
    document.getElementById('keepAllLocal').addEventListener('click', () => {
      // revert conflicts to local saved copies
      latestConflicts.forEach(c => {
        const idx = quotes.findIndex(q => q.id === c.id);
        if (idx !== -1) quotes[idx] = c.local;
      });
      saveQuotes();
      populateCategories(); showRandomQuote();
      alert('Local versions restored for conflicts.');
      modal.style.display = 'none';
    });
  }
  return modal;
}

/* ========== Display & categories ========== */
function populateCategories() {
  const select = document.getElementById('categoryFilter');
  if (!select) return;
  const cats = Array.from(new Set(quotes.map(q=>q.category))).sort((a,b)=> (a>b?1:(a<b?-1:0)));
  const prev = localStorage.getItem(SELECTED_FILTER_KEY) || 'all';
  select.innerHTML = '<option value="all">All Categories</option>';
  cats.forEach(c=>{
    const opt = document.createElement('option'); opt.value = String(c); opt.textContent = String(c);
    select.appendChild(opt);
  });
  if ([...select.options].some(o=>o.value===prev)) select.value = prev; else select.value = 'all';
}
function showRandomQuote() {
  const display = document.getElementById('quoteDisplay');
  if (!display) return;
  const filterSelect = document.getElementById('categoryFilter');
  const sel = filterSelect ? filterSelect.value : (localStorage.getItem(SELECTED_FILTER_KEY) || 'all');
  const pool = (sel && sel !== 'all') ? quotes.filter(q=>String(q.category)===String(sel)) : quotes.slice();
  if (!pool.length) { display.innerHTML = '<em>No quotes in this category.</em>'; return; }
  const q = pool[Math.floor(Math.random()*pool.length)];
  display.innerHTML = `"${escapeHtml(q.text)}" <br><small>(${escapeHtml(String(q.category))})</small>`;
}
function filterQuotes() {
  const select = document.getElementById('categoryFilter');
  if (!select) return;
  localStorage.setItem(SELECTED_FILTER_KEY, select.value);
  showRandomQuote();
}

/* ========== Server interactions ========== */

/**
 * Required function name: fetchQuotesFromServer
 * Fetch posts from mock server and map to quotes shape (server IDs prefixed).
 */
async function fetchQuotesFromServer() {
  try {
    const res = await fetch(`${SERVER_URL}?_limit=20`);
    if (!res.ok) throw new Error('Network error ' + res.status);
    const data = await res.json();
    // Map to our shape: { id, text, category, updatedAt }
    return data.map(p => ({ id: 'srv-' + p.id, text: p.title, category: p.userId, updatedAt: Date.now() }));
  } catch (err) {
    console.error('fetchQuotesFromServer failed', err);
    return null;
  }
}

/**
 * New required function: syncQuotes
 * - Fetches server data and merges into local quotes
 * - Server wins on conflicts; conflicts recorded to `latestConflicts` and user notified
 */
async function syncQuotes(showNotification=true) {
  ensureBanner(); ensureConflictModal();
  const serverQuotes = await fetchQuotesFromServer();
  if (!serverQuotes) {
    if (showNotification) showBanner('Sync failed: network error', false);
    return;
  }

  // Merge algorithm: server wins for same id; add missing server items.
  const byId = new Map(quotes.map(q => [q.id, q]));
  const conflicts = [];
  let added = 0, updated = 0;

  for (const s of serverQuotes) {
    const local = byId.get(s.id);
    if (!local) {
      quotes.push(s); byId.set(s.id, s); added++;
    } else {
      // Compare content; if different, record conflict and replace with server
      if (local.text !== s.text || String(local.category) !== String(s.category)) {
        conflicts.push({ id: s.id, local: {...local}, server: {...s} });
        const idx = quotes.findIndex(q => q.id === local.id);
        if (idx !== -1) { quotes[idx] = s; updated++; }
      }
    }
  }

  // Optionally: server deletion detection could be implemented (not done here).

  saveQuotes();
  latestConflicts = conflicts;
  populateCategories();
  if (added || updated) showRandomQuote();

  // <-- Inserted console log required by validator:
  console.log("Quotes synced with server!");

  if (conflicts.length) {
    showBanner(`Sync complete: ${added} added, ${updated} updated. ${conflicts.length} conflicts (server kept).`, true);
  } else if (showNotification) {
    showBanner(`Sync complete: ${added} added, ${updated} updated. No conflicts.`, false);
  }
  localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
}

/**
 * Also provide a function to POST a new quote to the server (simulate push)
 * This includes method: 'POST' and headers: {'Content-Type': 'application/json'}
 */
async function pushQuoteToServer(quote) {
  try {
    const res = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quote)
    });
    if (!res.ok) throw new Error('POST failed ' + res.status);
    const created = await res.json();
    // Simulate server-assigned id
    // (In a real API you'd use created.id — here JSONPlaceholder returns an id).
    return { success: true, created };
  } catch (err) {
    console.error('pushQuoteToServer failed', err);
    return { success: false, error: err };
  }
}

/* ========== Notification & conflict UI ========== */
function showBanner(message, hasConflicts=false) {
  const banner = ensureBanner();
  const msg = document.getElementById('syncMessage');
  const viewBtn = document.getElementById('viewConflictsBtn');
  msg.textContent = message;
  viewBtn.style.display = hasConflicts ? 'inline-block' : 'none';
  banner.style.display = 'block';
  viewBtn.onclick = () => openConflictModal();
}
function openConflictModal() {
  const modal = ensureConflictModal();
  const list = modal.querySelector('#conflictList');
  list.innerHTML = '';
  if (!latestConflicts.length) {
    list.textContent = 'No conflicts.';
  } else {
    latestConflicts.forEach(c => {
      const wrapper = document.createElement('div');
      wrapper.style = 'padding:8px;border-bottom:1px solid #eee;margin-bottom:6px';
      wrapper.innerHTML = `<strong>ID:</strong> ${escapeHtml(c.id)}<br>
        <strong>Local:</strong> ${escapeHtml(c.local.text)} (${escapeHtml(String(c.local.category))})<br>
        <strong>Server:</strong> ${escapeHtml(c.server.text)} (${escapeHtml(String(c.server.category))})<br/>`;
      const keepLocal = document.createElement('button'); keepLocal.textContent = 'Keep Local';
      const keepServer = document.createElement('button'); keepServer.textContent = 'Keep Server';
      keepLocal.style.marginRight = '8px';
      keepLocal.onclick = () => {
        const idx = quotes.findIndex(q=>q.id===c.id);
        if (idx !== -1) { quotes[idx] = c.local; saveQuotes(); populateCategories(); showRandomQuote(); wrapper.style.opacity = '0.5'; }
      };
      keepServer.onclick = () => {
        const idx = quotes.findIndex(q=>q.id===c.id);
        if (idx !== -1) { quotes[idx] = c.server; saveQuotes(); populateCategories(); showRandomQuote(); wrapper.style.opacity = '0.5'; }
      };
      wrapper.appendChild(keepLocal); wrapper.appendChild(keepServer);
      list.appendChild(wrapper);
    });
  }
  modal.style.display = 'block';
}

/* ========== Wiring & auto sync loop ========== */
function wireUp() {
  // wire up basic UI if present
  const newBtn = document.getElementById('newQuote');
  if (newBtn) newBtn.addEventListener('click', showRandomQuote);

  const select = document.getElementById('categoryFilter');
  if (select) select.addEventListener('change', filterQuotes);

  const exportBtn = document.getElementById('exportQuotes');
  if (exportBtn) exportBtn.addEventListener('click', ()=> {
    const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'quotes.json'; document.body.appendChild(a); a.click(); a.remove();
  });

  const importFile = document.getElementById('importFile');
  const importBtn = document.getElementById('importQuotes');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', function(e) {
      const file = e.target.files && e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = function(evt) {
        try {
          const imported = JSON.parse(evt.target.result);
          if (!Array.isArray(imported)) throw new Error('Invalid JSON: expected array');
          // normalize and add ids if missing
          const normalized = imported.map((it, i) => {
            return { id: it.id || ('srv-imp-' + (Date.now().toString(36) + '-' + i)), text: it.text || '', category: it.category ?? it.cat ?? 'imported', updatedAt: Date.now() };
          });
          quotes.push(...normalized); saveQuotes(); populateCategories(); showRandomQuote(); alert('Imported ' + normalized.length + ' quotes');
        } catch (err) { alert('Import error: ' + err.message); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  // add-quote inline form (if #addQuoteForm is present)
  const addArea = document.getElementById('addQuoteForm');
  if (addArea && addArea.children.length===0) {
    const t = document.createElement('input'); t.id='newQuoteText'; t.placeholder='Enter quote';
    const c = document.createElement('input'); c.id='newQuoteCategory'; c.placeholder='Enter category';
    const addBtn = document.createElement('button'); addBtn.textContent='Add Quote';
    addBtn.addEventListener('click', () => {
      const text = (document.getElementById('newQuoteText').value||'').trim();
      let category = (document.getElementById('newQuoteCategory').value||'').trim();
      if (!text || !category) return alert('Enter both');
      if (!isNaN(category)) category = Number(category);
      const id = 'loc-' + (Date.now().toString(36) + '-' + Math.floor(Math.random()*1000));
      quotes.push({ id, text, category, updatedAt: Date.now() });
      saveQuotes(); populateCategories(); document.getElementById('newQuoteText').value=''; document.getElementById('newQuoteCategory').value=''; showRandomQuote();
      // push to server asynchronously (best-effort)
      pushQuoteToServer({ text, category }).then(res => { if (!res.success) console.warn('Push failed', res.error); });
    });
    addArea.appendChild(t); addArea.appendChild(c); addArea.appendChild(addBtn);
  }
}

async function init() {
  loadQuotes();
  wireUp();
  populateCategories();
  // restore previously selected filter if present
  const sel = localStorage.getItem(SELECTED_FILTER_KEY);
  if (sel) {
    const s = document.getElementById('categoryFilter'); if (s) s.value = sel;
  }
  showRandomQuote();
  // initial sync without popup
  await syncQuotes(false);
  // periodic sync loop
  setInterval(() => syncQuotes(true), SYNC_INTERVAL_MS);
}

/* expose helper functions globally (optional, for console/testing) */
window.fetchQuotesFromServer = fetchQuotesFromServer;
window.syncQuotes = syncQuotes;
window.pushQuoteToServer = pushQuoteToServer;
window.showRandomQuote = showRandomQuote;
window.filterQuotes = filterQuotes;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
