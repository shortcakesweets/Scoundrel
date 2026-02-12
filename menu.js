const DUNGEON_TIPS = [
    "Use fists to avoid dulling your weapon.",
    "Fleeing is not cowardice; it's strategic repositioning.",
    "Weapon kills must strictly go down in rank afterward.",
    "A second potion in the same room fizzles, even if it's a poison potion.",
    "A new room is drawn after 3 interactions.",
    "Toolkits can undo a bad weapon-kill order. Use them wisely.",
    "If you can take 0 damage with a weapon kill, it's often worth it (but it still dulls the weapon).",
    "When low HP, consider whether a potion is actually usable this room.",
    "Sometimes skipping weapon kills early keeps future options open.",
];

let tipIntervalId = null;
let currentTip = "";

const pickTip = () => DUNGEON_TIPS[Math.floor(Math.random() * DUNGEON_TIPS.length)];

export const initMenu = (root = document) => {
    const tipText = root.querySelector("#tip-text");
    if (!tipText) {
        return;
    }

    const setRandomTip = () => {
        let nextTip = pickTip();
        if (DUNGEON_TIPS.length > 1) {
            while (nextTip === currentTip) {
                nextTip = pickTip();
            }
        }

        currentTip = nextTip;
        tipText.textContent = nextTip;
    };

    setRandomTip();
    if (tipIntervalId) {
        clearInterval(tipIntervalId);
    }
    tipIntervalId = setInterval(setRandomTip, 5000);
};

export const stopMenuTips = () => {
    if (!tipIntervalId) {
        return;
    }

    clearInterval(tipIntervalId);
    tipIntervalId = null;
};
