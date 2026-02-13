const app = document.getElementById("app");
let stopCurrentView = null;

const loadFragment = async (path) => {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status}`);
    }
    return response.text();
};

const setView = (cleanup) => {
    if (stopCurrentView) {
        stopCurrentView();
    }
    stopCurrentView = cleanup || null;
};

const showMenu = async () => {
    if (!app) {
        return;
    }

    app.innerHTML = await loadFragment("menu.html");
    const { initMenu, stopMenuTips } = await import("./menu.js");
    initMenu(app);
    setView(stopMenuTips);
};

const showOptions = async () => {
    if (!app) {
        return;
    }

    app.innerHTML = await loadFragment("options.html");
    const { initOptions } = await import("./options.js");
    initOptions(app);
    setView(null);
};

const showGame = async (ascension = 0) => {
    if (!app) {
        return;
    }

    app.innerHTML = await loadFragment("game.html");
    const { initGame } = await import("./game.js");
    const cleanup = initGame(app, { ascension });
    setView(cleanup);
};

const handleAction = (action) => {
    switch (action) {
        case "options":
            showOptions();
            break;
        case "start":
            showGame(0);
            break;
        case "start-plus":
            showGame(1);
            break;
        case "menu":
            showMenu();
            break;
        default:
            break;
    }
};

const handleOptionToggle = async (key) => {
    const { toggleOption } = await import("./options.js");
    toggleOption(app, key);
};

if (app) {
    app.addEventListener("contextmenu", (event) => {
        event.preventDefault();
    });

    app.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button || !app.contains(button)) {
            return;
        }

        const action = button.dataset.action;
        if (action) {
            handleAction(action);
            return;
        }

        const optionKey = button.dataset.option;
        if (optionKey) {
            handleOptionToggle(optionKey);
        }
    });

    app.addEventListener("game:menu", () => {
        showMenu();
    });

    app.addEventListener("game:reset", (event) => {
        const ascension = event.detail?.ascension ?? 0;
        showGame(ascension);
    });
}

showMenu();
