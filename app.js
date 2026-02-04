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

// Keep focus on the command line (feels terminal-like).
window.addEventListener("pointerdown", () => inputEl.focus());
window.addEventListener("keydown", () => inputEl.focus(), { capture: true });
