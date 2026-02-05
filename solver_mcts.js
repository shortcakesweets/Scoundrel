/* global module, window, require, process */

// MCTS solver for Scoundrel (JS port inspired by the Python MCTS implementation).
// Uses our game rules (including Scoundrel+ cards), no multithreading.

function createMctsSolver() {
    const SUIT = {
        hearts: "hearts",
        diamonds: "diamonds",
        clubs: "clubs",
        spades: "spades",
    };

    const SCORE_MIN = -188;
    const SCORE_MAX = 30;
    const SCORE_RANGE = SCORE_MAX - SCORE_MIN;

    const SUIT_TO_INDEX = {
        [SUIT.hearts]: 0,
        [SUIT.diamonds]: 1,
        [SUIT.clubs]: 2,
        [SUIT.spades]: 3,
    };

    function normalizeScore(score) {
        const clamped = Math.max(SCORE_MIN, Math.min(SCORE_MAX, score));
        return (clamped - SCORE_MIN) / SCORE_RANGE;
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
            weaponKills: s.weaponKills.slice(),
            potionUsedThisRoom: s.potionUsedThisRoom,
            interactionsThisRoom: s.interactionsThisRoom,
            fledLastRoom: s.fledLastRoom,
            lastUsedCard: s.lastUsedCard ? { ...s.lastUsedCard } : null,
        };
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
            lastUsedCard: null,
        };
    }

    function isWinState(s) {
        return s.hp > 0 && s.deck.length === 0 && !s.table.some(Boolean);
    }

    function isDeadState(s) {
        return s.hp <= 0;
    }

    function winReward(s) {
        return isWinState(s) ? 1 : 0;
    }

    function remainingEnemyRankSum(s) {
        const deckSum = s.deck
            .filter((c) => c && isEnemy(c))
            .reduce((sum, c) => sum + c.rank, 0);
        const tableSum = s.table
            .filter((c) => c && isEnemy(c))
            .reduce((sum, c) => sum + c.rank, 0);
        return deckSum + tableSum;
    }

    function computeScore(s) {
        if (isWinState(s)) {
            const bonus = s.lastUsedCard && isHealingPotion(s.lastUsedCard)
                ? s.lastUsedCard.rank
                : 0;
            return s.hp + bonus;
        }
        if (isDeadState(s)) return -remainingEnemyRankSum(s);
        // Non-terminal estimate: hp minus half the remaining enemy sum.
        return s.hp - Math.floor(remainingEnemyRankSum(s) * 0.5);
    }

    function encodeCard(card) {
        if (!card) return 0;
        return SUIT_TO_INDEX[card.suit] * 16 + card.rank;
    }

    function stateKey(s) {
        const deckKey = s.deck.map(encodeCard).join(",");
        const tableKey = s.table.map(encodeCard).join(",");
        const killsKey = s.weaponKills.join(".");
        const lastKey = encodeCard(s.lastUsedCard);
        return [
            s.hp,
            s.weaponRank,
            s.potionUsedThisRoom ? 1 : 0,
            s.interactionsThisRoom,
            s.fledLastRoom ? 1 : 0,
            lastKey,
            killsKey,
            "|",
            tableKey,
            "|",
            deckKey,
        ].join(":");
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

        if (s.deck.length === 0 && !s.table.some(Boolean)) return { terminal: "win" };

        const hasAnyTableCard = s.table.some(Boolean);
        if (s.interactionsThisRoom >= 3 || !hasAnyTableCard) {
            let drew = 0;
            for (let i = 0; i < 4; i += 1) {
                if (s.table[i] === null && s.deck.length > 0) {
                    s.table[i] = drawTop(s.deck);
                    if (s.table[i]) drew += 1;
                }
            }
            if (drew !== 0) {
                s.interactionsThisRoom = 0;
                s.potionUsedThisRoom = false;
                s.fledLastRoom = false;
            }
        }

        return { terminal: null };
    }

    function applyAction(s0, action) {
        const s = cloneState(s0);

        if (action.type === "flee") {
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
        if (!card) return { state: null, terminal: "invalid" };

        s.table[slot] = null;
        s.lastUsedCard = card;

        if (action.type === "enemy") {
            const enemyRank = card.rank;
            if (action.method === "weapon") {
                const weaponAllowed = (() => {
                    if (s.weaponRank <= 0) return false;
                    if (s.weaponKills.length === 0) return true;
                    return enemyRank < s.weaponKills[s.weaponKills.length - 1];
                })();
                if (!weaponAllowed) return { state: null, terminal: "invalid" };
                const damage = Math.max(0, enemyRank - s.weaponRank);
                s.hp = Math.max(0, s.hp - damage);
                if (s.hp <= 0) return { state: s, terminal: "dead" };
                s.weaponKills.push(enemyRank);
            } else {
                s.hp = Math.max(0, s.hp - enemyRank);
                if (s.hp <= 0) return { state: s, terminal: "dead" };
            }

            const end = afterInteraction(s);
            return { state: s, terminal: end.terminal };
        }

        if (action.type === "weapon") {
            s.weaponRank = card.rank;
            s.weaponKills = [];
            const end = afterInteraction(s);
            return { state: s, terminal: end.terminal };
        }

        if (action.type === "toolkit") {
            if (s.weaponRank > 0 && s.weaponKills.length > 0) {
                s.weaponKills.pop();
            }
            const end = afterInteraction(s);
            return { state: s, terminal: end.terminal };
        }

        if (action.type === "potion") {
            const isLastCardOverall = s.deck.length === 0 && !s.table.some(Boolean);
            if (isLastCardOverall && isHealingPotion(card)) {
                return { state: s, terminal: "win" };
            }

            if (s.potionUsedThisRoom) {
                const end = afterInteraction(s);
                return { state: s, terminal: end.terminal };
            }

            s.potionUsedThisRoom = true;
            if (isPoisonPotion(card)) {
                s.hp = Math.max(0, s.hp - 10);
                if (s.hp <= 0) return { state: s, terminal: "dead" };
                const end = afterInteraction(s);
                return { state: s, terminal: end.terminal };
            }

            s.hp = Math.min(20, s.hp + card.rank);
            const end = afterInteraction(s);
            return { state: s, terminal: end.terminal };
        }

        return { state: null, terminal: "invalid" };
    }

    class TranspositionTable {
        constructor(maxSize = 200000) {
            this.maxSize = maxSize;
            this.cache = new Map();
            this.hits = 0;
            this.misses = 0;
        }

        get(key) {
            if (this.cache.has(key)) {
                const value = this.cache.get(key);
                this.cache.delete(key);
                this.cache.set(key, value);
                this.hits += 1;
                return value;
            }
            this.misses += 1;
            return null;
        }

        put(key, value) {
            if (this.cache.has(key)) {
                this.cache.delete(key);
            } else if (this.cache.size >= this.maxSize) {
                const oldestKey = this.cache.keys().next().value;
                this.cache.delete(oldestKey);
            }
            this.cache.set(key, value);
        }

        clear() {
            this.cache.clear();
            this.hits = 0;
            this.misses = 0;
        }

        stats() {
            const total = this.hits + this.misses;
            return {
                hits: this.hits,
                misses: this.misses,
                size: this.cache.size,
                maxSize: this.maxSize,
                hitRate: total > 0 ? this.hits / total : 0,
            };
        }
    }

    class MCTSNode {
        constructor({
            stateHash,
            state,
            parent = null,
            action = null,
            untriedActions = [],
            isTerminal = false,
        }) {
            this.stateHash = stateHash;
            this.state = state;
            this.parent = parent;
            this.action = action;
            this.children = [];
            this.visits = 0;
            this.value = 0;
            this.untriedActions = untriedActions;
            this.isTerminal = isTerminal;
        }

        isFullyExpanded() {
            return this.untriedActions.length === 0;
        }

        bestChild(explorationConstant) {
            let best = null;
            let bestScore = -Infinity;

            for (const child of this.children) {
                if (child.visits === 0) return child;
                const exploit = child.value / child.visits;
                const explore = explorationConstant * Math.sqrt(
                    Math.log(this.visits) / child.visits
                );
                const score = exploit + explore;
                if (score > bestScore) {
                    bestScore = score;
                    best = child;
                }
            }

            return best;
        }

        mostVisitedChild() {
            return this.children.reduce((best, child) =>
                (!best || child.visits > best.visits ? child : best), null
            );
        }

        update(reward) {
            this.visits += 1;
            this.value += reward;
        }
    }

    function randomChoice(list, rng) {
        const idx = Math.floor(rng() * list.length);
        return list[idx];
    }

    function heuristicPolicy(state, actions) {
        if (!actions.length) return null;

        let bestAction = actions[0];
        let bestScore = -Infinity;

        for (const action of actions) {
            let score = 0;

            if (action.type === "flee") {
                score = state.hp < 8 ? 3 : -3;
            } else if (action.type === "toolkit") {
                score = state.weaponKills.length > 0 ? 6 : -2;
            } else if (action.type === "weapon") {
                const card = state.table[action.slot];
                if (card) {
                    score = state.weaponRank > 0
                        ? (card.rank - state.weaponRank) * 2
                        : card.rank * 3;
                }
            } else if (action.type === "potion") {
                const card = state.table[action.slot];
                if (card) {
                    if (isPoisonPotion(card)) {
                        score = state.potionUsedThisRoom ? -2 : -12;
                        if (state.hp <= 10) score -= 20;
                    } else {
                        if (state.potionUsedThisRoom) score = -10;
                        else {
                            const need = 20 - state.hp;
                            score = need > 0 ? Math.min(card.rank, need) * 2 : -2;
                        }
                    }
                }
            } else if (action.type === "enemy") {
                const card = state.table[action.slot];
                if (card) {
                    const damage = action.method === "weapon"
                        ? Math.max(0, card.rank - state.weaponRank)
                        : card.rank;
                    score = -damage * 2;
                    if (damage >= state.hp) score -= 1000;
                    if (damage === 0 && action.method === "weapon") score += 4;
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestAction = action;
            }
        }

        return bestAction;
    }

    function determinizeState(state) {
        // No hidden information in this JS solver; return a clone.
        return cloneState(state);
    }

    class MCTSAgent {
        constructor({
            numSimulations = 1000000,
            explorationConstant = 1.414,
            maxDepth = 120,
            useRandomRollout = true,
            maxCacheSize = 100000,
            rng = Math.random,
            timeLimitMs = null,
        } = {}) {
            this.numSimulations = numSimulations;
            this.explorationConstant = explorationConstant;
            this.maxDepth = maxDepth;
            this.useRandomRollout = useRandomRollout;
            this.rng = rng;
            this.timeLimitMs = typeof timeLimitMs === "number" ? timeLimitMs : null;
            this.transpositionTable = new TranspositionTable(maxCacheSize);
            this._lastRoot = null;
        }

        selectAction(state) {
            const root = this.search(state);
            this._lastRoot = root;
            if (!root.children.length) return null;
            return root.mostVisitedChild().action;
        }

        search(state) {
            const root = this._createNode(state);
            const startMs = this.timeLimitMs !== null ? Date.now() : null;

            for (let i = 0; i < this.numSimulations; i += 1) {
                if (startMs !== null && Date.now() - startMs >= this.timeLimitMs) break;

                let simulationState = determinizeState(state);
                let node = root;

                ({ node, state: simulationState } = this._select(node, simulationState));

                if (!this._isGameOver(simulationState) && !node.isFullyExpanded()) {
                    ({ node, state: simulationState } = this._expand(node, simulationState));
                }

                let reward;
                if (this._isGameOver(simulationState)) {
                    reward = winReward(simulationState);
                } else {
                    reward = this._simulate(simulationState);
                }

                this._backpropagate(node, reward);
            }

            return root;
        }

        getActionStats() {
            if (!this._lastRoot || !this._lastRoot.children.length) return [];
            const stats = [];
            for (const child of this._lastRoot.children) {
                const avg = child.visits > 0 ? child.value / child.visits : 0;
                const ucb = child.visits > 0 && this._lastRoot.visits > 0
                    ? avg + this.explorationConstant * Math.sqrt(
                        Math.log(this._lastRoot.visits) / child.visits
                    )
                    : Infinity;
                stats.push({
                    action: child.action,
                    visits: child.visits,
                    avgValue: avg,
                    totalValue: child.value,
                    ucb1: ucb,
                });
            }
            return stats;
        }

        getCacheStats() {
            return this.transpositionTable.stats();
        }

        clearCache() {
            this.transpositionTable.clear();
        }

        _createNode(state, parent = null, action = null) {
            const hash = stateKey(state);
            const untriedActions = enumerateActions(state);
            return new MCTSNode({
                stateHash: hash,
                state,
                parent,
                action,
                untriedActions,
                isTerminal: this._isGameOver(state),
            });
        }

        _select(node, state) {
            let currentNode = node;
            let currentState = state;

            while (
                currentNode.isFullyExpanded() &&
                currentNode.children.length > 0 &&
                !this._isGameOver(currentState)
            ) {
                currentNode = currentNode.bestChild(this.explorationConstant);
                if (!currentNode || !currentNode.action) break;
                const out = applyAction(currentState, currentNode.action);
                if (!out.state) break;
                currentState = out.state;
            }

            return { node: currentNode, state: currentState };
        }

        _expand(node, state) {
            if (this._isGameOver(state)) return { node, state };
            if (node.untriedActions.length === 0) return { node, state };

            const actionIndex = Math.floor(this.rng() * node.untriedActions.length);
            const action = node.untriedActions.splice(actionIndex, 1)[0];
            const out = applyAction(state, action);
            if (!out.state) return { node, state };

            const child = this._createNode(out.state, node, action);
            node.children.push(child);

            return { node: child, state: out.state };
        }

        _simulate(state) {
            const key = stateKey(state);
            const cached = this.transpositionTable.get(key);
            if (cached !== null) return cached;

            let currentState = cloneState(state);

            for (let depth = 0; depth < this.maxDepth; depth += 1) {
                if (this._isGameOver(currentState)) break;

                const actions = enumerateActions(currentState);
                if (!actions.length) break;

                const action = this.useRandomRollout
                    ? randomChoice(actions, this.rng)
                    : heuristicPolicy(currentState, actions);

                if (!action) break;

                const out = applyAction(currentState, action);
                if (!out.state) break;
                currentState = out.state;

                if (out.terminal) break;
            }

            const reward = winReward(currentState);
            this.transpositionTable.put(key, reward);
            return reward;
        }

        _backpropagate(node, reward) {
            let current = node;
            while (current) {
                current.update(reward);
                current = current.parent;
            }
        }

        _isGameOver(state) {
            return isWinState(state) || isDeadState(state);
        }
    }

    function solveMcts(deck, opts = {}) {
        const {
            includeSpecialCards = true,
            startingHp = 20,
            numSimulations = 1000000,
            explorationConstant = 1.414,
            maxDepth = 120,
            useRandomRollout = true,
            maxCacheSize = 100000,
            rng = Math.random,
            timeLimitMs = null,
        } = opts;

        const initial = makeInitialState(deck, { includeSpecialCards, startingHp });
        if (isDeadState(initial)) return { clearable: false, reason: "dead_start" };
        if (isWinState(initial)) return { clearable: true, bestAction: null, winRate: 1 };

        const agent = new MCTSAgent({
            numSimulations,
            explorationConstant,
            maxDepth,
            useRandomRollout,
            maxCacheSize,
            rng,
            timeLimitMs,
        });

        const root = agent.search(initial);
        const best = root.mostVisitedChild();
        const bestRate = best && best.visits > 0 ? best.value / best.visits : 0;

        return {
            clearable: bestRate > 0 ? true : null,
            bestAction: best ? best.action : null,
            winRate: bestRate,
            iterations: root.visits,
            visits: root.visits,
            cache: agent.getCacheStats(),
        };
    }

    function playMcts(deck, opts = {}) {
        const {
            includeSpecialCards = true,
            startingHp = 20,
            numSimulations = 1000000,
            explorationConstant = 1.414,
            maxDepth = 120,
            useRandomRollout = true,
            maxCacheSize = 100000,
            rng = Math.random,
            timeLimitMs = null,
            maxMoves = 2000,
        } = opts;

        let state = makeInitialState(deck, { includeSpecialCards, startingHp });
        if (isDeadState(state)) return { clearable: false, moves: 0, score: computeScore(state) };
        if (isWinState(state)) return { clearable: true, moves: 0, score: computeScore(state) };

        let moves = 0;

        while (!isWinState(state) && !isDeadState(state) && moves < maxMoves) {
            const agent = new MCTSAgent({
                numSimulations,
                explorationConstant,
                maxDepth,
                useRandomRollout,
                maxCacheSize,
                rng,
                timeLimitMs,
            });

            const root = agent.search(state);
            let action = null;
            const best = root.mostVisitedChild();
            if (best && best.action) {
                action = best.action;
            } else {
                const actions = enumerateActions(state);
                if (!actions.length) break;
                action = randomChoice(actions, rng);
            }

            const out = applyAction(state, action);
            if (!out.state) break;
            state = out.state;
            moves += 1;
        }

        return {
            clearable: isWinState(state),
            moves,
            score: computeScore(state),
        };
    }

    return {
        solveMcts,
        MCTSAgent,
        TranspositionTable,
        normalizeScore,
        playMcts,
    };
}

const mctsSolver = createMctsSolver();

if (typeof window !== "undefined") {
    window.ScoundrelMctsSolver = mctsSolver;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = mctsSolver;
}

if (typeof require !== "undefined" && require.main === module) {
    function parseArgs(argv) {
        const out = {
            num: 1,
            mode: "plus",
            numSimulations: 1000000,
            timeLimitMs: null,
            maxDepth: 120,
            explorationConstant: 1.414,
            useRandomRollout: true,
            maxCacheSize: 100000,
            play: false,
            maxMoves: 2000,
            help: false,
            unknown: [],
        };
        for (let i = 2; i < argv.length; i += 1) {
            const arg = argv[i];
            if (arg === "--help" || arg === "-h") {
                out.help = true;
                continue;
            }
            if (arg === "--num") {
                out.num = Number(argv[i + 1]);
                i += 1;
                continue;
            }
            if (arg.startsWith("--num=")) {
                out.num = Number(arg.slice("--num=".length));
                continue;
            }
            if (arg === "--mode") {
                out.mode = String(argv[i + 1] ?? "");
                i += 1;
                continue;
            }
            if (arg.startsWith("--mode=")) {
                out.mode = String(arg.slice("--mode=".length));
                continue;
            }
            if (arg === "--sims") {
                out.numSimulations = Number(argv[i + 1]);
                i += 1;
                continue;
            }
            if (arg.startsWith("--sims=")) {
                out.numSimulations = Number(arg.slice("--sims=".length));
                continue;
            }
            if (arg === "--time") {
                out.timeLimitMs = Number(argv[i + 1]);
                i += 1;
                continue;
            }
            if (arg.startsWith("--time=")) {
                out.timeLimitMs = Number(arg.slice("--time=".length));
                continue;
            }
            if (arg === "--depth") {
                out.maxDepth = Number(argv[i + 1]);
                i += 1;
                continue;
            }
            if (arg.startsWith("--depth=")) {
                out.maxDepth = Number(arg.slice("--depth=".length));
                continue;
            }
            if (arg === "--explore") {
                out.explorationConstant = Number(argv[i + 1]);
                i += 1;
                continue;
            }
            if (arg.startsWith("--explore=")) {
                out.explorationConstant = Number(arg.slice("--explore=".length));
                continue;
            }
            if (arg === "--random") {
                out.useRandomRollout = true;
                continue;
            }
            if (arg === "--play") {
                out.play = true;
                continue;
            }
            if (arg === "--max-moves") {
                out.maxMoves = Number(argv[i + 1]);
                i += 1;
                continue;
            }
            if (arg.startsWith("--max-moves=")) {
                out.maxMoves = Number(arg.slice("--max-moves=".length));
                continue;
            }
            if (arg === "--cache") {
                out.maxCacheSize = Number(argv[i + 1]);
                i += 1;
                continue;
            }
            if (arg.startsWith("--cache=")) {
                out.maxCacheSize = Number(arg.slice("--cache=".length));
                continue;
            }
            out.unknown.push(arg);
        }
        return out;
    }

    function printUsage() {
        /* eslint-disable no-console */
        console.log("Usage: node solver_mcts.js --num 10 --mode classic");
        console.log("");
        console.log("Options:");
        console.log("  --num N        number of random decks to evaluate (default 1)");
        console.log("  --mode MODE    classic|base|plus|scoundrel+ (default plus)");
        console.log("  --sims N       simulations per deck (default 1000000)");
        console.log("  --time MS      time limit per deck (optional)");
        console.log("  --depth N      rollout depth (default 120)");
        console.log("  --explore X    exploration constant (default 1.414)");
        console.log("  --random       use random rollout policy (default true)");
        console.log("  --play         play the full game with MCTS decisions");
        console.log("  --max-moves N  max moves when --play is set (default 2000)");
        console.log("  --cache N      transposition table max size (default 100000)");
        console.log("  -h, --help     show help");
        /* eslint-enable no-console */
    }

    function shuffleInPlace(array) {
        for (let i = array.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function createDeck(includeSpecialCards) {
        const deck = [];
        const suits = ["hearts", "diamonds", "clubs", "spades"];
        for (const suit of suits) {
            for (let rank = 2; rank <= 14; rank += 1) {
                if (!includeSpecialCards) {
                    if (
                        (suit === "hearts" || suit === "diamonds") &&
                        (rank === 11 || rank === 12 || rank === 13 || rank === 14)
                    ) {
                        continue;
                    }
                }
                deck.push({ suit, rank });
            }
        }
        shuffleInPlace(deck);
        return deck;
    }

    function parseMode(modeRaw) {
        const mode = String(modeRaw || "").toLowerCase().trim();
        if (mode === "classic" || mode === "base") return false;
        if (mode === "plus" || mode === "scoundrel+") return true;
        return true;
    }

    const args = parseArgs(process.argv);
    if (args.help) {
        printUsage();
        process.exit(0);
    }
    if (args.unknown.length > 0) {
        /* eslint-disable no-console */
        console.error(`Unknown args: ${args.unknown.join(", ")}`);
        /* eslint-enable no-console */
        printUsage();
        process.exit(1);
    }

    const includeSpecialCards = parseMode(args.mode);
    const num = Number.isFinite(args.num) && args.num > 0 ? Math.floor(args.num) : 1;

    let clearableCount = 0;
    let totalWinRate = 0;

    for (let i = 0; i < num; i += 1) {
        const deck = createDeck(includeSpecialCards);
        const result = args.play
            ? mctsSolver.playMcts(deck, {
                  includeSpecialCards,
                  numSimulations: args.numSimulations,
                  explorationConstant: args.explorationConstant,
                  maxDepth: args.maxDepth,
                  useRandomRollout: args.useRandomRollout,
                  maxCacheSize: args.maxCacheSize,
                  timeLimitMs: args.timeLimitMs,
                  maxMoves: args.maxMoves,
              })
            : mctsSolver.solveMcts(deck, {
                  includeSpecialCards,
                  numSimulations: args.numSimulations,
                  explorationConstant: args.explorationConstant,
                  maxDepth: args.maxDepth,
                  useRandomRollout: args.useRandomRollout,
                  maxCacheSize: args.maxCacheSize,
                  timeLimitMs: args.timeLimitMs,
              });

        if (result.clearable === true) clearableCount += 1;
        totalWinRate += result.winRate || 0;

        /* eslint-disable no-console */
        console.log(
            args.play
                ? `Deck ${i + 1}: clearable=${String(result.clearable)} ` +
                      `moves=${result.moves} score=${result.score}`
                : `Deck ${i + 1}: winRate=${(result.winRate || 0).toFixed(3)} ` +
                      `clearable=${String(result.clearable)} sims=${result.iterations}`
        );
        if (result.bestAction) {
            console.log(`  bestAction=${JSON.stringify(result.bestAction)}`);
        }
        /* eslint-enable no-console */
    }

    const avgWinRate = num > 0 ? totalWinRate / num : 0;
    /* eslint-disable no-console */
    console.log("");
    console.log(
        args.play
            ? `Summary: clearable=${clearableCount}/${num}`
            : `Summary: clearable=${clearableCount}/${num}, avgWinRate=${avgWinRate.toFixed(3)}`
    );
    /* eslint-enable no-console */
}
