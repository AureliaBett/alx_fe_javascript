const QUOTES_KEY = "quotes_data";
const FILTER_KEY = "selected_filter";

let quotes = JSON.parse(localStorage.getItem(QUOTES_KEY)) || [
  { text: "this one", category: 1 },
  { text: "this two", category: 2 },
  { text: "this three", category: 3 },
  { text: "this four", category: 4 },
  { text: "this five", category: 5 },
];

function saveQuotes() {
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}

function showRandomQuote() {
  const display = document.getElementById("quoteDisplay");
  const selectedCategory = localStorage.getItem(FILTER_KEY) || "all";

  let filteredQuotes =
    selectedCategory === "all"
      ? quotes
      : quotes.filter((q) => q.category.toString() === selectedCategory.toString());

  if (filteredQuotes.length === 0) {
    display.innerHTML = "<em>No quotes found for this category.</em>";
    return;
  }

  const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
  const quote = filteredQuotes[randomIndex];
  display.innerHTML = `"${quote.text}" <br><em>(${quote.category})</em>`;
}

function createAddQuoteForm() {
  const form = document.getElementById("addQuoteForm");

  const textInput = document.createElement("input");
  textInput.id = "newQuoteText";
  textInput.type = "text";
  textInput.placeholder = "Enter a new quote";

  const categoryInput = document.createElement("input");
  categoryInput.id = "newQuoteCategory";
  categoryInput.type = "text";
  categoryInput.placeholder = "Enter quote category";

  const addButton = document.createElement("button");
  addButton.textContent = "Add Quote";
  addButton.addEventListener("click", addQuote);

  form.appendChild(textInput);
  form.appendChild(categoryInput);
  form.appendChild(addButton);
}

function addQuote() {
  const text = document.getElementById("newQuoteText").value.trim();
  const category = document.getElementById("newQuoteCategory").value.trim();

  if (!text || !category) {
    alert("Please enter both a quote and a category.");
    return;
  }

  quotes.push({ text, category });
  saveQuotes();
  populateCategories();

  document.getElementById("newQuoteText").value = "";
  document.getElementById("newQuoteCategory").value = "";

  document.getElementById("quoteDisplay").textContent = `New quote added: "${text}" (${category})`;
}

function populateCategories() {
  const dropdown = document.getElementById("categoryFilter");
  const uniqueCategories = [...new Set(quotes.map((q) => q.category))];

  dropdown.innerHTML = '<option value="all">All Categories</option>';
  uniqueCategories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    dropdown.appendChild(option);
  });

  const savedFilter = localStorage.getItem(FILTER_KEY);
  if (savedFilter) dropdown.value = savedFilter;
}

function filterQuotes() {
  const selected = document.getElementById("categoryFilter").value;
  localStorage.setItem(FILTER_KEY, selected);
  showRandomQuote();
}

// --- Import/Export JSON ---
function exportToJson() {
  const blob = new Blob([JSON.stringify(quotes, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importFromJsonFile(event) {
  const fileReader = new FileReader();
  fileReader.onload = function (e) {
    try {
      const importedQuotes = JSON.parse(e.target.result);
      if (!Array.isArray(importedQuotes)) throw new Error("Invalid format");
      quotes.push(...importedQuotes);
      saveQuotes();
      populateCategories();
      alert("Quotes imported successfully!");
    } catch {
      alert("Invalid JSON file format!");
    }
  };
  fileReader.readAsText(event.target.files[0]);
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", function () {
  createAddQuoteForm();
  populateCategories();

  const newQuoteButton = document.getElementById("newQuote");
  newQuoteButton.addEventListener("click", showRandomQuote);

  const exportBtn = document.getElementById("exportQuotes");
  const importBtn = document.getElementById("importQuotes");
  const importFile = document.getElementById("importFile");

  exportBtn.addEventListener("click", exportToJson);
  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", importFromJsonFile);

  filterQuotes();
});
