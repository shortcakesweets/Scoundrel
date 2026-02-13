import { Scoundrel } from "./scoundrel_logic.js";
import * as Card from "./card.js";
import { getOptions } from "./options.js";

const MAX_HP = 20;
const BLANK_SRC = "cards/Blank.png";
const HOLD_MS = 1000;

const getStackMetrics = (root) => {
    const scope = root.querySelector(".game") || root;
    const styles = getComputedStyle(scope);
    const cardWidth = parseFloat(styles.getPropertyValue("--card-w")) || 71;
    const cardHeight = parseFloat(styles.getPropertyValue("--card-h")) || 96;
    const stackOffset = parseFloat(styles.getPropertyValue("--stack-offset")) || 23;
    const stackMax = parseInt(styles.getPropertyValue("--stack-max"), 10) || 8;
    return {
        cardWidth,
        cardHeight,
        stackOffset,
        stackMax,
    };
};

const suitToLetter = (suit) => {
    switch (suit) {
        case Card.SPADES:
            return "S";
        case Card.HEARTS:
            return "H";
        case Card.DIAMONDS:
            return "D";
        case Card.CLUBS:
            return "C";
        default:
            return "X";
    }
};

const suitToName = (suit) => {
    switch (suit) {
        case Card.SPADES:
            return "Spades";
        case Card.HEARTS:
            return "Hearts";
        case Card.DIAMONDS:
            return "Diamonds";
        case Card.CLUBS:
            return "Clubs";
        default:
            return "Unknown";
    }
};

const suitToSymbol = (suit) => {
    switch (suit) {
        case Card.SPADES:
            return "♠";
        case Card.HEARTS:
            return "♥";
        case Card.DIAMONDS:
            return "◆";
        case Card.CLUBS:
            return "♣";
        default:
            return "?";
    }
};

const rankToLabel = (rank) => {
    switch (rank) {
        case 11:
            return "J";
        case 12:
            return "Q";
        case 13:
            return "K";
        case 14:
            return "A";
        default:
            return String(rank);
    }
};

const rankToName = (rank) => {
    switch (rank) {
        case 11:
            return "Jack";
        case 12:
            return "Queen";
        case 13:
            return "King";
        case 14:
            return "Ace";
        default:
            return String(rank);
    }
};

const randomEnemyCard = () => {
    const suit = Math.random() < 0.5 ? Card.SPADES : Card.CLUBS;
    const rank = Math.floor(Math.random() * 13) + 2;
    return Card.card(suit, rank);
};

const getEnemyDamage = (game, card, method) => {
    if (method === "weapon") {
        const weaponRank = game.weapon ? Card.rank(game.weapon) : 0;
        return Math.max(Card.rank(card) - weaponRank, 0);
    }
    return Card.rank(card);
};

const buildActionInfo = (game, actionId, card) => {
    if (actionId === -1) {
        return { type: "flee" };
    }
    if (!card) {
        return null;
    }
    if (Card.isEnemy(card)) {
        const method = actionId % 2 === 1 ? "weapon" : "fist";
        const damage = getEnemyDamage(game, card, method);
        const lethal = game.hp < damage;
        return {
            type: "enemy",
            card,
            method,
            lethal,
        };
    }
    if (Card.isWeapon(card)) {
        return { type: "weapon", card };
    }
    if (Card.isRepairKit(card)) {
        return { type: "repair", card, hadStack: game.weaponStack.length > 0 };
    }
    if (Card.isHealthPotion(card)) {
        return { type: "health", card, effective: game.isPotionEffective };
    }
    if (Card.isPoisonPotion(card)) {
        return { type: "poison", card, effective: game.isPotionEffective };
    }
    return { type: "take", card };
};

const actionToText = (info) => {
    if (!info) {
        return "";
    }
    const cardName = info.card ? cardToAlt(info.card) : "";
    switch (info.type) {
        case "flee":
            return "You dash to a new room.";
        case "enemy":
            if (info.lethal) {
                if (info.method === "weapon") {
                    return `You swing at ${cardName}, but it was not enough.`;
                }
                return `You charge at ${cardName}, but it's futile.`;
            }
            if (info.method === "weapon") {
                return `You cut down ${cardName} with your weapon.`;
            }
            return `You knock out ${cardName} bare‑handed.`;
        case "weapon":
            return `You equip ${cardName}.`;
        case "repair":
            return `You use ${cardName} to sharpen your weapon.`;
        case "health":
            if (info.effective) {
                return `You drink ${cardName}. You feel better.`;
            }
            return `You drink ${cardName}. It fizzles.`;
        case "poison":
            if (info.effective) {
                return `You drink ${cardName}. Your throat burns!`;
            }
            return `You drink ${cardName}. It fizzles.`;
        case "take":
            return `You take ${cardName}.`;
        default:
            return "";
    }
};

const roomToText = (enemyCount) => {
    if (enemyCount === 0) {
        return "The room is quiet.";
    }
    if (enemyCount == 1){
        return "An enemy is in sight."
    }
    if (enemyCount == 2) {
        return "Enemies ahead.";
    }
    return "This room is packed with enemies!";
};

const buildIntroText = (state, game) => {
    if (state.introDone) {
        return "";
    }
    const lines = ["You step into the dungeon."];
    if (!state.halfwayAnnounced && game.deck.length <= 24) {
        lines.push("You're halfway through.");
        state.halfwayAnnounced = true;
    }
    if (!state.lastRoomAnnounced && game.deck.length === 0) {
        lines.push("This feels like the last room.");
        state.lastRoomAnnounced = true;
    }
    state.introDone = true;
    return lines.join("\n");
};

const cardToImage = (card) => {
    if (!card) {
        return BLANK_SRC;
    }

    const suit = Card.suit(card);
    const rank = Card.rank(card);
    const suitLetter = suitToLetter(suit);
    const rankLabel = rankToLabel(rank);
    return `cards/${suitLetter}${rankLabel}.png`;
};

const cardToAlt = (card) => {
    if (!card) {
        return "Empty card slot";
    }

    const suit = Card.suit(card);
    const rank = Card.rank(card);
    return `${rankToLabel(rank)}${suitToSymbol(suit)}`;
};

const ensureWeaponFirstRoom = (game) => {
    if (game.room.some((card) => Card.isWeapon(card))) {
        return;
    }

    const index = game.deck.findIndex((card) => Card.isWeapon(card));
    if (index === -1) {
        return;
    }

    const weapon = game.deck.splice(index, 1)[0];
    const replaceIndex = game.room.findIndex((card) => card !== 0);
    if (replaceIndex === -1) {
        game.room[0] = weapon;
        return;
    }

    const replaced = game.room[replaceIndex];
    game.room[replaceIndex] = weapon;
    if (replaced !== 0) {
        game.deck.push(replaced);
    }
};

const hintForCard = (card) => {
    if (!card) {
        return { text: "", type: "" };
    }

    if (Card.isEnemy(card)) {
        return { text: "Enemy", type: "enemy" };
    }

    if (Card.isWeapon(card)) {
        return { text: "Weapon", type: "weapon" };
    }

    if (Card.isRepairKit(card)) {
        return { text: "Repair kit", type: "repair" };
    }

    if (Card.isHealthPotion(card)) {
        return { text: "Health Potion", type: "health" };
    }

    if (Card.isPoisonPotion(card)) {
        return { text: "Poison Potion", type: "poison" };
    }

    return { text: "", type: "" };
};

const render = (state) => {
    const { root, game, options } = state;
    const possibleActions = game.getPossibleActions();
    const deckCount = root.querySelector("#deck-count");
    const roomNum = root.querySelector("#room-num");
    const hpFill = root.querySelector("#hp-fill");
    const hpText = root.querySelector("#hp-text");
    const hpBar = root.querySelector(".hp-bar");
    const hintText = root.querySelector("#hint-text");
    const dialogueText = root.querySelector("#dialogue-text");
    const weaponButton = root.querySelector("[data-action='weapon']");
    const actionButton = root.querySelector("#action-button");
    const actionImg = root.querySelector("#action-card");
    const actionLabel = root.querySelector("#action-label");

    if (deckCount) {
        deckCount.textContent = String(game.deck.length);
    }

    if (roomNum) {
        roomNum.textContent = String(game.roomNum);
    }

    const hpPercent = Math.max(0, Math.min(game.hp, MAX_HP)) / MAX_HP;
    if (hpFill) {
        hpFill.style.width = `${hpPercent * 100}%`;
    }

    if (hpText) {
        hpText.textContent = `HP ${game.hp} / ${MAX_HP}`;
    }

    if (hpBar) {
        hpBar.setAttribute("aria-valuenow", String(game.hp));
    }

    root.classList.toggle("hints-hidden", !options.hintText);

    if (state.selectedSlot !== null) {
        const selectedCard = game.room[state.selectedSlot];
        if (!selectedCard || !Card.isEnemy(selectedCard) || game.isTerminal()) {
            state.selectedSlot = null;
        }
    }

    const roomButtons = root.querySelectorAll("[data-room-slot]");
    roomButtons.forEach((button) => {
        const slot = Number(button.dataset.roomSlot);
        const card = Number.isNaN(slot) ? 0 : game.room[slot];
        const img = button.querySelector("img");
        if (!img) {
            return;
        }

        img.src = cardToImage(card);
        img.alt = cardToAlt(card);
        button.disabled = game.isTerminal();
        button.dataset.empty = card === 0 ? "true" : "false";
        button.classList.toggle("is-selected", slot === state.selectedSlot);

        const hint = button.querySelector("[data-room-hint]");
        if (hint) {
            const hintData = hintForCard(card);
            hint.textContent = hintData.text;
            if (hintData.type) {
                hint.dataset.hintType = hintData.type;
            } else {
                delete hint.dataset.hintType;
            }
        }
    });

    const weaponImg = root.querySelector("#weapon-card");
    if (weaponImg) {
        weaponImg.src = cardToImage(game.weapon);
        weaponImg.alt = game.weapon ? cardToAlt(game.weapon) : "Empty weapon slot";
        weaponImg.dataset.empty = game.weapon === 0 ? "true" : "false";
    }

    const weaponStack = root.querySelector("#weapon-stack");
    if (weaponStack) {
        const { cardWidth, cardHeight, stackOffset, stackMax } = getStackMetrics(root);
        const maxWidth = cardWidth + (stackMax - 1) * stackOffset;
        weaponStack.style.width = `${maxWidth}px`;
        weaponStack.style.height = `${cardHeight}px`;
        weaponStack.innerHTML = "";
        const stackCards = game.weaponStack.length === 0 ? [0] : game.weaponStack;
        const count = stackCards.length;
        const offset = count <= stackMax ? stackOffset : (maxWidth - cardWidth) / (count - 1);
        stackCards.forEach((card, index) => {
            const img = document.createElement("img");
            img.src = card ? cardToImage(card) : BLANK_SRC;
            img.alt = card ? cardToAlt(card) : "Empty weapon stack";
            img.className = "stack-card";
            img.style.left = `${index * offset}px`;
            img.style.zIndex = String(index);
            if (!card) {
                img.dataset.empty = "true";
            }
            weaponStack.appendChild(img);
        });
    }

    const selectedSlot = state.selectedSlot;
    const hasEnemySelection = selectedSlot !== null && Card.isEnemy(game.room[selectedSlot]);
    const weaponAvailable = hasEnemySelection && possibleActions.includes(2 * selectedSlot + 1);
    const fistAvailable = hasEnemySelection && possibleActions.includes(2 * selectedSlot);
    const fleeAvailable = possibleActions.includes(-1) && !game.isTerminal();

    if (actionButton && actionImg && actionLabel) {
        if (hasEnemySelection) {
            actionButton.dataset.action = "fist";
            actionImg.src = "cards/Fist.png";
            actionImg.alt = "Fist";
            actionLabel.textContent = "Fist";
            actionButton.classList.add("is-choice");
            actionButton.disabled = !fistAvailable;
            actionButton.classList.toggle("is-disabled", !fistAvailable);
        } else {
            actionButton.dataset.action = "flee";
            actionImg.src = "cards/Flee.png";
            actionImg.alt = "Flee";
            actionLabel.textContent = "Flee";
            actionButton.classList.remove("is-choice");
            actionButton.disabled = !fleeAvailable;
            actionButton.classList.toggle("is-disabled", !fleeAvailable);
        }
    }

    if (weaponButton) {
        const disabled = hasEnemySelection && !weaponAvailable;
        weaponButton.disabled = disabled;
        weaponButton.classList.toggle("is-choice", hasEnemySelection);
        weaponButton.classList.toggle("is-disabled", disabled);
    }

    if (hintText) {
        if (!options.hintText || !game.isTerminal()) {
            hintText.textContent = "";
            hintText.classList.add("is-hidden");
        } else {
            hintText.classList.remove("is-hidden");
            hintText.textContent = game.isWin() ? "You escaped." : "You fell in the dungeon.";
        }
    }

    const selectionText = hasEnemySelection
        ? `You stare at ${cardToAlt(game.room[selectedSlot])}. It stares back.\nYou use your...`
        : "";
    const actionText = selectionText || actionToText(state.lastAction);
    const resultText = game.isTerminal()
        ? (game.isWin()
            ? `You escaped the dungeon.\nScore: ${game.score()}.`
            : `You fell.\nScore: ${game.score()}.`)
        : "";
    const introText = buildIntroText(state, game);
    let roomText = "";
    if (state.lastRoomNum !== game.roomNum) {
        const enemyCount = game.room.filter((card) => Card.isEnemy(card)).length;
        roomText = roomToText(enemyCount);
        state.lastRoomNum = game.roomNum;
    }

    if (dialogueText) {
        const parts = [actionText, resultText, introText, roomText].filter((text) => text);
        dialogueText.textContent = parts.join("\n");
    }
};

export const initGame = (root = document, config = {}) => {
    const options = getOptions();
    const seedValue = typeof config.seed === "string" ? config.seed : (Number.isFinite(config.seed) ? config.seed : Date.now());
    const seed = String(seedValue);
    const ascension = Number.isFinite(config.ascension) ? config.ascension : 0;
    const game = new Scoundrel(seed, ascension);

    if (options.firstRoomWeapon) {
        ensureWeaponFirstRoom(game);
    }

    const state = {
        root,
        game,
        options,
        selectedSlot: null,
        ascension,
        lastAction: null,
        introDone: false,
        halfwayAnnounced: false,
        lastRoomAnnounced: false,
        lastRoomNum: null,
    };
    let activeHoldButton = null;
    let holdTimer = null;

    const dispatchGameEvent = (name, detail = {}) => {
        root.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
    };

    const handleClick = (event) => {
        const selectedSlot = state.selectedSlot;
        const selectionActive = selectedSlot !== null && Card.isEnemy(game.room[selectedSlot]);
        const actionButton = event.target.closest("[data-action]");
        const action = actionButton?.dataset.action;

        if (selectionActive && action !== "weapon" && action !== "fist") {
            state.selectedSlot = null;
            render(state);
            return;
        }

        if (actionButton && root.contains(actionButton)) {
            if (action === "flee") {
                if (game.getPossibleActions().includes(-1)) {
                    state.lastAction = buildActionInfo(game, -1, 0);
                    game.takeAction(-1);
                    state.selectedSlot = null;
                    render(state);
                }
                return;
            }
            if (action === "weapon" || action === "fist") {
                if (state.selectedSlot === null) {
                    return;
                }
                const selectedSlot = state.selectedSlot;
                const selectedCard = game.room[selectedSlot];
                if (!selectedCard || !Card.isEnemy(selectedCard)) {
                    state.selectedSlot = null;
                    render(state);
                    return;
                }
                const actionId = action === "weapon" ? 2 * selectedSlot + 1 : 2 * selectedSlot;
                if (game.getPossibleActions().includes(actionId)) {
                    state.lastAction = buildActionInfo(game, actionId, selectedCard);
                    game.takeAction(actionId);
                    state.selectedSlot = null;
                    render(state);
                }
                return;
            }
        }

        const debugButton = event.target.closest("[data-debug='stack']");
        if (debugButton && root.contains(debugButton)) {
            game.weaponStack.push(randomEnemyCard());
            render(state);
            return;
        }

        const button = event.target.closest("[data-room-slot]");
        if (!button || !root.contains(button)) {
            return;
        }

        const slot = Number(button.dataset.roomSlot);
        if (Number.isNaN(slot)) {
            return;
        }

        const card = game.room[slot];
        if (!card || game.isTerminal()) {
            return;
        }

        if (Card.isEnemy(card)) {
            state.selectedSlot = slot;
            render(state);
            return;
        }

        const actionId = 2 * slot;
        if (game.getPossibleActions().includes(actionId)) {
            state.lastAction = buildActionInfo(game, actionId, card);
            game.takeAction(actionId);
        }
        state.selectedSlot = null;
        render(state);
    };

    const startHold = (button) => {
        if (button.disabled) {
            return;
        }
        activeHoldButton = button;
        button.classList.add("is-holding");
        holdTimer = setTimeout(() => {
            const action = button.dataset.holdAction;
            button.classList.remove("is-holding");
            if (action === "menu") {
                dispatchGameEvent("game:menu");
            } else if (action === "reset") {
                dispatchGameEvent("game:reset", { ascension: state.ascension });
            }
            activeHoldButton = null;
            holdTimer = null;
        }, HOLD_MS);
    };

    const cancelHold = () => {
        if (!activeHoldButton) {
            return;
        }
        activeHoldButton.classList.remove("is-holding");
        if (holdTimer) {
            clearTimeout(holdTimer);
        }
        activeHoldButton = null;
        holdTimer = null;
    };

    const handleHoldPointerDown = (event) => {
        if (state.selectedSlot !== null && Card.isEnemy(game.room[state.selectedSlot])) {
            return;
        }

        const button = event.target.closest("[data-hold-action]");
        if (!button || !root.contains(button)) {
            return;
        }
        event.preventDefault();
        if (typeof button.setPointerCapture === "function") {
            button.setPointerCapture(event.pointerId);
        }
        cancelHold();
        startHold(button);
    };

    const handleHoldPointerUp = (event) => {
        const button = event.target.closest("[data-hold-action]");
        if (button && typeof button.releasePointerCapture === "function") {
            try {
                button.releasePointerCapture(event.pointerId);
            } catch (error) {
                // ignore
            }
        }
        cancelHold();
    };

    const handleCancelContextMenu = (event) => {
        if (state.selectedSlot !== null && Card.isEnemy(game.room[state.selectedSlot])) {
            event.preventDefault();
            state.selectedSlot = null;
            render(state);
        }
    };

    root.addEventListener("click", handleClick);
    root.addEventListener("pointerdown", handleHoldPointerDown);
    root.addEventListener("pointerup", handleHoldPointerUp);
    root.addEventListener("pointercancel", handleHoldPointerUp);
    root.addEventListener("contextmenu", handleCancelContextMenu);
    render(state);

    return () => {
        root.removeEventListener("click", handleClick);
        root.removeEventListener("pointerdown", handleHoldPointerDown);
        root.removeEventListener("pointerup", handleHoldPointerUp);
        root.removeEventListener("pointercancel", handleHoldPointerUp);
        root.removeEventListener("contextmenu", handleCancelContextMenu);
    };
};
