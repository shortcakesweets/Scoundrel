const outputEl = document.getElementById("output");
const formEl = document.getElementById("commandBar");
const inputEl = document.getElementById("commandInput");

const scoundrel = window.createScoundrelApp({ outputEl, inputEl });
scoundrel.start();

formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = inputEl.value;
    inputEl.value = "";
    scoundrel.handleInput(raw);
});
