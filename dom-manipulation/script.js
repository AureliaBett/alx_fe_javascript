const quote = [
    {text: "this one", category: 1},
    {text: "this two", category: 2},
    {text: "this three", category: 3},
    {text: "this four", category: 4},
    {text: "this five", category: 5},
    
]
const quoteButton = document.getElementById("newQuote");
const handleClick = function(){
    alert("quote[0]")
}
quoteButton.addEventListener("click", handleClick)