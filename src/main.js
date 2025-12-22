// Main entry point for That's Not a Hat - Interactive Sandbox Mode
import { GameState, generateRoomCode } from './game.js';
import { renderPlayers } from './player.js';
import { createCard, setupFlipHandler } from './card.js';
import { DragHandler } from './drag.js';
import PartySocket from 'partysocket';

// Use deployed PartyKit server
const PARTYKIT_HOST = 'thats-not-a-hat-server.kennyphan123.partykit.dev';

// App State
const state = {
    socket: null,
    playerId: null,
    playerName: '',
    roomCode: '',
    isHost: false,
    gameState: new GameState(),
    dragHandler: null,
    discardHistory: [] // Track discarded cards
};

// DOM Elements
const elements = {
    lobby: document.getElementById('lobby'),
    game: document.getElementById('game'),
    mainMenu: document.getElementById('mainMenu'),
    showCreate: document.getElementById('showCreate'),
    showJoin: document.getElementById('showJoin'),
    createForm: document.getElementById('createForm'),
    joinForm: document.getElementById('joinForm'),
    createName: document.getElementById('createName'),
    joinName: document.getElementById('joinName'),
    roomCode: document.getElementById('roomCode'),
    createRoom: document.getElementById('createRoom'),
    joinRoom: document.getElementById('joinRoom'),
    roomInfo: document.getElementById('roomInfo'),
    displayRoomCode: document.getElementById('displayRoomCode'),
    playerCount: document.getElementById('playerCount'),
    playerList: document.getElementById('playerList'),
    startGame: document.getElementById('startGame'),
    waitingText: document.querySelector('.waiting-text'),
    gameTable: document.getElementById('gameTable'),
    deck: document.getElementById('deck'),
    playersContainer: document.getElementById('playersContainer'),
    penaltyZone: document.getElementById('penaltyZone'),
    gameOverModal: document.getElementById('gameOverModal'),
    gameOverMessage: document.getElementById('gameOverMessage'),
    playAgain: document.getElementById('playAgain')
};

function init() {
    setupLobbyHandlers();
    setupGameHandlers();

    window.addEventListener('resize', () => {
        if (state.gameState.gameStarted) {
            renderGame();
        }
    });
}

// === LOBBY ===
function setupLobbyHandlers() {
    // Show Create form
    elements.showCreate.addEventListener('click', () => {
        elements.mainMenu.classList.add('hidden');
        elements.createForm.classList.remove('hidden');
    });

    // Show Join form
    elements.showJoin.addEventListener('click', () => {
        elements.mainMenu.classList.add('hidden');
        elements.joinForm.classList.remove('hidden');
    });

    // Create Room
    elements.createRoom.addEventListener('click', () => {
        const name = elements.createName.value.trim();
        if (!name) {
            alert('Please enter your name');
            return;
        }
        state.playerName = name;
        state.roomCode = generateRoomCode(4); // 4 characters
        state.isHost = true;
        connectToRoom();
    });

    // Join Room
    elements.joinRoom.addEventListener('click', () => {
        const name = elements.joinName.value.trim();
        const code = elements.roomCode.value.trim().toUpperCase();
        if (!name) {
            alert('Please enter your name');
            return;
        }
        if (!code || code.length !== 4) {
            alert('Please enter 4-letter room code');
            return;
        }
        state.playerName = name;
        state.roomCode = code;
        state.isHost = false;
        connectToRoom();
    });

    elements.startGame.addEventListener('click', () => {
        if (state.socket && state.isHost) {
            state.socket.send(JSON.stringify({ type: 'start' }));
        }
    });

    // Back buttons
    document.getElementById('backFromCreate')?.addEventListener('click', () => {
        elements.createForm.classList.add('hidden');
        elements.mainMenu.classList.remove('hidden');
    });

    document.getElementById('backFromJoin')?.addEventListener('click', () => {
        elements.joinForm.classList.add('hidden');
        elements.mainMenu.classList.remove('hidden');
    });

    // Copy button
    document.getElementById('copyCodeBtn')?.addEventListener('click', copyRoomCode);
}

// Copy room code to clipboard
function copyRoomCode() {
    const code = elements.displayRoomCode.textContent;
    const copyBtn = document.getElementById('copyCodeBtn');

    navigator.clipboard.writeText(code).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = 'Tap to Copy';
        }, 2000);
    }).catch(() => {
        // Fallback: select and copy
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = 'Tap to Copy';
        }, 2000);
    });
}

function connectToRoom() {
    state.socket = new PartySocket({
        host: PARTYKIT_HOST,
        room: state.roomCode
    });

    state.socket.addEventListener('open', () => {
        state.playerId = state.socket.id;
        state.socket.send(JSON.stringify({
            type: 'join',
            name: state.playerName
        }));
        showRoomInfo();
    });

    state.socket.addEventListener('message', (event) => {
        handleServerMessage(JSON.parse(event.data));
    });

    state.socket.addEventListener('error', (error) => {
        console.error('Connection error:', error);
        alert('Cannot connect to server. Make sure PartyKit is running.');
    });

    state.socket.addEventListener('close', () => {
        alert('Disconnected from server');
        location.reload();
    });
}

function showRoomInfo() {
    elements.displayRoomCode.textContent = state.roomCode;
    elements.roomInfo.classList.remove('hidden');
    // Hide all form elements
    elements.mainMenu.classList.add('hidden');
    elements.createForm.classList.add('hidden');
    elements.joinForm.classList.add('hidden');
}

function updatePlayerList() {
    const players = state.gameState.players;
    elements.playerCount.textContent = players.length;
    elements.playerList.innerHTML = players
        .map(p => `<span class="player-tag${p.id === state.gameState.hostId ? ' host' : ''}">${p.name}${p.id === state.gameState.hostId ? ' (Host)' : ''}</span>`)
        .join('');

    // Show start button for host if enough players (minimum 2)
    if (state.isHost && players.length >= 2) {
        elements.startGame.classList.remove('hidden');
        elements.waitingText.classList.add('hidden');
    } else if (!state.isHost) {
        elements.waitingText.classList.remove('hidden');
    }
}

// === SERVER MESSAGES ===
function handleServerMessage(data) {
    console.log('Server:', data.type, data);

    switch (data.type) {
        case 'state':
            state.gameState.players = data.state.players || [];
            state.gameState.deck = data.state.deck || [];
            state.gameState.hostId = data.state.hostId;
            state.gameState.gameStarted = data.state.gameStarted;
            if (data.state.gameStarted) {
                startGame();
            }
            break;

        case 'playerJoined':
            state.gameState.players = data.players;
            state.gameState.hostId = data.hostId;
            if (data.hostId === state.playerId) {
                state.isHost = true;
            }
            updatePlayerList();
            break;

        case 'playerLeft':
            state.gameState.players = data.players;
            if (data.hostId === state.playerId) {
                state.isHost = true;
            }
            updatePlayerList();
            if (state.gameState.gameStarted) {
                renderGame();
            }
            break;

        case 'gameStarted':
            state.gameState.deck = data.deck;
            state.gameState.players = data.players;
            state.gameState.gameStarted = true;
            startGame();
            break;

        case 'cardDrawn':
            handleCardDrawn(data);
            break;

        case 'cardFlipped':
            handleCardFlipped(data);
            break;

        case 'cardMoved':
            state.gameState.players = data.players;
            renderGame();
            break;

        case 'cardsSwapped':
            handleCardsSwapped(data);
            break;

        case 'cardDiscarded':
            handleCardDiscarded(data);
            break;

        case 'gameReset':
            state.gameState.deck = data.deck;
            state.gameState.players = data.players;
            state.discardHistory = data.discardHistory || [];
            elements.gameOverModal.classList.add('hidden');
            renderGame();
            break;

        case 'error':
            alert(data.message);
            break;
    }
}

// === GAME ===
function startGame() {
    elements.lobby.classList.remove('active');
    elements.game.classList.add('active');
    state.gameState.currentPlayerId = state.playerId;

    setupDragHandler();
    renderGame();
}

function setupDragHandler() {
    state.dragHandler = new DragHandler({
        container: elements.gameTable,
        onDrop: handleDrop
    });
}

function renderGame() {
    renderDeck();
    renderPlayers(state.gameState, elements.playersContainer, {
        onFlip: handleFlipCard
    });
}

function renderDeck() {
    const deckEl = elements.deck;
    const deckCardsEl = deckEl.querySelector('.deck-cards');
    const deckCount = deckEl.querySelector('.deck-count');

    deckCardsEl.innerHTML = '';

    const deck = state.gameState.deck;
    if (deck.length > 0) {
        const visibleCount = Math.min(deck.length, 5);
        // Render from bottom to top (lower cards first, top card last for correct DOM stacking)
        for (let i = visibleCount - 1; i >= 0; i--) {
            const card = document.createElement('div');
            card.className = 'deck-card';
            // Top card is at deck[deck.length - 1], show it on top visually
            const cardIndex = deck.length - 1 - i;
            if (deck[cardIndex]) {
                card.style.backgroundImage = `url(${deck[cardIndex].front})`;
            }
            card.style.top = `${-i * 2}px`;
            card.style.left = `${i * 1}px`;
            card.style.zIndex = visibleCount - i; // Top card (i=0) has highest z-index
            deckCardsEl.appendChild(card);
        }
    }

    deckCount.textContent = deck.length;

    // Click to draw
    deckEl.onclick = () => {
        if (state.socket && deck.length > 0) {
            state.socket.send(JSON.stringify({ type: 'draw' }));
        }
    };

    deckEl.style.display = deck.length > 0 ? '' : 'none';
}

function setupGameHandlers() {
    elements.playAgain?.addEventListener('click', () => {
        if (state.socket) {
            state.socket.send(JSON.stringify({ type: 'reset' }));
        }
    });

    // Setup discard history modal
    setupDiscardHistoryModal();
}

// Setup discard history modal
function setupDiscardHistoryModal() {
    // Add click handler to penalty zone
    elements.penaltyZone.addEventListener('click', (e) => {
        // Only show modal if not dragging
        if (!e.target.closest('.card')) {
            toggleDiscardHistory();
        }
    });
}

// Toggle discard history modal
function toggleDiscardHistory() {
    let modal = document.getElementById('discardHistoryModal');

    if (modal) {
        // Toggle existing modal
        modal.classList.toggle('hidden');
        if (!modal.classList.contains('hidden')) {
            renderDiscardHistory();
        }
        return;
    }

    // Create modal
    modal = document.createElement('div');
    modal.id = 'discardHistoryModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content discard-history-modal">
            <h2>Discard History</h2>
            <div id="discardHistoryList" class="discard-history-list"></div>
            <button id="closeDiscardHistory" class="btn btn-secondary">Close</button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('closeDiscardHistory').addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    renderDiscardHistory();
}

// Render discard history list
function renderDiscardHistory() {
    const list = document.getElementById('discardHistoryList');
    if (!list) return;

    if (state.discardHistory.length === 0) {
        list.innerHTML = '<p class="no-discards">No cards discarded yet</p>';
        return;
    }

    list.innerHTML = state.discardHistory.map((item, index) => `
        <div class="discard-item">
            <div class="discard-card" style="background-image: url(${item.card.front})"></div>
            <span class="discard-player">${item.playerName}</span>
        </div>
    `).join('');
}

// === ACTIONS ===
function handleFlipCard(playerId, slotIndex) {
    // Only flip your own cards
    if (playerId !== state.playerId) return;

    if (state.socket) {
        state.socket.send(JSON.stringify({ type: 'flip', slotIndex }));
    }
}

function handleDrop(dragData, dropTarget) {
    if (!dragData || !dropTarget) return;

    if (dropTarget.type === 'penalty') {
        // Discard to penalty zone - only your own cards
        if (dragData.fromPlayerId === state.playerId) {
            if (state.socket) {
                state.socket.send(JSON.stringify({
                    type: 'discard',
                    playerId: dragData.fromPlayerId,
                    slotIndex: dragData.fromSlot
                }));
            }
        }
    } else if (dropTarget.type === 'player') {
        if (dropTarget.playerId === dragData.fromPlayerId) {
            // Swap within same player
            if (dragData.fromSlot !== dropTarget.slotIndex) {
                if (state.socket) {
                    state.socket.send(JSON.stringify({
                        type: 'swapCards',
                        playerId: dragData.fromPlayerId
                    }));
                }
            }
        } else {
            // Move card to another player (FREE - can move from anyone to yourself)
            // Can only move TO yourself, not to others
            if (dropTarget.playerId === state.playerId && dropTarget.isEmpty) {
                if (state.socket) {
                    state.socket.send(JSON.stringify({
                        type: 'moveCard',
                        fromPlayerId: dragData.fromPlayerId,
                        fromSlot: dragData.fromSlot,
                        toPlayerId: dropTarget.playerId,
                        toSlot: dropTarget.slotIndex
                    }));
                }
            } else if (dragData.fromPlayerId === state.playerId && dropTarget.isEmpty) {
                // Or move your own cards to others
                if (state.socket) {
                    state.socket.send(JSON.stringify({
                        type: 'moveCard',
                        fromPlayerId: dragData.fromPlayerId,
                        fromSlot: dragData.fromSlot,
                        toPlayerId: dropTarget.playerId,
                        toSlot: dropTarget.slotIndex
                    }));
                }
            }
        }
    }
}

// === EVENT HANDLERS ===
function handleCardDrawn(data) {
    // Pop the top card from client deck (same as server did)
    state.gameState.deck.pop();

    // Sync player state from server (includes shift logic)
    if (data.players) {
        state.gameState.players = data.players;
    }
    renderGame();
}

function handleCardFlipped(data) {
    const player = state.gameState.players.find(p => p.id === data.playerId);
    if (player && player.cards[data.slotIndex]) {
        player.cards[data.slotIndex].isFlipped = data.isFlipped;
    }
    renderGame();
}

function handleCardsSwapped(data) {
    const player = state.gameState.players.find(p => p.id === data.playerId);
    if (player) {
        player.cards = data.cards;
    }
    renderGame();
}

function handleCardDiscarded(data) {
    // Sync full player state from server (includes normalized cards)
    if (data.players) {
        state.gameState.players = data.players;
    }

    // Update discard history
    if (data.discardHistory) {
        state.discardHistory = data.discardHistory;
    }

    renderGame();

    if (data.gameOver) {
        showGameOver(data.loserName);
    }
}

function showGameOver(loserName) {
    elements.gameOverMessage.textContent = `${loserName} got 3 penalties and lost!`;
    elements.gameOverModal.classList.remove('hidden');
}

// Start
init();
