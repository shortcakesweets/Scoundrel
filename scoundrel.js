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

    function clearOutput() {
        outputEl.innerHTML = "";
    }

    function addLine(text, className) {
        const line = document.createElement("div");
        line.className = className ? `line ${className}` : "line";
        line.textContent = text;
        outputEl.appendChild(line);
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
            if (typeof l === "string") addLine(l);
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

        setScreen(screenModel) {
            applyColoredTextSetting(this.settings.coloredText);
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
            this.showMenu();
        },

        showMenu() {
            this.mode = "menu";
            this.game = null;
            this.pending = null;

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
                        onSelect: () => this.startGame({ includeSpecialCards: false }),
                    },
                    {
                        key: "2",
                        label: "Start game +",
                        onSelect: () => this.startGame({ includeSpecialCards: true }),
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
                    "How to play",
                    "",
                    "You are a scoundrel exploring rooms filled with enemies...",
                    "",
                    "Modes:",
                    "- Start game: Classic (no J/Q/K/A Hearts/Diamonds).",
                    "- Start game +: Includes toolkits and poison.",
                    "",
                    "Card types:",
                    "- Diamonds 2-10 (◆): Weapons.",
                    "   You may equip only one weapon at a time.",
                    "   If you take one up, the old one will be discarded.",
                    "   Weapons can only be used on enemies with rank lower",
                    "   than the last enemy killed with that weapon.",
                    "- Diamonds J/Q/K/A (◆): Repair Toolkits.",
                    "   Removes the top enemy from your weapon's kill stack.",
                    "- Spades/Clubs (♠/♣): Enemies.",
                    "- Hearts 2-10(♥): Health Potions",
                    "   Each room, you may use only one potion. Second one fizzles.",
                    "   You cannot heal beyond your starting HP (20).",
                    "   J/Q/K/A of Hearts are Poison Potions (damage).",
                    "   J/Q/K/A of Diamonds are Repair Toolkits (pop weapon stack).",
                    "- Hearts J/Q/K/A (♥): Poison Potions.",
                    "   Deal damage to you when used. Each room, you may use only one potion.",
                    "",
                    "Enemies:",
                    "- Weapon: takes damage of max(0, enemy - weapon).",
                    "- Fist: takes damage of enemy rank, but does not affect weapon stack.",
                    "",
                    "Gameplay:",
                    "  In a room, you may flee once (not twice in a row),",
                    "  or fight by interacting with 3 cards; the 4th carries over.",
                    "  You die if your remaining hp is 0",
                    "  You clear the game if you run out of cards to draw a new room.",
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

        startGame({ includeSpecialCards = true } = {}) {
            // Ensure at least 1 weapon is present in the first room.
            let deck = createDeck({ includeSpecialCards });
            let table = [
                drawTop(deck),
                drawTop(deck),
                drawTop(deck),
                drawTop(deck),
            ];
            let safety = 0;
            while (!table.some((c) => c && isWeapon(c)) && safety < 200) {
                deck = createDeck({ includeSpecialCards });
                table = [
                    drawTop(deck),
                    drawTop(deck),
                    drawTop(deck),
                    drawTop(deck),
                ];
                safety += 1;
            }

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
                            this.startGame({
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
                            this.startGame({
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
