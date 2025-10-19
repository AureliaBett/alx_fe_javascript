const quotes = [
    {text: "this one", category: 1},
    {text: "this two", category: 2},
    {text: "this three", category: 3},
    {text: "this four", category: 4},
    {text: "this five", category: 5},
    
]

function showRandomQuote() {
  const display = document.getElementById("quoteDisplay");
  const randomIndex = Math.floor(Math.random() * quotes.length);
  const quote = quotes[randomIndex];
  display.innerHTML = `"${randomQuote.text}" <br> <em>(${randomQuote.category})</em>`;
}

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

  document.getElementById("quoteDisplay").textContent = `New quote added: "${text}" — (${category})`;

  // clear the input fields
  textInput.value = "";
  categoryInput.value = "";
}

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
  addButton.setAttribute("onclick", "addQuote()");

  form.appendChild(quoteInput);
  form.appendChild(categoryInput);
  form.appendChild(addButton);

  document.getElementById("quoteDisplay").insertAdjacentElement("afterend", form);
}

document.addEventListener("DOMContentLoaded", function() {
  createAddQuoteForm();

  const newQuoteButton = document.getElementById("newQuote");
  newQuoteButton.addEventListener("click", showRandomQuote);
});