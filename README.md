# Scoundrel

*You are a Scoundrel exploring a dungeon...*

A small roguelike playable with a deck of cards.
In this game, J,Q,K,A's rank are 11, 12, 13, and 14.

## Room

Each room is filled with 4 interactable cards.
You may flee or fight the room.

### Flee
All 4 cards on the table will be restacked at the bottom of the dungeon.
Then, 4 new cards will be drawn.

You may not flee 2 times in a row.

### Fight
When you choose to fight, you should interact with 3 cards.
After that, 3 new cards are drawn and creates a new room, unless there is no card to draw.

## Interactable cards

### 2-10 of Diamonds

These are your weapons.
You may only hold 1 weapon. If you select another, the old one will be discarded.

### 2-10 of Hearts

These are health potions. Your HP will increase by its rank.
Your HP cannot exceed your initial HP (20).

You may only drink 1 potion in a room.
Any potions consumed after will fizzle and have no effect.

### 2-A of Spades & Clubs

These are enemies. You may kill it by using your weapon or your bare fist.

1. Using a weapon
Weapons can reduce damage when killing an enemy.
The damage that you take is max(enemy rank - weapon rank, 0).

However, killing an enemy with a weapon makes it dull.
You can use a weapon to a enemy only when it has lower rank than the last enemy that you've killed with that weapon.

2. Using your bare fist
The damage you take is equal to the enemy rank.
It does not dull your weapon, so use it wisely.

### J-A of Diamonds

(Only in Scoundrel+)
These are repair tools. When used, it will remove the last enemy that you've killed from your weapon.

### J-A of Hearts

(Only in Scoundrel+)
These are poison potions. When used, you will take 10 damage.

Note that you may only drink 1 potion in a room.
Any potions consumed after will fizzle and have no effect.

## Score

When you interact with all of the cards without reaching HP 0, you win.
The score becomes your remaining HP.
If the last card you used was a health potion, its rank is added up to your score.
The maximum score that you can achieve is 30.

If you reach HP 0, you lose.
The score becomes the minus of the sum of the enemies that you didn't kill.
