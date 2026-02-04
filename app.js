const outputEl = document.getElementById("output");

const scoundrel = window.createScoundrelApp({ outputEl });
scoundrel.start();

function keyToOptionIndex(e) {
    if (e.defaultPrevented) return null;
    if (e.ctrlKey || e.metaKey || e.altKey) return null;

    if (typeof e.key === "string" && /^[0-9]$/.test(e.key)) return e.key;

    // Some environments report numpad keys via `code`.
    if (typeof e.code === "string" && /^Numpad[0-9]$/.test(e.code)) {
        return e.code.slice("Numpad".length);
    }

    return null;
}

window.addEventListener("keydown", (e) => {
    const key = keyToOptionIndex(e);
    if (key === null) return;
    e.preventDefault();
    scoundrel.handleInput(key);
});
