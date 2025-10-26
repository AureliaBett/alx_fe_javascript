
/* ===============================
   SERVER SYNC FUNCTIONALITY
   =============================== */

// Mock server API endpoint (using JSONPlaceholder for simulation)
const SERVER_URL = "https://jsonplaceholder.typicode.com/posts";

// Function: Fetch quotes from server (simulated)
async function fetchQuotesFromServer() {
  try {
    console.log("Fetching quotes from server...");
    const response = await fetch(SERVER_URL);
    if (!response.ok) throw new Error("Failed to fetch from server");

    // Simulate server-provided quotes
    const data = await response.json();
    // We'll only take first 5 mock posts and convert them into quote objects
    const serverQuotes = data.slice(0, 5).map(post => ({
      text: post.title,
      category: "Server"
    }));

    const conflicts = [];
    const newQuotes = [];

    // Conflict Resolution: server data takes precedence
    serverQuotes.forEach(serverQuote => {
      const localMatch = quotes.find(q => q.text === serverQuote.text);
      if (localMatch) {
        // If categories differ, note as conflict but replace with server’s data
        if (localMatch.category !== serverQuote.category) {
          conflicts.push({ local: localMatch, server: serverQuote });
        }
        // Replace local with server version
        Object.assign(localMatch, serverQuote);
      } else {
        // Add new quote from server
        quotes.push(serverQuote);
        newQuotes.push(serverQuote);
      }
    });

    saveQuotes();
    populateCategories();
    renderQuotesList();

    if (conflicts.length > 0 || newQuotes.length > 0) {
      showSyncNotification(conflicts.length, newQuotes.length);
    } else {
      console.log("No new updates from server.");
    }

  } catch (err) {
    console.error("Error fetching from server:", err);
  }
}

// Function: Show notification when sync happens
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
  setTimeout(() => note.remove(), 4000);
}

// Add a manual "Sync Now" button (optional)
window.addEventListener("DOMContentLoaded", () => {
  const controls = document.querySelector(".controls");
  if (controls && !document.getElementById("syncBtn")) {
    const syncBtn = document.createElement("button");
    syncBtn.id = "syncBtn";
    syncBtn.textContent = "Sync Now";
    syncBtn.addEventListener("click", fetchQuotesFromServer);
    controls.appendChild(syncBtn);
  }

  // Automatic sync every 30 seconds
  setInterval(fetchQuotesFromServer, 30000);
});
