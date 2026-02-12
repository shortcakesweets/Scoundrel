export const SPADES = 1;
export const HEARTS = 2;
export const DIAMONDS = 3;
export const CLUBS = 4;

export function card(suit, rank) {
    return suit * 15 + rank;
}

export function suit(card) {
    return Math.floor(card / 15);
}

export function rank(card) {
    return card % 15;
}

export function isEnemy(card) {
    return suit(card) == SPADES || suit(card) == CLUBS;
}

export function isPotion(card) {
    return suit(card) == HEARTS;
}

export function isHealthPotion(card) {
    return isPotion(card) && 2 <= rank(card) && rank(card) <= 10;
}

export function isPoisonPotion(card) {
    return isPotion(card) && 11 <= rank(card) && rank(card) <= 14;
}

export function isWeapon(card) {
    return suit(card) == DIAMONDS && 2 <= rank(card) && rank(card) <= 10;
}

export function isRepairKit(card) {
    return suit(card) == DIAMONDS && 11 <= rank(card) && rank(card) <= 14;
}

export function cardStr(card) {
    const suit_str = ["S", "H", "D", "C"][suit(card) - 1] ?? "?";
    const rank_str = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"][rank(card) - 2] ?? "?";
    return `${rank_str}${suit_str}`;
}
