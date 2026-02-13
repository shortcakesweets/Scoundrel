import * as Card from './card.js'
import { shuffle } from './random.js'

export class Scoundrel {
    constructor(seed, ascension){
        this.seed = seed;
        this.ascension = ascension;
        this.hp = 20;
        this.deck = [];
        this.room = [0, 0, 0, 0];
        this.roomNum = 0;
        this.weapon = 0;
        this.weaponStack = [];
        this.isPotionEffective = true;
        this.isFleeAvailable = true;
        this.lastCard = 0;

        this.initialize();
    }

    initialize(){
        for(const suit of [Card.SPADES, Card.HEARTS, Card.DIAMONDS, Card.CLUBS]){
            for(let rank = 2; rank <= 14; rank++){
                if((suit === Card.HEARTS || suit === Card.DIAMONDS) && (11 <= rank && rank <= 14) && this.ascension === 0){
                    continue;
                }
                this.deck.push(Card.card(suit, rank));
            }
        }

        this.deck = shuffle(this.deck, this.seed);
        this.drawRoom();
    }

    drawRoom(){
        for(let i = 0; i < 4; i++){
            if(this.room[i] === 0){
                this.room[i] = this.deck.shift();
            }
        }

        this.roomNum++;
        this.isPotionEffective = true;
        this.isFleeAvailable = true;
    }

    flee(){
        for(let i=3; i>=0; i--){
            if(this.room[i] != 0){
                this.deck.push(this.room[i]);
                this.room[i] = 0;
            }
        }

        this.drawRoom();
        this.isFleeAvailable = false;
    }

    getPossibleActions(){
        let actionList = [];

        if (this.isFleeAvailable && this.#countRoomOccupy() == 4){
            actionList.push(-1);
        }

        for(let i=0; i<4; i++){
            const card = this.room[i];
            if(card === 0) continue;

            actionList.push(2 * i);

            if (this.#isEnemyWeaponKillable(card)){
                actionList.push(2 * i + 1);
            }
        }

        return actionList;
    }

    takeAction(action){
        if (!this.getPossibleActions().includes(action)) {
            return false;
        }

        if (action === -1){ // flee
            this.flee();
            return true;
        }

        const slot = Math.floor(action / 2);
        const card = this.room[slot];
        this.lastCard = card;
        
        if (Card.isEnemy(card)){
            if (action % 2 == 1){ // weapon
                const damage = Math.max(Card.rank(card) - Card.rank(this.weapon), 0);
                const isEnemyKilled = (this.hp >= damage);
                
                this.hp = Math.max(this.hp - damage, 0);

                if (isEnemyKilled){
                    this.room[slot] = 0;
                    this.weaponStack.push(card);
                }
            }
            else{ // bare fist
                const damage = Card.rank(card);
                const isEnemyKilled = (this.hp >= damage);

                this.hp = Math.max(this.hp - damage, 0);
                
                if (isEnemyKilled){
                    this.room[slot] = 0;
                }
            }
        }
        
        if (Card.isWeapon(card)){
            this.room[slot] = 0;
            this.weapon = card;
            this.weaponStack = [];
        }

        if (Card.isRepairKit(card)){
            this.room[slot] = 0;
            if(this.weaponStack.length > 0){
                this.weaponStack.pop();
            }
        }

        if (Card.isHealthPotion(card)){
            this.room[slot] = 0;
            if (this.isPotionEffective){
                this.hp = Math.min(this.hp + Card.rank(card), 20);
                this.isPotionEffective = false;
            }
        }

        if (Card.isPoisonPotion(card)){
            this.room[slot] = 0;
            if (this.isPotionEffective){
                this.hp = Math.max(this.hp - 10, 0);
                this.isPotionEffective = false;
            }
        }

        if (this.hp > 0 && this.#countRoomOccupy() === 1 && this.deck.length > 1){
            this.drawRoom();
        }

        return true;
    }

    isTerminal(){
        return this.isLost() || this.isWin();
    }

    score(){
        if (this.isLost()){
            const remainingEnemies = [
                ...this.deck.filter(card => Card.isEnemy(card)),
                ...this.room.filter(card => Card.isEnemy(card))
            ];
            return remainingEnemies.reduce((sum, card) => sum + Card.rank(card), 0) * -1;
        }

        else if(this.isWin()){
            if (Card.isHealthPotion(this.lastCard)){
                return this.hp + Card.rank(this.lastCard);
            }
            return this.hp;
        }

        return 0;
    }

    isLost(){
        return this.hp === 0;
    }

    isWin(){
        return !this.isLost() && (this.deck.length + this.#countRoomOccupy() === 0);
    }

    #countRoomOccupy(){
        let sum = 0;
        for(let i=0; i<4; i++){
            if(this.room[i] != 0) sum++;
        }
        return sum;
    }

    #isEnemyWeaponKillable(enemy){
        if (!Card.isEnemy(enemy)) return false;
        if (this.weapon === 0) return false;

        const len = this.weaponStack.length;
        if (len === 0) return true;
        return Card.rank(enemy) < Card.rank(this.weaponStack[len - 1]);
    }
}

