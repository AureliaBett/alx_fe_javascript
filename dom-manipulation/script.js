
/* ===============================
   SERVER SYNC FUNCTIONALITY
   =============================== */

/* ========= POST / push-local logic (append to your script) ========= */

const SERVER_BASE = "https://jsonplaceholder.typicode.com/posts"; // mock API base

// Post a single local quote to the mock server and update localQuote.remoteId on success
async function postQuoteToServer(localQuote) {
  try {
    const payload = {
      title: (localQuote.text || "").slice(0, 80) || "quote",
      body: localQuote.text || "",
      // use numeric userId if category is numeric, otherwise default 1
      userId: (localQuote.category && !isNaN(Number(localQuote.category))) ? Number(localQuote.category) : 1
    };

    const resp = await fetch(`${SERVER_BASE}/posts`, {
      method: "POST",                                   // <- POST
      headers: { "Content-Type": "application/json" },  // <- Content-Type header
      body: JSON.stringify(payload)                     // <- JSON.stringify payload
    });

    if (!resp.ok) {
      console.warn("Failed to POST quote to server, status:", resp.status);
      return null;
    }

    const created = await resp.json();
    // JSONPlaceholder returns an id (e.g. { id: 101 }), map it into local object
    if (created && created.id) {
      localQuote.remoteId = `srv-${created.id}`;
      localQuote.updatedAt = Date.now();
      // persist update (assumes saveQuotes() exists in your script)
      if (typeof saveQuotes === "function") saveQuotes();
      return localQuote.remoteId;
    } else {
      console.warn("Unexpected server response while posting quote:", created);
      return null;
    }
  } catch (err) {
    console.error("Error posting quote to server:", err);
    return null;
  }
}

// Push all local-only quotes (quotes that lack `remoteId`) to the server
// Posts are performed sequentially to avoid hammering the mock API.
async function pushLocalChanges() {
  try {
    // guard: ensure `quotes` exists and is an array
    if (!Array.isArray(window.quotes)) return;

    const localOnly = quotes.filter(q => !q.remoteId);
    if (!localOnly.length) return;

    for (const q of localOnly) {
      // optional: show some console debug info
      console.log("Pushing local quote to server:", q.text);
      await postQuoteToServer(q);
      // small delay could be added here if you want to throttle
      // await new Promise(r=>setTimeout(r, 120));
    }
    // After push, re-render UI if functions are available
    if (typeof populateCategories === "function") populateCategories();
    if (typeof renderQuotesList === "function") renderQuotesList();
  } catch (err) {
    console.error("Error pushing local changes:", err);
  }
}

/* Hook pushLocalChanges into existing sync behavior:
   - Make "Sync Now" trigger pushLocalChanges() first then fetchQuotesFromServer()
   - Make automatic interval call pushLocalChanges() before fetch
   We add an extra DOMContentLoaded listener so we don't alter your existing listener block.
*/

window.addEventListener("DOMContentLoaded", () => {
  // If a Sync Now button exists (we created it earlier), override its click to push then fetch.
  const syncBtn = document.getElementById("syncBtn") || document.getElementById("syncNowBtn");
  if (syncBtn) {
    // remove previous listener(s) if any, then attach our combined handler
    syncBtn.replaceWith(syncBtn.cloneNode(true));
    const newBtn = document.getElementById("syncBtn") || document.getElementById("syncNowBtn");
    if (newBtn) {
      newBtn.addEventListener("click", async () => {
        await pushLocalChanges();
        if (typeof fetchQuotesFromServer === "function") await fetchQuotesFromServer();
      });
    }
  }

  // Replace your interval with one that pushes first then fetches.
  // Find existing interval usage — since you setInterval(fetchQuotesFromServer, 30000),
  // we'll create our own interval to run pushLocalChanges() then fetchQuotesFromServer().
  setInterval(async () => {
    await pushLocalChanges();
    if (typeof fetchQuotesFromServer === "function") await fetchQuotesFromServer();
  }, 30000);
});
