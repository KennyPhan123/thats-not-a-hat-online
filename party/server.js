// PartyKit Server for That's Not a Hat - Interactive Sandbox Mode
// No automatic logic - players interact freely like in real life

// Inline shuffle function (Fisher-Yates)
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export default class GameServer {
    constructor(room) {
        this.room = room;
        this.gameState = {
            players: [],
            deck: [],
            gameStarted: false,
            hostId: null
        };
    }

    onConnect(connection, ctx) {
        connection.send(JSON.stringify({
            type: 'state',
            state: this.gameState
        }));
    }

    onMessage(message, sender) {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'join':
                    this.handleJoin(data, sender);
                    break;
                case 'leave':
                    this.handleLeave(sender);
                    break;
                case 'start':
                    this.handleStart(sender);
                    break;
                case 'draw':
                    this.handleDraw(data, sender);
                    break;
                case 'flip':
                    this.handleFlip(data, sender);
                    break;
                case 'moveCard':
                    this.handleMoveCard(data, sender);
                    break;
                case 'swapCards':
                    this.handleSwapCards(data, sender);
                    break;
                case 'discard':
                    this.handleDiscard(data, sender);
                    break;
                case 'reset':
                    this.handleReset(sender);
                    break;
            }
        } catch (e) {
            console.error('Message parse error:', e);
        }
    }

    onClose(connection) {
        this.handleLeave(connection);
    }

    handleJoin(data, sender) {
        if (this.gameState.gameStarted) {
            sender.send(JSON.stringify({ type: 'error', message: 'Game already started' }));
            return;
        }

        if (this.gameState.players.length >= 8) {
            sender.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
            return;
        }

        const existingPlayer = this.gameState.players.find(p => p.id === sender.id);
        if (!existingPlayer) {
            const player = {
                id: sender.id,
                name: data.name,
                cards: [null, null], // [slot0, slot1]
                penalties: 0
            };
            this.gameState.players.push(player);
        }

        if (this.gameState.players.length === 1) {
            this.gameState.hostId = sender.id;
        }

        this.broadcast({
            type: 'playerJoined',
            player: this.gameState.players.find(p => p.id === sender.id),
            hostId: this.gameState.hostId,
            players: this.gameState.players
        });
    }

    handleLeave(sender) {
        const index = this.gameState.players.findIndex(p => p.id === sender.id);
        if (index !== -1) {
            this.gameState.players.splice(index, 1);

            if (this.gameState.hostId === sender.id && this.gameState.players.length > 0) {
                this.gameState.hostId = this.gameState.players[0].id;
            }

            this.broadcast({
                type: 'playerLeft',
                playerId: sender.id,
                hostId: this.gameState.hostId,
                players: this.gameState.players
            });
        }
    }

    handleStart(sender) {
        if (sender.id !== this.gameState.hostId) return;
        if (this.gameState.players.length < 2) {
            sender.send(JSON.stringify({ type: 'error', message: 'Need at least 2 players' }));
            return;
        }

        // Initialize and shuffle deck
        const cards = this.generateCards();
        this.gameState.deck = shuffleArray(cards);
        this.gameState.gameStarted = true;

        this.broadcast({
            type: 'gameStarted',
            deck: this.gameState.deck,
            players: this.gameState.players
        });
    }

    generateCards() {
        const cards = [];
        for (let i = 1; i <= 110; i++) {
            const cardNum = String(i).padStart(3, '0');
            cards.push({
                id: `card_${cardNum}`,
                front: `/cards/items/card_${cardNum}.png`,
                back: i <= 55 ? `/cards/backs/back_black.png` : `/cards/backs/back_white.png`,
                isFlipped: false
            });
        }
        return cards;
    }

    // Anyone can draw from deck
    handleDraw(data, sender) {
        if (this.gameState.deck.length === 0) return;

        const player = this.gameState.players.find(p => p.id === sender.id);
        if (!player) return;

        // Check if player has space (at least one empty slot)
        const hasEmptySlot = player.cards[0] === null || player.cards[1] === null;
        if (!hasEmptySlot) {
            sender.send(JSON.stringify({ type: 'error', message: 'No empty slot!' }));
            return;
        }

        const card = this.gameState.deck.pop();
        card.isFlipped = false; // Face up when drawn

        // First card goes to slot 0 (bottom), second card to slot 1 (top)
        let slotIndex;
        if (player.cards[0] === null) {
            // Slot 0 empty - put card there (bottom)
            slotIndex = 0;
        } else if (player.cards[1] === null) {
            // Slot 0 has card, slot 1 empty - put card in slot 1 (top)
            slotIndex = 1;
        } else {
            // Both slots full - shouldn't happen due to check above
            return;
        }

        player.cards[slotIndex] = card;

        this.broadcast({
            type: 'cardDrawn',
            playerId: sender.id,
            slotIndex: slotIndex,
            card: card,
            deckCount: this.gameState.deck.length,
            topCard: this.gameState.deck.length > 0 ? this.gameState.deck[this.gameState.deck.length - 1] : null,
            players: this.gameState.players // Send full player state for sync
        });
    }

    // Only card owner can flip their own cards
    handleFlip(data, sender) {
        const player = this.gameState.players.find(p => p.id === sender.id);
        if (!player || !player.cards[data.slotIndex]) return;

        player.cards[data.slotIndex].isFlipped = !player.cards[data.slotIndex].isFlipped;

        this.broadcast({
            type: 'cardFlipped',
            playerId: sender.id,
            slotIndex: data.slotIndex,
            isFlipped: player.cards[data.slotIndex].isFlipped
        });
    }

    // Move card between players or slots - FREE INTERACTION
    handleMoveCard(data, sender) {
        const fromPlayer = this.gameState.players.find(p => p.id === data.fromPlayerId);
        const toPlayer = this.gameState.players.find(p => p.id === data.toPlayerId);

        if (!fromPlayer || !toPlayer) return;
        if (!fromPlayer.cards[data.fromSlot]) return;
        if (toPlayer.cards[data.toSlot] !== null) return;

        // Move the card
        const card = fromPlayer.cards[data.fromSlot];
        fromPlayer.cards[data.fromSlot] = null;
        toPlayer.cards[data.toSlot] = card;

        this.broadcast({
            type: 'cardMoved',
            fromPlayerId: data.fromPlayerId,
            fromSlot: data.fromSlot,
            toPlayerId: data.toPlayerId,
            toSlot: data.toSlot,
            card: card,
            players: this.gameState.players
        });
    }

    // Swap two cards within same player
    handleSwapCards(data, sender) {
        const player = this.gameState.players.find(p => p.id === data.playerId);
        if (!player) return;

        [player.cards[0], player.cards[1]] = [player.cards[1], player.cards[0]];

        this.broadcast({
            type: 'cardsSwapped',
            playerId: data.playerId,
            cards: player.cards
        });
    }

    // Discard to penalty zone
    handleDiscard(data, sender) {
        const player = this.gameState.players.find(p => p.id === data.playerId);
        if (!player || !player.cards[data.slotIndex]) return;

        player.cards[data.slotIndex] = null;
        player.penalties++;

        const gameOver = player.penalties >= 3;

        this.broadcast({
            type: 'cardDiscarded',
            playerId: data.playerId,
            slotIndex: data.slotIndex,
            penalties: player.penalties,
            gameOver,
            loserName: gameOver ? player.name : null
        });
    }

    handleReset(sender) {
        this.gameState.players.forEach(p => {
            p.cards = [null, null];
            p.penalties = 0;
        });

        const cards = this.generateCards();
        this.gameState.deck = shuffleArray(cards);

        this.broadcast({
            type: 'gameReset',
            deck: this.gameState.deck,
            players: this.gameState.players
        });
    }

    broadcast(message) {
        this.room.broadcast(JSON.stringify(message));
    }
}
