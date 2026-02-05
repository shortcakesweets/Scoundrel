/* global window, document */

function createScoundrelApp({ outputEl, inputEl = null }) {
    const MAX_HP = 20;
    const SUIT = {
        hearts: "hearts",
        diamonds: "diamonds",
        clubs: "clubs",
        spades: "spades",
    };

    const SUIT_SYMBOL = {
        [SUIT.hearts]: "♥",
        [SUIT.diamonds]: "◆",
        [SUIT.clubs]: "♣",
        [SUIT.spades]: "♠",
    };

    function applyColoredTextSetting(enabled) {
        document.body.dataset.coloredText = enabled ? "on" : "off";
    }

    function rankLabel(rank) {
        if (rank === 14) return "A";
        if (rank === 13) return "K";
        if (rank === 12) return "Q";
        if (rank === 11) return "J";
        return String(rank);
    }

    function cardText(card) {
        return `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`;
    }

    function elSpan(text, className) {
        const el = document.createElement("span");
        if (className) el.className = className;
        el.textContent = text;
        return el;
    }

    function isEnemy(card) {
        return card.suit === SUIT.spades || card.suit === SUIT.clubs;
    }

    function isWeapon(card) {
        return card.suit === SUIT.diamonds && card.rank <= 10;
    }

    function isPotion(card) {
        return card.suit === SUIT.hearts && card.rank <= 10;
    }

    function isRepairToolkit(card) {
        return card.suit === SUIT.diamonds && card.rank >= 11;
    }

    function isPoisonPotion(card) {
        return card.suit === SUIT.hearts && card.rank >= 11;
    }

    function isAnyPotion(card) {
        return isPotion(card) || isPoisonPotion(card);
    }

    function cardSpan(card) {
        if (!card) return elSpan("-", "card");
        let kind = "enemy";
        if (isRepairToolkit(card)) kind = "toolkit";
        else if (isWeapon(card)) kind = "weapon";
        else if (isPoisonPotion(card)) kind = "poison";
        else if (isPotion(card)) kind = "potion";
        return elSpan(cardText(card), `card ${kind}`);
    }

    function shuffleInPlace(array) {
        for (let i = array.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function createDeck({ includeSpecialCards = true } = {}) {
        const deck = [];
        const suits = [SUIT.hearts, SUIT.diamonds, SUIT.clubs, SUIT.spades];
        for (const suit of suits) {
            for (let rank = 2; rank <= 14; rank += 1) {
                if (!includeSpecialCards) {
                    // Classic mode: remove A/J/Q/K of Hearts and Diamonds.
                    if (
                        (suit === SUIT.hearts || suit === SUIT.diamonds) &&
                        (rank === 11 || rank === 12 || rank === 13 || rank === 14)
                    ) {
                        continue;
                    }
                }
                deck.push({ suit, rank });
            }
        }
        // No jokers in this constructed deck; instruction says to remove them anyway.
        shuffleInPlace(deck);
        return deck;
    }

    function drawTop(deck) {
        return deck.pop() ?? null;
    }

    function buildCandidateDungeon(includeSpecialCards) {
        let fullDeck = createDeck({ includeSpecialCards });
        let deckForGame = fullDeck.slice();
        let table = [
            drawTop(deckForGame),
            drawTop(deckForGame),
            drawTop(deckForGame),
            drawTop(deckForGame),
        ];
        let safety = 0;
        while (!table.some((c) => c && isWeapon(c)) && safety < 200) {
            fullDeck = createDeck({ includeSpecialCards });
            deckForGame = fullDeck.slice();
            table = [
                drawTop(deckForGame),
                drawTop(deckForGame),
                drawTop(deckForGame),
                drawTop(deckForGame),
            ];
            safety += 1;
        }
        return { fullDeck, deckForGame, table };
    }

    const resetBtnEl = document.getElementById("resetBtn");
    const queueBtnEl = document.getElementById("queueBtn");
    const solver = typeof window !== "undefined" ? window.ScoundrelSolver : null;
    const SILENT_POOL_LIMIT = 3;
    const SILENT_SOLVE_TIME_LIMIT_MS = 5000;
    const SILENT_SOLVE_MAX_NODES = 5_000_000;

    const DUNGEON_TIPS = [
        "Use fists to avoid dulling your weapon.",
        "Fleeing is not cowardice; it’s strategic repositioning.",
        "Weapon kills must strictly go down in rank afterward.",
        "A second potion in the same room fizzles—even if it’s a poison potion.",
        "A new room is drawn after 3 interactions.",
        "Toolkits can undo a bad weapon-kill order. Use them wisely.",
        "If you can take 0 damage with a weapon kill, it’s often worth it (but it still dulls the weapon).",
        "When low HP, consider whether a potion is actually usable this room.",
        "Sometimes skipping weapon kills early keeps future options open.",
    ];

    function pickRandomUnique(array, count) {
        const n = Math.max(0, Math.min(count, array.length));
        const pool = array.slice();
        for (let i = pool.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        return pool.slice(0, n);
    }

    function clearOutput() {
        outputEl.innerHTML = "";
    }

    function addLine(text, className) {
        const line = document.createElement("div");
        line.className = className ? `line ${className}` : "line";
        line.textContent = text;
        outputEl.appendChild(line);
    }

    function headingLineParts(text) {
        const m = /^(#{1,2})(\s+)(.*)$/.exec(text);
        if (!m) return null;
        const hash = m[1];
        const space = m[2];
        const rest = m[3];
        const hashClass = hash.length === 1 ? "hash1" : "hash2";
        return [elSpan(hash, hashClass), space, rest];
    }

    function addLineParts(parts, className) {
        const line = document.createElement("div");
        line.className = className ? `line ${className}` : "line";
        for (const part of parts) {
            if (typeof part === "string") {
                line.appendChild(document.createTextNode(part));
            } else if (part instanceof Node) {
                line.appendChild(part);
            } else if (part && typeof part === "object") {
                line.appendChild(elSpan(part.text ?? "", part.className));
            }
        }
        outputEl.appendChild(line);
    }

    function addSpacer() {
        const line = document.createElement("div");
        line.className = "line";
        line.textContent = "";
        outputEl.appendChild(line);
    }

    function addOption(key, label, onSelect, enabled = true) {
        addOptionParts(key, [document.createTextNode(label)], onSelect, enabled);
    }

    function addOptionParts(key, labelParts, onSelect, enabled = true) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = enabled ? "optionBtn" : "optionBtn disabled";
        btn.disabled = !enabled;
        btn.dataset.key = String(key);
        btn.appendChild(elSpan(`[${key}]`, "optionKey"));
        if (labelParts.length) btn.appendChild(document.createTextNode(" "));
        for (const part of labelParts) {
            if (typeof part === "string") btn.appendChild(document.createTextNode(part));
            else btn.appendChild(part);
        }
        if (enabled) btn.addEventListener("click", onSelect);
        outputEl.appendChild(btn);
    }

    function renderScreen({ lines = [], options = [], dimLines = [] }) {
        clearOutput();
        for (const l of lines) {
            if (typeof l === "string") {
                const headingParts = headingLineParts(l);
                if (headingParts) addLineParts(headingParts);
                else addLine(l);
            }
            else if (l && typeof l === "object" && Array.isArray(l.parts))
                addLineParts(l.parts, l.className);
        }
        for (const l of dimLines) addLine(l, "dim");
        if (options.length) addSpacer();
        for (const opt of options) {
            if (opt.spacer) {
                addSpacer();
                continue;
            }
            if (opt.labelParts) {
                addOptionParts(
                    opt.key,
                    opt.labelParts,
                    opt.onSelect,
                    opt.enabled !== false
                );
            } else {
                addOption(opt.key, opt.label, opt.onSelect, opt.enabled !== false);
            }
        }
        window.scrollTo(0, 0);
        if (inputEl) inputEl.focus();
    }

    const app = {
        screenOptions: new Map(),
        mode: "menu",
        game: null,
        pending: null, // e.g. { kind: 'enemyChoice', slotIndex, enemyCard }
        settings: { coloredText: true, hintText: true },
        resetReturn: null,
        pendingDungeon: null,
        createDungeonToken: 0,
        silentPools: { base: [], plus: [] },
        silentSolverToken: 0,
        silentSolverRunning: false,

        setScreen(screenModel) {
            applyColoredTextSetting(this.settings.coloredText);
            if (resetBtnEl) {
                resetBtnEl.hidden =
                    this.mode === "menu" ||
                    this.mode === "resetConfirm" ||
                    this.mode === "creatingDungeon" ||
                    this.mode === "dungeonReady" ||
                    this.mode === "deckQueue";
            }
            if (queueBtnEl) {
                queueBtnEl.hidden = this.mode !== "menu";
            }
            this.screenOptions = new Map();
            for (const opt of screenModel.options ?? []) {
                if (opt && !opt.spacer) this.screenOptions.set(String(opt.key), opt);
            }
            renderScreen(screenModel);
        },

        handleInput(raw) {
            const key = String(raw ?? "").trim();
            if (!key) return;
            const opt = this.screenOptions.get(key);
            if (!opt || opt.enabled === false) return;
            opt.onSelect();
        },

        start() {
            if (resetBtnEl) resetBtnEl.addEventListener("click", () => this.requestReset());
            if (queueBtnEl) queueBtnEl.addEventListener("click", () => this.showDeckQueue());
            this.startSilentSolver();
            this.showMenu();
        },

        showMenu() {
            this.mode = "menu";
            this.game = null;
            this.pending = null;
            this.resetReturn = null;
            this.pendingDungeon = null;
            this.createDungeonToken += 1;

            this.setScreen({
                lines: [
                    "Scoundrel",
                    "",
                    "Click an option.",
                ],
                options: [
                    {
                        key: "1",
                        label: "Start game",
                        onSelect: () => this.beginDungeonCreation({ includeSpecialCards: false }),
                    },
                    {
                        key: "2",
                        label: "Start game +",
                        onSelect: () => this.beginDungeonCreation({ includeSpecialCards: true }),
                    },
                    {
                        key: "3",
                        label: "How to play",
                        onSelect: () => this.showHowTo(),
                    },
                    {
                        key: "4",
                        label: "Option",
                        onSelect: () => this.showOptions(),
                    },
                ],
            });
        },

        showDeckQueue() {
            this.mode = "deckQueue";
            this.pending = null;
            this.setScreen({
                lines: [
                    "Deck Queue",
                    "",
                    `Base decks ready: ${this.silentPools.base.length}/${SILENT_POOL_LIMIT}`,
                    `Scoundrel+ decks ready: ${this.silentPools.plus.length}/${SILENT_POOL_LIMIT}`,
                ],
                options: [
                    {
                        key: "0",
                        label: "Return to main menu",
                        onSelect: () => this.showMenu(),
                    },
                ],
            });
        },

        showOptions() {
            this.mode = "options";
            this.pending = null;

            const enabled = this.settings.coloredText;
            const hintEnabled = this.settings.hintText;
            this.setScreen({
                lines: ["Options"],
                options: [
                    {
                        key: "1",
                        label: `Colored text (${enabled ? "Enabled" : "Disabled"})`,
                        onSelect: () => {
                            this.settings.coloredText = !this.settings.coloredText;
                            this.showOptions();
                        },
                    },
                    {
                        key: "2",
                        label: `Hint text (${hintEnabled ? "Enabled" : "Disabled"})`,
                        onSelect: () => {
                            this.settings.hintText = !this.settings.hintText;
                            this.showOptions();
                        },
                    },
                    { spacer: true },
                    {
                        key: "0",
                        label: "Return to main menu",
                        onSelect: () => this.showMenu(),
                    },
                ],
            });
        },

        showHowTo() {
            this.mode = "howto";
            this.pending = null;
            this.setScreen({
                lines: [
                    "Scoundrel",
                    "",
                    "You are a Scoundrel exploring a dungeon...",
                    "",
                    "A small roguelike playable with a deck of cards.",
                    "In this game, J,Q,K,A's rank are 11, 12, 13, and 14.",
                    "",
                    "# Room",
                    "",
                    "Each room is filled with 4 interactable cards.",
                    "You may flee or fight the room.",
                    "",
                    "## Flee",
                    "All 4 cards on the table will be restacked at the bottom of the dungeon.",
                    "Then, 4 new cards will be drawn.",
                    "",
                    "You may not flee 2 times in a row.",
                    "",
                    "## Fight",
                    "When you choose to fight, you should interact with 3 cards.",
                    "After that, 3 new cards are drawn and creates a new room.",
                    "",
                    "# Interactable cards",
                    "",
                    "## 2-10 of Diamonds",
                    "",
                    "These are your weapons.",
                    "You may only hold 1 weapon. If you select another, the old one will be discarded.",
                    "",
                    "## 2-10 of Hearts",
                    "",
                    "These are health potions. Your HP will increase by its rank.",
                    "Your HP cannot exceed your initial HP (20).",
                    "",
                    "You may only drink 1 potion in a room.",
                    "Any potions consumed after will fizzle and have no effect.",
                    "",
                    "## 2-A of Spades & Clubs",
                    "",
                    "These are enemies. You may kill it by using your weapon or your bare fist.",
                    "",
                    "1. Using a weapon",
                    "Weapons can reduce damage when killing an enemy.",
                    "The damage that you take is max(enemy rank - weapon rank, 0).",
                    "",
                    "However, killing an enemy with a weapon makes it dull.",
                    "You cannot use a weapon to a enemy that has higher rank than the last enemy that you've killed with that weapon.",
                    "",
                    "2. Using your bare fist",
                    "The damage you take is equal to the enemy rank.",
                    "It does not dull your weapon, so use it wisely.",
                    "",
                    "## J-A of Diamonds",
                    "",
                    "(Only in Scoundrel+)",
                    "These are repair tools. When used, it will remove the last enemy that you've killed from your weapon.",
                    "",
                    "## J-A of Hearts",
                    "",
                    "(Only in Scoundrel+)",
                    "These are poison potions. When used, you will take 10 damage.",
                    "",
                    "Note that you may only drink 1 potion in a room.",
                    "Any potions consumed after will fizzle and have no effect.",
                    "",
                    "# Score",
                    "",
                    "When you interact with all of the cards without reaching HP 0, you win.",
                    "The score becomes your remaining HP.",
                    "If the last card you used was a health potion, its rank is added up to your score.",
                    "The maximum score that you can achieve is 30.",
                    "",
                    "If you reach HP 0, you lose.",
                    "The score becomes the minus of the sum of the enemies that you didn't kill.",
                ],
                options: [
                    {
                        key: "1",
                        label: "Back",
                        onSelect: () => this.showMenu(),
                    },
                ],
            });
        },

        startGameFromPreparedDungeon(prepared) {
            const { deck, table, includeSpecialCards } = prepared;
            this.game = {
                room: 1,
                hp: MAX_HP,
                deck,
                table,
                weapon: null, // card
                weaponKills: [], // enemy cards killed using weapon
                potionUsedThisRoom: false,
                interactionsThisRoom: 0,
                fledLastRoom: false,
                lastUsedCard: null,
                includeSpecialCards,
            };
            this.pending = null;
            this.mode = "room";
            this.showRoom(["You enter a dark room filled with monsters..."]);
        },

        beginDungeonCreation({ includeSpecialCards }) {
            const prepared = this.takePreparedDungeon(includeSpecialCards);
            if (prepared) {
                this.startGameFromPreparedDungeon(prepared);
                return;
            }

            const myToken = (this.createDungeonToken += 1);
            this.pendingDungeon = null;
            this.pending = null;
            this.mode = "creatingDungeon";

            const makeTipLines = () => {
                const tips = pickRandomUnique(DUNGEON_TIPS, 1);
                return ["Creating Dungeon...", "", "Tip:", ...tips.map((t) => `- ${t}`)];
            };

            this.setScreen({
                lines: makeTipLines(),
                options: [
                    { key: "0", label: "Cancel", onSelect: () => this.showMenu() },
                    {
                        key: "9",
                        label: "Skip calculation (start random dungeon)",
                        onSelect: () => {
                            this.createDungeonToken += 1;
                            const fullDeck = createDeck({ includeSpecialCards });
                            const deckForGame = fullDeck.slice();
                            const table = [
                                drawTop(deckForGame),
                                drawTop(deckForGame),
                                drawTop(deckForGame),
                                drawTop(deckForGame),
                            ];
                            this.startGameFromPreparedDungeon({
                                deck: deckForGame,
                                table,
                                includeSpecialCards,
                            });
                        },
                    },
                ],
            });

            const run = async () => {
                // Let the UI paint first.
                await new Promise((r) => setTimeout(r, 0));

                while (this.createDungeonToken === myToken) {
                    this.setScreen({
                        lines: makeTipLines(),
                        options: [
                            { key: "0", label: "Cancel", onSelect: () => this.showMenu() },
                            {
                                key: "9",
                                label: "Skip calculation (start random dungeon)",
                                onSelect: () => {
                                    this.createDungeonToken += 1;
                                    const fullDeck = createDeck({ includeSpecialCards });
                                    const deckForGame = fullDeck.slice();
                                    const table = [
                                        drawTop(deckForGame),
                                        drawTop(deckForGame),
                                        drawTop(deckForGame),
                                        drawTop(deckForGame),
                                    ];
                                    this.startGameFromPreparedDungeon({
                                        deck: deckForGame,
                                        table,
                                        includeSpecialCards,
                                    });
                                },
                            },
                        ],
                    });

                    if (!solver || typeof solver.solveCooperative !== "function") {
                        this.setScreen({
                            lines: [
                                "Creating Dungeon...",
                                "",
                                "Solver not found. Make sure solver.js is loaded.",
                            ],
                            options: [{ key: "0", label: "Back", onSelect: () => this.showMenu() }],
                        });
                        return;
                    }

                    // Build a candidate deck and ensure at least 1 weapon in first room.
                    const { fullDeck, deckForGame, table } =
                        buildCandidateDungeon(includeSpecialCards);

                    // Check clearability (5s per deck).
                    const result = await solver.solveCooperative(fullDeck, {
                        includeSpecialCards,
                        timeLimitMs: 5000,
                        maxNodes: 5_000_000,
                        shouldAbort: () => this.createDungeonToken !== myToken,
                    });

                    if (this.createDungeonToken !== myToken) return;

                    if (result.clearable === true) {
                        this.pendingDungeon = { deck: deckForGame, table, includeSpecialCards };
                        this.mode = "dungeonReady";
                        this.setScreen({
                            lines: [
                                "The dungeon awaits you...",
                                "",
                                "(Press [1] or click below to enter.)",
                            ],
                            options: [
                                {
                                    key: "1",
                                    label: "Enter the dungeon",
                                    onSelect: () => this.enterDungeon(),
                                },
                                { key: "0", label: "Back", onSelect: () => this.showMenu() },
                            ],
                        });
                        return;
                    }

                    // If not proven clearable within the budget, try another shuffle.
                    // (result.clearable === false OR null/time_limit OR node_limit)
                    await new Promise((r) => setTimeout(r, 0));
                }
            };

            run();
        },

        enterDungeon() {
            if (!this.pendingDungeon) return;
            const prepared = this.pendingDungeon;
            this.pendingDungeon = null;
            this.startGameFromPreparedDungeon(prepared);
        },

        takePreparedDungeon(includeSpecialCards) {
            const key = includeSpecialCards ? "plus" : "base";
            const pool = this.silentPools[key];
            if (!pool || pool.length === 0) return null;
            return pool.shift();
        },

        shouldRunSilentSolver() {
            return (
                this.mode === "menu" ||
                this.mode === "deckQueue" ||
                this.mode === "room" ||
                this.mode === "enemyChoice" ||
                this.mode === "gameOver"
            );
        },

        enqueuePreparedDungeon(prepared) {
            const key = prepared.includeSpecialCards ? "plus" : "base";
            const pool = this.silentPools[key];
            if (!pool || pool.length >= SILENT_POOL_LIMIT) return false;
            pool.push(prepared);
            if (this.mode === "deckQueue") this.showDeckQueue();
            return true;
        },

        async fillSilentPool(includeSpecialCards, token) {
            if (!solver) return;
            if (this.silentSolverToken !== token) return;
            if (!this.shouldRunSilentSolver()) return;
            const key = includeSpecialCards ? "plus" : "base";
            if (this.silentPools[key].length >= SILENT_POOL_LIMIT) return;

            const { fullDeck, deckForGame, table } =
                buildCandidateDungeon(includeSpecialCards);

            const result = await solver.solveCooperative(fullDeck, {
                includeSpecialCards,
                timeLimitMs: SILENT_SOLVE_TIME_LIMIT_MS,
                maxNodes: SILENT_SOLVE_MAX_NODES,
                shouldAbort: () =>
                    this.silentSolverToken !== token || !this.shouldRunSilentSolver(),
            });

            if (this.silentSolverToken !== token) return;
            if (!this.shouldRunSilentSolver()) return;
            if (result.clearable !== true) return;

            this.enqueuePreparedDungeon({
                deck: deckForGame,
                table,
                includeSpecialCards,
            });
        },

        startSilentSolver() {
            if (this.silentSolverRunning) return;
            this.silentSolverRunning = true;
            const myToken = (this.silentSolverToken += 1);

            const run = async () => {
                await new Promise((r) => setTimeout(r, 0));
                while (this.silentSolverToken === myToken) {
                    if (!this.shouldRunSilentSolver()) {
                        await new Promise((r) => setTimeout(r, 100));
                        continue;
                    }
                    await this.fillSilentPool(false, myToken);
                    await this.fillSilentPool(true, myToken);
                    await new Promise((r) => setTimeout(r, 0));
                }
            };

            run();
        },

        statusLines() {
            const g = this.game;
            const weaponLine = (() => {
                if (!g.weapon) return { parts: ["Weapon: -"], className: "status" };
                const parts = ["Weapon: ", cardSpan(g.weapon)];
                if (g.weaponKills.length > 0) {
                    parts.push(" (");
                    for (let i = 0; i < g.weaponKills.length; i += 1) {
                        if (i > 0) parts.push(" > ");
                        parts.push(cardSpan(g.weaponKills[i]));
                    }
                    parts.push(")");
                }
                return { parts, className: "status" };
            })();

            return [
                { parts: [`Room ${g.room}`], className: "status" },
                { parts: [`HP: ${g.hp}`], className: "status" },
                { parts: [`DK: ${g.deck.length}`], className: "status" },
                weaponLine,
            ];
        },

        showRoom(messageLines = []) {
            const g = this.game;
            if (!g) return this.showMenu();

            this.mode = "room";
            this.pending = null;

            const lines = [...this.statusLines(), "", ...messageLines, ""];

            const options = [];

            // Flee is only allowed immediately upon entering a room (before any interactions)
            // and not two rooms in a row.
            const canFlee = g.interactionsThisRoom === 0 && !g.fledLastRoom;
            if (g.interactionsThisRoom === 0) {
                options.push({
                    key: "0",
                    label: canFlee ? "Flee" : "Flee (unavailable)",
                    enabled: canFlee,
                    onSelect: () => this.fleeRoom(),
                });
            }

            for (let i = 0; i < 4; i += 1) {
                const card = g.table[i];
                const labelParts = (() => {
                    if (!card) return [elSpan("-", "card")];

                    const parts = [cardSpan(card)];
                    if (!this.settings.hintText) return parts;

                    if (isEnemy(card)) parts.push(elSpan(` Enemy, ${card.rank}`, "dim"));
                    else if (isWeapon(card)) parts.push(elSpan(` Weapon, ${card.rank}`, "dim"));
                    else if (isPotion(card)) parts.push(elSpan(` Health, ${card.rank}`, "dim"));
                    else if (isRepairToolkit(card)) parts.push(elSpan(" Repair", "dim"));
                    else if (isPoisonPotion(card)) parts.push(elSpan(" Poison 10", "dim"));

                    return parts;
                })();
                options.push({
                    key: String(i + 1),
                    labelParts,
                    enabled: Boolean(card),
                    onSelect: () => this.interactWithSlot(i),
                });
            }

            this.setScreen({ lines, options });
        },

        requestReset() {
            if (this.mode === "menu" || this.mode === "resetConfirm") return;

            const returnFn = (() => {
                if (this.mode === "room") return () => this.showRoom([]);
                if (this.mode === "enemyChoice" && this.pending?.kind === "enemyChoice") {
                    return () =>
                        this.showEnemyChoice(this.pending.slotIndex, this.pending.enemyCard);
                }
                if (this.mode === "options") return () => this.showOptions();
                if (this.mode === "howto") return () => this.showHowTo();
                return () => this.showMenu();
            })();

            this.resetReturn = returnFn;
            this.mode = "resetConfirm";
            this.pending = null;
            this.setScreen({
                lines: ["Reset", "", "Reset and return to main menu?"],
                options: [
                    { key: "1", label: "Yes", onSelect: () => this.showMenu() },
                    {
                        key: "0",
                        label: "No",
                        onSelect: () => {
                            const goBack = this.resetReturn;
                            this.resetReturn = null;
                            if (goBack) goBack();
                            else this.showMenu();
                        },
                    },
                ],
            });
        },

        fleeRoom() {
            const g = this.game;
            if (!g) return this.showMenu();
            if (g.interactionsThisRoom !== 0) return;
            if (g.fledLastRoom) return;

            // Put the current room's cards at the bottom of the deck.
            // Deck top is the end of the array; bottom is the start.
            for (let i = 3; i >= 0; i -= 1) {
                const card = g.table[i];
                if (card) g.deck.unshift(card);
            }

            // Draw a fresh room.
            g.table = [
                drawTop(g.deck),
                drawTop(g.deck),
                drawTop(g.deck),
                drawTop(g.deck),
            ];
            g.interactionsThisRoom = 0;
            g.potionUsedThisRoom = false;
            g.fledLastRoom = true;

            this.showRoom(["You flee... and enter a different room."]);
        },

        interactWithSlot(slotIndex) {
            const g = this.game;
            if (!g) return this.showMenu();

            const card = g.table[slotIndex];
            if (!card) return;

            if (isEnemy(card)) {
                return this.showEnemyChoice(slotIndex, card);
            }
            if (isRepairToolkit(card)) {
                return this.useRepairToolkit(slotIndex, card);
            }
            if (isWeapon(card)) {
                return this.pickUpWeapon(slotIndex, card);
            }
            if (isAnyPotion(card)) {
                return this.drinkPotion(slotIndex, card);
            }

            // Should be unreachable.
            return this.showRoom(["Nothing happens."]);
        },

        showEnemyChoice(slotIndex, enemyCard) {
            const g = this.game;
            this.mode = "enemyChoice";
            this.pending = { kind: "enemyChoice", slotIndex, enemyCard };

            const lines = [
                ...this.statusLines(),
                "",
                { parts: ["You stare at the ", cardSpan(enemyCard), ". It stares back."] },
                "You use your...",
            ];

            const weaponAllowed = (() => {
                if (!g.weapon) return false;
                if (g.weaponKills.length === 0) return true;
                const last = g.weaponKills[g.weaponKills.length - 1];
                return enemyCard.rank < last.rank;
            })();

            const weaponLabelParts = g.weapon
                ? [elSpan("Weapon (", "optionText"), cardSpan(g.weapon), elSpan(")", "optionText")]
                : [document.createTextNode("Weapon (-)")];

            this.setScreen({
                lines,
                options: [
                    {
                        key: "1",
                        labelParts: weaponAllowed
                            ? weaponLabelParts
                            : [...weaponLabelParts, elSpan(" (unavailable)", "dim")],
                        enabled: weaponAllowed,
                        onSelect: () =>
                            this.fightEnemy(slotIndex, enemyCard, "weapon"),
                    },
                    {
                        key: "2",
                        label: "Fist",
                        onSelect: () =>
                            this.fightEnemy(slotIndex, enemyCard, "fist"),
                    },
                    {
                        key: "9",
                        label: "Back",
                        onSelect: () => this.showRoom([]),
                    },
                ],
            });
        },

        fightEnemy(slotIndex, enemyCard, method) {
            const g = this.game;
            if (!g) return this.showMenu();

            g.lastUsedCard = enemyCard;
            let damage = enemyCard.rank;
            if (method === "weapon") {
                const weaponRank = g.weapon?.rank ?? 0;
                damage = Math.max(0, enemyCard.rank - weaponRank);
            }

            const hpBefore = g.hp;
            const hpAfter = hpBefore - damage;

            if (hpAfter < 0) {
                // Not enough HP: you fall before killing the enemy.
                g.hp = 0;
                return this.finishGameDeath();
            }

            // Enemy is defeated in all non-negative outcomes.
            if (method === "weapon") g.weaponKills.push(enemyCard);
            g.hp = Math.max(0, hpAfter);
            g.table[slotIndex] = null;

            if (g.hp <= 0) {
                return this.finishGameDeath([
                    "You strike the final blow and fall with your foe.",
                ]);
            }

            const msg =
                damage === 0
                    ? [
                          `You defeat the ${cardText(enemyCard)} without taking damage.`,
                      ]
                    : [
                          `You defeat the ${cardText(enemyCard)} and take ${damage} damage.`,
                      ];
            this.afterInteraction(msg);
        },

        pickUpWeapon(slotIndex, weaponCard) {
            const g = this.game;
            if (!g) return this.showMenu();

            const hadWeapon = Boolean(g.weapon);
            g.lastUsedCard = weaponCard;
            g.weapon = weaponCard;
            g.weaponKills = [];
            g.table[slotIndex] = null;

            this.afterInteraction([
                hadWeapon
                    ? "You pick up the shiny new weapon and discard the old one."
                    : "You pick up the shiny new weapon.",
            ]);
        },

        useRepairToolkit(slotIndex, toolkitCard) {
            const g = this.game;
            if (!g) return this.showMenu();

            g.lastUsedCard = toolkitCard;
            g.table[slotIndex] = null;

            if (!g.weapon || g.weaponKills.length === 0) {
                this.afterInteraction([
                    `You use ${cardText(toolkitCard)}, but nothing happens.`,
                ]);
                return;
            }

            const removed = g.weaponKills.pop();
            this.afterInteraction([
                `You use ${cardText(toolkitCard)} to repair your weapon.`,
                `Removed from weapon stack: ${cardText(removed)}.`,
            ]);
        },

        drinkPotion(slotIndex, potionCard) {
            const g = this.game;
            if (!g) return this.showMenu();

            g.lastUsedCard = potionCard;
            g.table[slotIndex] = null;

            const isLastCardOverall = g.deck.length === 0 && !g.table.some(Boolean);
            if (isLastCardOverall && isPotion(potionCard)) {
                // Bonus system: when the last used card is a healing potion, it adds bonus points.
                return this.finishGameClear(potionCard);
            }

            if (g.potionUsedThisRoom) {
                this.afterInteraction([
                    "The potion fizzles. (Potion already used this room.)",
                ]);
                return;
            }

            g.potionUsedThisRoom = true;
            if (isPoisonPotion(potionCard)) {
                const damage = 10;
                g.hp = Math.max(0, g.hp - damage);
                if (g.hp <= 0) return this.finishGameDeath();
                this.afterInteraction([`The poison burns. You take ${damage} damage.`]);
                return;
            }

            const before = g.hp;
            g.hp = Math.min(MAX_HP, g.hp + potionCard.rank);
            const healed = g.hp - before;

            this.afterInteraction([healed > 0 ? "You feel healthier." : "You already feel fine."]);
        },

        afterInteraction(messageLines) {
            const g = this.game;
            if (!g) return this.showMenu();

            g.interactionsThisRoom += 1;

            // The game ends when the last card is used (no cards left anywhere).
            if (g.deck.length === 0 && !g.table.some(Boolean)) {
                return this.finishGameClear();
            }

            const hasAnyTableCard = g.table.some(Boolean);

            // Room ends after 3 interactions, or earlier if the room runs out of cards
            // (possible near end-of-deck).
            if (g.interactionsThisRoom >= 3 || !hasAnyTableCard) {
                let drew = 0;
                for (let i = 0; i < 4; i += 1) {
                    if (g.table[i] === null && g.deck.length > 0) {
                        g.table[i] = drawTop(g.deck);
                        if (g.table[i]) drew += 1;
                    }
                }

                g.room += 1;
                g.interactionsThisRoom = 0;
                g.potionUsedThisRoom = false;
                g.fledLastRoom = false;

                this.showRoom([...messageLines, "You enter the next room..."]);
                return;
            }

            this.showRoom(messageLines);
        },

        finishGameDeath(extraLines = null) {
            const g = this.game;
            const remainingEnemyRankSum =
                g.deck
                    .filter((c) => c && isEnemy(c))
                    .reduce((sum, c) => sum + c.rank, 0) +
                g.table
                    .filter((c) => c && isEnemy(c))
                    .reduce((sum, c) => sum + c.rank, 0);
            const score = -1 * remainingEnemyRankSum;

            this.mode = "gameOver";
            this.setScreen({
                lines: [
                    "Game over",
                    "",
                    "You have fallen.",
                    ...(extraLines ?? []),
                    `Score: ${score}`,
                    "",
                    `(Remaining enemy ranks: ${remainingEnemyRankSum})`,
                ],
                options: [
                    {
                        key: "1",
                        label: "Main menu",
                        onSelect: () => this.showMenu(),
                    },
                    {
                        key: "2",
                        label: "Restart",
                        onSelect: () =>
                            this.beginDungeonCreation({
                                includeSpecialCards: g.includeSpecialCards ?? true,
                            }),
                    },
                ],
            });
        },

        finishGameClear(bonusCardOverride = null) {
            const g = this.game;
            const bonusCard = bonusCardOverride;
            const bonus = bonusCard && isPotion(bonusCard) ? bonusCard.rank : 0;
            const score = g.hp + bonus;
            const bonusLine = bonus
                ? {
                      parts: [
                          "Last card bonus: +",
                          String(bonus),
                          " (",
                          cardSpan(bonusCard),
                          ")",
                      ],
                  }
                : "Last card bonus: +0";

            this.mode = "gameOver";
            this.setScreen({
                lines: [
                    "Cleared!",
                    "",
                    `HP remaining: ${g.hp}`,
                    bonusLine,
                    `Score: ${score}`,
                ],
                options: [
                    {
                        key: "1",
                        label: "Main menu",
                        onSelect: () => this.showMenu(),
                    },
                    {
                        key: "2",
                        label: "Restart",
                        onSelect: () =>
                            this.beginDungeonCreation({
                                includeSpecialCards: g.includeSpecialCards ?? true,
                            }),
                    },
                ],
            });
        },
    };

    return app;
}

// Expose as a global for simple script-tag usage.
window.createScoundrelApp = createScoundrelApp;
