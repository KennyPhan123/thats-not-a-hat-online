// Card paths configuration
const CARDS_PATH = '/cards/items/';
const BACKS_PATH = '/cards/backs/';

// Generate card list (110 cards)
export function generateCardList() {
    const cards = [];
    for (let i = 1; i <= 110; i++) {
        const cardNum = String(i).padStart(3, '0');
        cards.push({
            id: `card_${cardNum}`,
            front: `${CARDS_PATH}card_${cardNum}.png`,
            // First 55 cards get black back, rest get white back (will be shuffled)
            back: i <= 55 ? `${BACKS_PATH}back_black.png` : `${BACKS_PATH}back_white.png`
        });
    }
    return cards;
}

// Fisher-Yates shuffle
export function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Generate room code
export function generateRoomCode(length = 4) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// Calculate player positions around the table
export function calculatePlayerPositions(playerCount, currentPlayerIndex, viewportWidth, viewportHeight) {
    const positions = [];
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;

    // Elliptical layout
    const radiusX = Math.min(viewportWidth * 0.38, 350);
    const radiusY = Math.min(viewportHeight * 0.35, 280);

    // Start from bottom (current player) and go clockwise
    const startAngle = Math.PI / 2; // Bottom

    for (let i = 0; i < playerCount; i++) {
        // Reorder so current player is always at bottom
        const adjustedIndex = (i + currentPlayerIndex) % playerCount;
        const angle = startAngle + (i * 2 * Math.PI / playerCount);

        positions[adjustedIndex] = {
            x: centerX + radiusX * Math.cos(angle),
            y: centerY + radiusY * Math.sin(angle),
            isCurrentPlayer: adjustedIndex === currentPlayerIndex
        };
    }

    return positions;
}

// Game state class
export class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this.roomCode = '';
        this.players = [];
        this.currentPlayerId = null;
        this.deck = [];
        this.isHost = false;
        this.gameStarted = false;
    }

    initDeck() {
        const cards = generateCardList();
        this.deck = shuffleArray(cards);
    }

    addPlayer(player) {
        if (this.players.length < 8) {
            this.players.push({
                id: player.id,
                name: player.name,
                cards: [null, null], // top and bottom slots
                penalties: 0
            });
            return true;
        }
        return false;
    }

    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
    }

    getPlayer(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    getCurrentPlayer() {
        return this.getPlayer(this.currentPlayerId);
    }

    drawCard(playerId) {
        if (this.deck.length === 0) return null;

        const player = this.getPlayer(playerId);
        if (!player) return null;

        // Find empty slot
        const emptySlot = player.cards.findIndex(c => c === null);
        if (emptySlot === -1) return null; // No empty slot

        const card = this.deck.pop();
        card.isFlipped = false; // Start face up
        player.cards[emptySlot] = card;

        return { card, slotIndex: emptySlot };
    }

    flipCard(playerId, slotIndex) {
        const player = this.getPlayer(playerId);
        if (!player || !player.cards[slotIndex]) return false;

        player.cards[slotIndex].isFlipped = !player.cards[slotIndex].isFlipped;
        return true;
    }

    swapCards(playerId) {
        const player = this.getPlayer(playerId);
        if (!player) return false;

        [player.cards[0], player.cards[1]] = [player.cards[1], player.cards[0]];
        return true;
    }

    transferCard(fromPlayerId, fromSlot, toPlayerId, toSlot) {
        const fromPlayer = this.getPlayer(fromPlayerId);
        const toPlayer = this.getPlayer(toPlayerId);

        if (!fromPlayer || !toPlayer) return false;
        if (!fromPlayer.cards[fromSlot]) return false;
        if (toPlayer.cards[toSlot] !== null) return false;

        toPlayer.cards[toSlot] = fromPlayer.cards[fromSlot];
        fromPlayer.cards[fromSlot] = null;
        return true;
    }

    discardCard(playerId, slotIndex) {
        const player = this.getPlayer(playerId);
        if (!player || !player.cards[slotIndex]) return false;

        player.cards[slotIndex] = null;
        player.penalties++;

        return { penalties: player.penalties, gameOver: player.penalties >= 3 };
    }

    checkGameOver() {
        const loser = this.players.find(p => p.penalties >= 3);
        return loser ? loser : null;
    }

    toJSON() {
        return {
            roomCode: this.roomCode,
            players: this.players,
            deck: this.deck,
            gameStarted: this.gameStarted
        };
    }

    fromJSON(data) {
        this.roomCode = data.roomCode;
        this.players = data.players;
        this.deck = data.deck;
        this.gameStarted = data.gameStarted;
    }
}
