const quotes = [
    {text: "this one", category: 1},
    {text: "this two", category: 2},
    {text: "this three", category: 3},
    {text: "this four", category: 4},
    {text: "this five", category: 5},
    
]

const newQuoteText = document.getElementById("newQuoteText");
const newQuoteCategory = document.getElementById("newQuoteCategory");


function showRandomQuote() {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  const randomQuote = quotes[randomIndex];
  const display = document.getElementById("quoteDisplay");
  display.innerHTML = `"${randomQuote.text}" <br> <em>(${randomQuote.category})</em>`;
}
document.getElementById("newQuote").addEventListener("click", showRandomQuote);

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
  
  textInput.value = "";
  categoryInput.value = "";

  const display = document.getElementById("quoteDisplay");
  display.textContent = `New quote added: "${text}" — (${category})`;
}

document.getElementById("addQuoteBtn").addEventListener("click", addQuote);