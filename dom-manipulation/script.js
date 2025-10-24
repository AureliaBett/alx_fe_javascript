const StoredQuotes =[
  {text: "This is my first quote", category:1},
  {text: "This is my second quote", category:2},
  {text: "This is my third quote", category:3},
  {text: "This is my fourth quote", category:4}
  
]

const quoteDisplay = document.getElementById("quoteDisplay");


function showRandomQuote(){
  const randomIndex = Math.floor(Math.random() * StoredQuotes.length);
  const randomQuote = StoredQuotes[randomIndex];
  quoteDisplay.innerHTML = randomQuote.text +"--" +randomQuote.category;
}
document.getElementById("newQuote").addEventListener("click", showRandomQuote)


function createAddQuoteForm(){
  const newQuoteText = document.createElement('input');
  newQuoteText.id = "newQuoteText";
  newQuoteText.type = "text";
  newQuoteText.placeholder="Enter a new quote";

  const newQuoteCategory = document.createElement('input');
  newQuoteText.id = "newQuoteCategory";
  newQuoteCategory.type = "text";
  newQuoteCategory.placeholder="Enter quote category"

  const AddButton = document.createElement("button");
  AddButton.onclick = "addIuote()";
  AddButton.innerHTML = "Add Quote";
  quoteDisplay.appendChild(newQuoteCategory)
  quoteDisplay.appendChild(newQuoteText)
  quoteDisplay.appendChild(AddButton)


}
createAddQuoteForm()