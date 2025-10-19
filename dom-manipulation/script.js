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
  display.textContent = `"${randomQuote.text}" — (${randomQuote.category})`;
}
document.getElementById("newQuote").addEventListener("click", showRandomQuote);

function addQuote() {
  const textInput = document.getElementById("newQuoteText").value.trim();;
  const categoryInput = document.getElementById("newQuoteCategory").value.trim();


  if (textInput === "" || categoryInput === "") {
    alert("Please enter both a quote and a category.");
    return;
  }
  quotes.push({ textInput, categoryInput });
  
  textInput.value = "";
  categoryInput.value = "";

  const display = document.getElementById("quoteDisplay");
  display.textContent = `New quote added: "${textInput}" — (${categoryInput})`;
}

document.getElementById("addQuoteBtn").addEventListener("click", addQuote);