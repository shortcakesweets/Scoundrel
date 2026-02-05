/* global module, window */

// Scoundrel dungeon solver (bruteforce via DFS).
// Pure logic: no DOM dependencies.
//
// Deck representation:
// - A deck is an array of cards, where the TOP of the deck is at the END of the array
//   (matches the game implementation that uses `pop()` to draw).
// - Card: { suit: "hearts"|"diamonds"|"clubs"|"spades", rank: 2..14 }
//
// Usage (browser):
//   const result = window.ScoundrelSolver.solve(deck, { includeSpecialCards: true });
//
// Usage (node):
//   const { solve, parseCard } = require("./solver.js");

function createSolver() {
    const SUIT = {
        hearts: "hearts",
        diamonds: "diamonds",
        clubs: "clubs",
        spades: "spades",
    };

    const SUIT_TO_INDEX = {
        [SUIT.hearts]: 0,
        [SUIT.diamonds]: 1,
        [SUIT.clubs]: 2,
        [SUIT.spades]: 3,
    };

    const INDEX_TO_SUIT = {
        0: SUIT.hearts,
        1: SUIT.diamonds,
        2: SUIT.clubs,
        3: SUIT.spades,
    };

    const SUIT_SYMBOL = {
        [SUIT.hearts]: "♥",
        [SUIT.diamonds]: "◆",
        [SUIT.clubs]: "♣",
        [SUIT.spades]: "♠",
    };

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

    function parseCard(text) {
        // Accept forms like: "10♠", "A♣", "K◆", "Q♥"
        const s = String(text).trim();
        const suitChar = s.slice(-1);
        const rankPart = s.slice(0, -1).toUpperCase();
        const suit = (() => {
            if (suitChar === "♥") return SUIT.hearts;
            if (suitChar === "◆" || suitChar === "♦") return SUIT.diamonds;
            if (suitChar === "♣") return SUIT.clubs;
            if (suitChar === "♠") return SUIT.spades;
            return null;
        })();
        if (!suit) throw new Error(`Unknown suit in card: ${text}`);

        const rank = (() => {
            if (rankPart === "A") return 14;
            if (rankPart === "K") return 13;
            if (rankPart === "Q") return 12;
            if (rankPart === "J") return 11;
            const n = Number(rankPart);
            if (Number.isInteger(n) && n >= 2 && n <= 10) return n;
            throw new Error(`Unknown rank in card: ${text}`);
        })();

        return { suit, rank };
    }

    function isEnemy(card) {
        return card.suit === SUIT.spades || card.suit === SUIT.clubs;
    }

    function isWeapon(card) {
        return card.suit === SUIT.diamonds && card.rank <= 10;
    }

    function isHealingPotion(card) {
        return card.suit === SUIT.hearts && card.rank <= 10;
    }

    function isRepairToolkit(card) {
        return card.suit === SUIT.diamonds && card.rank >= 11;
    }

    function isPoisonPotion(card) {
        return card.suit === SUIT.hearts && card.rank >= 11;
    }

    function filterDeckForMode(deck, includeSpecialCards) {
        if (includeSpecialCards) return deck.slice();
        return deck.filter((c) => {
            if (c.suit !== SUIT.hearts && c.suit !== SUIT.diamonds) return true;
            return c.rank <= 10;
        });
    }

    function drawTop(deck) {
        return deck.pop() ?? null;
    }

    function cloneState(s) {
        return {
            hp: s.hp,
            deck: s.deck.slice(),
            table: s.table.slice(),
            weaponRank: s.weaponRank,
            weaponKills: s.weaponKills.slice(), // stack of enemy ranks
            potionUsedThisRoom: s.potionUsedThisRoom,
            interactionsThisRoom: s.interactionsThisRoom,
            fledLastRoom: s.fledLastRoom,
        };
    }

    function encodeCard(card) {
        // 0 = null, else suitIndex*16 + rank (rank 2..14)
        if (!card) return 0;
        return SUIT_TO_INDEX[card.suit] * 16 + card.rank;
    }

    function decodeCard(id) {
        if (!id) return null;
        const suitIndex = Math.floor(id / 16);
        const rank = id % 16;
        return { suit: INDEX_TO_SUIT[suitIndex], rank };
    }

    function stateKey(s) {
        // Compact serialization for memoization.
        const deckKey = s.deck.map(encodeCard).join(",");
        const tableKey = s.table.map(encodeCard).join(",");
        const killsKey = s.weaponKills.join(".");
        return [
            s.hp,
            s.weaponRank,
            s.potionUsedThisRoom ? 1 : 0,
            s.interactionsThisRoom,
            s.fledLastRoom ? 1 : 0,
            killsKey,
            "|",
            tableKey,
            "|",
            deckKey,
        ].join(":");
    }

    function makeInitialState(deck, { includeSpecialCards = true, startingHp = 20 } = {}) {
        const filtered = filterDeckForMode(deck, includeSpecialCards);
        const d = filtered.slice();
        const table = [drawTop(d), drawTop(d), drawTop(d), drawTop(d)];
        return {
            hp: startingHp,
            deck: d,
            table,
            weaponRank: 0,
            weaponKills: [],
            potionUsedThisRoom: false,
            interactionsThisRoom: 0,
            fledLastRoom: false,
        };
    }

    function isWinState(s) {
        return s.hp > 0 && s.deck.length === 0 && !s.table.some(Boolean);
    }

    function isDeadState(s) {
        return s.hp <= 0;
    }

    function enumerateActions(s) {
        const actions = [];

        if (s.interactionsThisRoom === 0 && !s.fledLastRoom && s.table.some(Boolean)) {
            actions.push({ type: "flee" });
        }

        for (let i = 0; i < 4; i += 1) {
            const card = s.table[i];
            if (!card) continue;

            if (isEnemy(card)) {
                actions.push({ type: "enemy", slot: i, method: "fist" });
                const weaponAllowed = (() => {
                    if (s.weaponRank <= 0) return false;
                    if (s.weaponKills.length === 0) return true;
                    return card.rank < s.weaponKills[s.weaponKills.length - 1];
                })();
                if (weaponAllowed) actions.push({ type: "enemy", slot: i, method: "weapon" });
                continue;
            }

            if (isWeapon(card)) {
                actions.push({ type: "weapon", slot: i });
                continue;
            }

            if (isRepairToolkit(card)) {
                actions.push({ type: "toolkit", slot: i });
                continue;
            }

            if (isHealingPotion(card) || isPoisonPotion(card)) {
                actions.push({ type: "potion", slot: i });
                continue;
            }
        }

        return actions;
    }

    function afterInteraction(s) {
        s.interactionsThisRoom += 1;

        // Game ends when the last card is used.
        if (s.deck.length === 0 && !s.table.some(Boolean)) return { terminal: "win" };

        const hasAnyTableCard = s.table.some(Boolean);
        if (s.interactionsThisRoom >= 3 || !hasAnyTableCard) {
            for (let i = 0; i < 4; i += 1) {
                if (s.table[i] === null && s.deck.length > 0) {
                    s.table[i] = drawTop(s.deck);
                }
            }
            s.interactionsThisRoom = 0;
            s.potionUsedThisRoom = false;
            s.fledLastRoom = false;
        }

        return { terminal: null };
    }

    function applyAction(s0, action) {
        const s = cloneState(s0);

        if (action.type === "flee") {
            // Move table cards to bottom of deck (deck bottom is index 0).
            for (let i = 3; i >= 0; i -= 1) {
                const c = s.table[i];
                if (c) s.deck.unshift(c);
            }
            s.table = [drawTop(s.deck), drawTop(s.deck), drawTop(s.deck), drawTop(s.deck)];
            s.interactionsThisRoom = 0;
            s.potionUsedThisRoom = false;
            s.fledLastRoom = true;
            return { state: s, terminal: null };
        }

        const slot = action.slot;
        const card = s.table[slot];
        if (!card) return { state: null, terminal: null };

        // Discard the card from table (interact consumes it).
        s.table[slot] = null;

        if (action.type === "enemy") {
            const enemyRank = card.rank;
            if (action.method === "weapon") {
                const weaponAllowed = (() => {
                    if (s.weaponRank <= 0) return false;
                    if (s.weaponKills.length === 0) return true;
                    return enemyRank < s.weaponKills[s.weaponKills.length - 1];
                })();
                if (!weaponAllowed) return { state: null, terminal: null };
                const damage = Math.max(0, enemyRank - s.weaponRank);
                s.hp = Math.max(0, s.hp - damage);
                if (s.hp <= 0) return { state: null, terminal: "dead" };
                s.weaponKills.push(enemyRank);
            } else {
                s.hp = Math.max(0, s.hp - enemyRank);
                if (s.hp <= 0) return { state: null, terminal: "dead" };
            }

            const end = afterInteraction(s);
            return { state: end.terminal ? null : s, terminal: end.terminal };
        }

        if (action.type === "weapon") {
            s.weaponRank = card.rank;
            s.weaponKills = [];
            const end = afterInteraction(s);
            return { state: end.terminal ? null : s, terminal: end.terminal };
        }

        if (action.type === "toolkit") {
            if (s.weaponRank > 0 && s.weaponKills.length > 0) {
                s.weaponKills.pop();
            }
            const end = afterInteraction(s);
            return { state: end.terminal ? null : s, terminal: end.terminal };
        }

        if (action.type === "potion") {
            const isLastCardOverall = s.deck.length === 0 && !s.table.some(Boolean);

            // Bonus system: if the last used card is a healing potion, it ends immediately.
            if (isLastCardOverall && isHealingPotion(card)) {
                return { state: null, terminal: "win" };
            }

            if (s.potionUsedThisRoom) {
                const end = afterInteraction(s);
                return { state: end.terminal ? null : s, terminal: end.terminal };
            }

            s.potionUsedThisRoom = true;
            if (isPoisonPotion(card)) {
                s.hp = Math.max(0, s.hp - 10);
                if (s.hp <= 0) return { state: null, terminal: "dead" };
                const end = afterInteraction(s);
                return { state: end.terminal ? null : s, terminal: end.terminal };
            }

            // Healing potion
            s.hp = Math.min(20, s.hp + card.rank);
            const end = afterInteraction(s);
            return { state: end.terminal ? null : s, terminal: end.terminal };
        }

        return { state: null, terminal: null };
    }

    function solve(deck, opts = {}) {
        const {
            includeSpecialCards = true,
            startingHp = 20,
            maxNodes = 500000,
            returnPath = false,
            timeLimitMs = null,
        } = opts;

        const initial = makeInitialState(deck, { includeSpecialCards, startingHp });
        if (isDeadState(initial)) return { clearable: false, reason: "dead_start" };
        if (isWinState(initial)) return { clearable: true, path: [] };

        const visited = new Set();
        const parent = returnPath ? new Map() : null; // key -> { prevKey, action }

        let nodes = 0;
        const startMs = typeof timeLimitMs === "number" ? Date.now() : null;

        const stack = [{ state: initial, actions: null, index: 0 }];
        const keyStack = [stateKey(initial)];
        if (parent) parent.set(keyStack[0], { prevKey: null, action: null });

        while (stack.length > 0) {
            if (startMs !== null && Date.now() - startMs >= timeLimitMs) {
                return { clearable: null, reason: "time_limit", nodes, ms: Date.now() - startMs };
            }
            if (nodes++ > maxNodes) {
                return { clearable: null, reason: "node_limit", nodes };
            }

            const frame = stack[stack.length - 1];
            const key = keyStack[keyStack.length - 1];

            if (!frame.actions) {
                if (visited.has(key)) {
                    stack.pop();
                    keyStack.pop();
                    continue;
                }
                visited.add(key);

                if (isDeadState(frame.state)) {
                    stack.pop();
                    keyStack.pop();
                    continue;
                }
                if (isWinState(frame.state)) {
                    return { clearable: true, nodes, path: returnPath ? [] : undefined };
                }

                frame.actions = enumerateActions(frame.state);
                frame.index = 0;
            }

            if (frame.index >= frame.actions.length) {
                stack.pop();
                keyStack.pop();
                continue;
            }

            const action = frame.actions[frame.index++];
            const out = applyAction(frame.state, action);
            if (out.terminal === "win") {
                if (!returnPath) return { clearable: true, nodes };
                const winKey = `${key}=>WIN@${frame.index - 1}`;
                parent.set(winKey, { prevKey: key, action });
                const path = [];
                let cur = winKey;
                while (true) {
                    const p = parent.get(cur);
                    if (!p || !p.prevKey) break;
                    path.push(p.action);
                    cur = p.prevKey;
                }
                path.reverse();
                return { clearable: true, nodes, path };
            }
            if (out.terminal === "dead" || !out.state) continue;

            const nextKey = stateKey(out.state);
            if (visited.has(nextKey)) continue;

            stack.push({ state: out.state, actions: null, index: 0 });
            keyStack.push(nextKey);
            if (parent && !parent.has(nextKey)) parent.set(nextKey, { prevKey: key, action });
        }

        return { clearable: false, nodes, ms: startMs !== null ? Date.now() - startMs : undefined };
    }

    return {
        solve,
        makeInitialState,
        parseCard,
        cardText,
        decodeCard,
        encodeCard,
    };
}

const solver = createSolver();

// Browser global
if (typeof window !== "undefined") {
    window.ScoundrelSolver = solver;
}

// Node/CommonJS export
if (typeof module !== "undefined" && module.exports) {
    module.exports = solver;
}
