// -------------------------
// Initial quotes data
// -------------------------
let quotes = JSON.parse(localStorage.getItem("quotes")) || [
  { text: "this one", category: "1" },
  { text: "this two", category: "2" },
  { text: "this three", category: "3" },
  { text: "this four", category: "4" },
  { text: "this five", category: "5" }
];

// -------------------------
// Save quotes to localStorage
// -------------------------
function saveQuotes() {
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

// -------------------------
// Show random quote
// -------------------------
function showRandomQuote() {
  const display = document.getElementById("quoteDisplay");
  const randomIndex = Math.floor(Math.random() * quotes.length);
  const randomQuote = quotes[randomIndex];
  display.innerHTML = `"${randomQuote.text}" <br> <em>(${randomQuote.category})</em>`;
}

// -------------------------
// Add a new quote
// -------------------------
function addQuote() {
  const textInput = document.getElementById("newQuoteText");
  const categoryInput = document.getElementById("newQuoteCategory");

  const text = textInput.value.trim();
  const category = categoryInput.value.trim();

  if (text === "" || category === "") {
    alert("Please enter both a quote and a category.");
    return;
  }

  quotes.push({ text, category });
  saveQuotes();
  populateCategories();

  document.getElementById("quoteDisplay").textContent = `New quote added: "${text}" — (${category})`;

  textInput.value = "";
  categoryInput.value = "";
  syncQuoteToServer({ text, category });
}

// -------------------------
// Create Add Quote Form
// -------------------------
function createAddQuoteForm() {
  const form = document.createElement("div");
  form.id = "addQuoteForm";

  const quoteInput = document.createElement("input");
  quoteInput.id = "newQuoteText";
  quoteInput.type = "text";
  quoteInput.placeholder = "Enter a new quote";

  const categoryInput = document.createElement("input");
  categoryInput.id = "newQuoteCategory";
  categoryInput.type = "text";
  categoryInput.placeholder = "Enter quote category";

  const addButton = document.createElement("button");
  addButton.textContent = "Add Quote";
  addButton.onclick = addQuote;

  form.appendChild(quoteInput);
  form.appendChild(categoryInput);
  form.appendChild(addButton);

  document.getElementById("controls").appendChild(form);
}

// -------------------------
// Export quotes to JSON file
// -------------------------
function exportToJsonFile() {
  const jsonStr = JSON.stringify(quotes, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  a.click();
  URL.revokeObjectURL(url);
}

// -------------------------
// Import quotes from JSON file
// -------------------------
function importFromJsonFile(event) {
  const fileReader = new FileReader();
  fileReader.onload = function (event) {
    const importedQuotes = JSON.parse(event.target.result);
    quotes.push(...importedQuotes);
    saveQuotes();
    populateCategories();
    alert("Quotes imported successfully!");
  };
  fileReader.readAsText(event.target.files[0]);
}

// -------------------------
// Populate category dropdown dynamically
// -------------------------
function populateCategories() {
  const categoryFilter = document.getElementById("categoryFilter");
  const categories = [...new Set(quotes.map(q => q.category))];

  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });

  const savedFilter = localStorage.getItem("selectedCategory");
  if (savedFilter) {
    categoryFilter.value = savedFilter;
    filterQuotes();
  }
}

// -------------------------
// Filter quotes by category
// -------------------------
function filterQuotes() {
  const selectedCategory = document.getElementById("categoryFilter").value;
  localStorage.setItem("selectedCategory", selectedCategory);

  const display = document.getElementById("quoteDisplay");
  let filtered = quotes;

  if (selectedCategory !== "all") {
    filtered = quotes.filter(q => q.category === selectedCategory);
  }

  display.innerHTML = filtered
    .map(q => `"${q.text}" <br><em>(${q.category})</em>`)
    .join("<hr>");
}

// -------------------------
// Simulated server interaction
// -------------------------
const SERVER_URL = "https://jsonplaceholder.typicode.com/posts";

// Fetch quotes from server
async function fetchQuotesFromServer() {
  try {
    const response = await fetch(SERVER_URL);
    const serverData = await response.json();

    const serverQuotes = serverData.slice(0, 5).map(item => ({
      text: item.title,
      category: "server"
    }));

    // Conflict resolution: server data takes precedence
    const merged = [...serverQuotes, ...quotes];
    quotes = merged;
    saveQuotes();
    populateCategories();
    console.log("Quotes synced from server.");
  } catch (error) {
    console.error("Failed to fetch from server:", error);
  }
}

// Send new quote to server
async function syncQuoteToServer(quote) {
  try {
    await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quote)
    });
    console.log("Quote synced to server successfully.");
  } catch (error) {
    console.error("Failed to sync quote:", error);
  }
}

// Periodically sync with server
setInterval(fetchQuotesFromServer, 15000); // every 15 seconds

// -------------------------
// Initialize app
// -------------------------
document.addEventListener("DOMContentLoaded", function () {
  createAddQuoteForm();
  populateCategories();
  document.getElementById("newQuote").addEventListener("click", showRandomQuote);
});
