// Main entry point for That's Not a Hat - Interactive Sandbox Mode
import { GameState, generateRoomCode } from './game.js';
import { renderPlayers } from './player.js';
import { createCard, setupFlipHandler } from './card.js';
import { DragHandler } from './drag.js';
import { initAudio, playSound } from './audio.js';
import { VoiceChat } from './webrtc.js';
import PartySocket from 'partysocket';

// Use deployed PartyKit server
const PARTYKIT_HOST = 'tnah.kennyphan123.partykit.dev';

// WebRTC instance
const voiceChat = new VoiceChat();

// App State
const state = {
    socket: null,
    playerId: null,
    playerName: '',
    roomCode: '',
    isHost: false,
    gameState: new GameState(),
    dragHandler: null,
    discardHistory: [], // Track discarded cards
    hardMode: false,
    slotCount: 2,
    timerDuration: 0,
    timers: {}
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
    playAgain: document.getElementById('playAgain'),
    hardModeToggle: document.getElementById('hardModeToggle'),
    hardModeCheckbox: document.getElementById('hardModeCheckbox'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeIcon: document.querySelector('.theme-icon'),
    timerSetting: document.getElementById('timerSetting'),
    timerDurationSelect: document.getElementById('timerDurationSelect'),
    micToggleBtn: document.getElementById('micToggleBtn'),
    micOffIcon: document.getElementById('micOffIcon'),
    micOnIcon: document.getElementById('micOnIcon')
};

function setupTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    elements.themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });
}

function setTheme(theme) {
    const sunSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>`;
    const moonSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>`;

    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        elements.themeIcon.innerHTML = sunSvg;
    } else {
        document.documentElement.removeAttribute('data-theme');
        elements.themeIcon.innerHTML = moonSvg;
    }
    localStorage.setItem('theme', theme);
}

function init() {
    setupTheme();
    setupLobbyHandlers();
    setupGameHandlers();
    setupMicToggle();

    window.addEventListener('resize', () => {
        if (state.gameState.gameStarted) {
            renderGame();
        }
    });
}

function setupMicToggle() {
    elements.micToggleBtn.addEventListener('click', async () => {
        const isEnabled = await voiceChat.toggleMic();
        if (isEnabled) {
            elements.micToggleBtn.classList.add('active');
            elements.micOffIcon.classList.add('hidden');
            elements.micOnIcon.classList.remove('hidden');
        } else {
            elements.micToggleBtn.classList.remove('active');
            elements.micOffIcon.classList.remove('hidden');
            elements.micOnIcon.classList.add('hidden');
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
            alert('Vui lòng nhập tên');
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
            alert('Vui lòng nhập tên');
            return;
        }
        if (!code || code.length !== 4) {
            alert('Vui lòng nhập mã phòng 4 ký tự');
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

    // Hard mode toggle (host only)
    elements.hardModeCheckbox?.addEventListener('change', (e) => {
        if (state.socket && state.isHost) {
            state.socket.send(JSON.stringify({
                type: 'toggleHardMode',
                enabled: e.target.checked
            }));
        }
    });

    // Timer setting (host only)
    elements.timerDurationSelect?.addEventListener('change', (e) => {
        if (state.socket && state.isHost) {
            state.socket.send(JSON.stringify({
                type: 'changeTimer',
                duration: e.target.value
            }));
        }
    });
}

// Copy room code to clipboard
function copyRoomCode() {
    const code = elements.displayRoomCode.textContent;
    const copyBtn = document.getElementById('copyCodeBtn');

    navigator.clipboard.writeText(code).then(() => {
        copyBtn.textContent = 'Đã sao chép!';
        setTimeout(() => {
            copyBtn.textContent = 'Nhấn để sao chép';
        }, 2000);
    }).catch(() => {
        // Fallback: select and copy
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        copyBtn.textContent = 'Đã sao chép!';
        setTimeout(() => {
            copyBtn.textContent = 'Nhấn để sao chép';
        }, 2000);
    });
}

function connectToRoom() {
    initAudio();
    state.socket = new PartySocket({
        host: PARTYKIT_HOST,
        room: state.roomCode
    });

    state.socket.addEventListener('open', () => {
        state.playerId = state.socket.id;
        
        // Initialize WebRTC Voice Chat
        voiceChat.init(state.socket, state.playerId);
        elements.micToggleBtn.classList.remove('hidden');

        state.socket.send(JSON.stringify({
            type: 'join',
            name: state.playerName
        }));
        showRoomInfo();

        // Start heartbeat ping every 30 seconds to keep connection alive
        if (state.pingInterval) clearInterval(state.pingInterval);
        state.pingInterval = setInterval(() => {
            if (state.socket && state.socket.readyState === WebSocket.OPEN) {
                state.socket.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    });

    state.socket.addEventListener('message', (event) => {
        handleServerMessage(JSON.parse(event.data));
    });

    state.socket.addEventListener('error', (error) => {
        console.error('Connection error:', error);
    });

    state.socket.addEventListener('close', () => {
        // Clear ping interval
        if (state.pingInterval) {
            clearInterval(state.pingInterval);
            state.pingInterval = null;
        }
        // PartySocket will auto-reconnect, only show alert if game has started
        if (state.gameState.gameStarted) {
            console.log('Connection lost, attempting to reconnect...');
        }
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
        .map(p => `<span class="player-tag${p.id === state.gameState.hostId ? ' host' : ''}">${p.name}${p.id === state.gameState.hostId ? ' (Chủ phòng)' : ''}</span>`)
        .join('');

    // Show start button and hard mode toggle for host if enough players (minimum 2)
    if (state.isHost && players.length >= 2) {
        elements.startGame.classList.remove('hidden');
        elements.hardModeToggle.classList.remove('hidden');
        elements.timerSetting.classList.remove('hidden');
        elements.waitingText.classList.add('hidden');
    } else if (state.isHost) {
        elements.startGame.classList.add('hidden');
        elements.hardModeToggle.classList.remove('hidden');
        elements.timerSetting.classList.remove('hidden');
        elements.waitingText.classList.add('hidden');
    } else if (!state.isHost) {
        elements.waitingText.classList.remove('hidden');
        elements.hardModeToggle.classList.add('hidden');
        elements.timerSetting.classList.remove('hidden');
        if (elements.timerDurationSelect) elements.timerDurationSelect.disabled = true;
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
            state.hardMode = data.state.hardMode || false;
            state.slotCount = data.state.slotCount || 2;
            state.timerDuration = data.state.timerDuration || 0;
            
            // Sync UI
            if (elements.hardModeCheckbox) {
                elements.hardModeCheckbox.checked = state.hardMode;
            }
            if (elements.timerDurationSelect) {
                elements.timerDurationSelect.value = state.timerDuration;
            }

            if (data.state.gameStarted) {
                startGame();
            }
            
            // Connect to peers for Voice Chat
            voiceChat.join(state.gameState.players);
            break;

        case 'playerJoined':
            state.gameState.players = data.players;
            state.gameState.hostId = data.hostId;
            if (data.hostId === state.playerId) {
                state.isHost = true;
            }
            updatePlayerList();
            
            // Connect to the new player
            voiceChat.join(state.gameState.players);
            break;

        case 'playerLeft':
            // Find who left to clean up their WebRTC connection
            const oldPlayers = state.gameState.players;
            const newPlayers = data.players;
            const leftPlayer = oldPlayers.find(op => !newPlayers.some(np => np.id === op.id));
            if (leftPlayer) {
                voiceChat.removePeer(leftPlayer.id);
            }
            
            state.gameState.players = data.players;
            if (data.hostId === state.playerId) {
                state.isHost = true;
            }
            updatePlayerList();
            if (state.gameState.gameStarted) {
                renderGame();
            }
            break;
            
        case 'webrtc-signal':
            voiceChat.handleSignal(data.fromId, data.signal);
            break;

        case 'gameStarted':
            state.gameState.deck = data.deck;
            state.gameState.players = data.players;
            state.gameState.gameStarted = true;
            state.hardMode = data.hardMode || false;
            state.slotCount = data.slotCount || 2;
            startGame();
            break;

        case 'cardDrawn':
            handleCardDrawn(data);
            break;

        case 'cardFlipped':
            handleCardFlipped(data);
            break;

        case 'cardMoved':
            handleCardMoved(data);
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
            state.hardMode = data.hardMode || false;
            state.slotCount = data.slotCount || 2;
            state.timers = {};
            elements.gameOverModal.classList.add('hidden');
            renderGame();
            break;

        case 'hardModeChanged':
            state.hardMode = data.hardMode;
            state.slotCount = data.slotCount;
            state.gameState.players = data.players;
            // Update checkbox state
            if (elements.hardModeCheckbox) {
                elements.hardModeCheckbox.checked = data.hardMode;
            }
            break;
            
        case 'timerChanged':
            state.timerDuration = data.timerDuration;
            if (elements.timerDurationSelect) {
                elements.timerDurationSelect.value = data.timerDuration;
            }
            break;
            
        case 'timerStarted':
            state.timers[data.playerId] = {
                duration: data.duration,
                // Compute locally to avoid server-client clock skew
                endTime: Date.now() + (data.duration * 1000)
            };
            if (state.gameState.gameStarted) renderGame();
            break;
            
        case 'timerCancelled':
            delete state.timers[data.playerId];
            if (state.gameState.gameStarted) renderGame();
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
        onFlip: handleFlipCard,
        slotCount: state.slotCount,
        timers: state.timers
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

    // Fullscreen toggle button
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    fullscreenBtn?.addEventListener('click', toggleFullscreen);
}

// Toggle fullscreen mode
function toggleFullscreen() {
    // Check if currently in fullscreen
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
        return;
    }

    // Try native Fullscreen API
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {
            iosFullscreenFallback();
        });
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    } else {
        // iOS Safari fallback — no Fullscreen API available
        iosFullscreenFallback();
    }
}

// iOS fallback: minimize browser chrome + show guidance
function iosFullscreenFallback() {
    // Scroll trick to collapse Safari address bar
    document.body.style.height = 'calc(100vh + 1px)';
    window.scrollTo(0, 1);
    setTimeout(() => {
        document.body.style.height = '';
    }, 100);

    // Show toast with guidance
    showToast('Thêm vào Màn hình chính để chơi toàn màn hình');
}

// Show a brief toast notification
function showToast(message) {
    const existing = document.querySelector('.game-notification');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'game-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
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
            <h2>Lịch sử bỏ bài</h2>
            <div id="discardHistoryList" class="discard-history-list"></div>
            <button id="closeDiscardHistory" class="btn btn-secondary">Đóng</button>
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
        list.innerHTML = '<p class="no-discards">Chưa có bài nào bị bỏ</p>';
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
    playSound('deal', 0.5);

    // Get starting position from the deck
    const deckEl = elements.deck;
    let startRect;
    const topDeckCard = deckEl.querySelector('.deck-card:last-child');
    if (topDeckCard) {
        startRect = topDeckCard.getBoundingClientRect();
    } else {
        startRect = deckEl.getBoundingClientRect();
    }

    // Create a clone of the drawn card for animation
    const clone = createCard(data.card, false);
    clone.style.position = 'fixed';
    clone.style.left = `${startRect.left}px`;
    clone.style.top = `${startRect.top}px`;
    clone.style.margin = '0';
    clone.style.zIndex = '9999';
    clone.style.transition = 'none'; // Start without transition
    clone.classList.remove('flipped'); 
    
    document.body.appendChild(clone);
    
    // Force layout so the initial position is applied before transitioning
    clone.getBoundingClientRect();
    
    // Now add transition
    clone.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';

    // Pop the top card from client deck
    state.gameState.deck.pop();

    // Sync player state from server
    if (data.players) {
        state.gameState.players = data.players;
    }
    renderGame();
    
    // Find the target slot
    const targetSlot = document.querySelector(`.player-slot[data-player-id="${data.playerId}"] .card-slot[data-slot-index="${data.slotIndex}"]`);
    const targetCard = targetSlot?.querySelector('.card');
    
    if (targetCard && clone) {
        // Hide the newly rendered card temporarily
        targetCard.style.opacity = '0';
        
        // Compute rect IMMEDIATELY before any rapid subsequent clicks can trigger renderGame and destroy the slot!
        const targetRect = targetSlot.getBoundingClientRect();
        
        // Wait for next frame to start animation
        requestAnimationFrame(() => {
            // Animate to target
            clone.style.left = `${targetRect.left + (targetRect.width - clone.offsetWidth) / 2}px`;
            clone.style.top = `${targetRect.top + (targetRect.height - clone.offsetHeight) / 2}px`;
            
            // After animation completes
            setTimeout(() => {
                if (document.body.contains(clone)) {
                    document.body.removeChild(clone);
                }
                
                // Re-query the target card because renderGame might have been called again by rapid clicks
                const freshTargetSlot = document.querySelector(`.player-slot[data-player-id="${data.playerId}"] .card-slot[data-slot-index="${data.slotIndex}"]`);
                const freshTargetCard = freshTargetSlot?.querySelector('.card');
                if (freshTargetCard) {
                    freshTargetCard.style.opacity = '1';
                }
            }, 400);
        });
    } else if (clone) {
        document.body.removeChild(clone);
    }
}

function handleCardFlipped(data) {
    const player = state.gameState.players.find(p => p.id === data.playerId);
    if (player && player.cards[data.slotIndex]) {
        player.cards[data.slotIndex].isFlipped = data.isFlipped;
        
        // Update DOM directly to allow CSS transition to play
        const playerSlot = document.querySelector(`.player-slot[data-player-id="${data.playerId}"]`);
        if (playerSlot) {
            const cardSlot = playerSlot.querySelector(`.card-slot[data-slot-index="${data.slotIndex}"]`);
            if (cardSlot) {
                const card = cardSlot.querySelector('.card');
                if (card) {
                    playSound('flip', 0.6);
                    if (data.isFlipped) {
                        card.classList.add('flipped');
                    } else {
                        card.classList.remove('flipped');
                    }
                }
            }
        }
    }
}

function handleCardsSwapped(data) {
    const player = state.gameState.players.find(p => p.id === data.playerId);
    if (player) {
        player.cards = data.cards;
    }
    renderGame();
}

function handleCardDiscarded(data) {
    playSound('deal', 0.5);

    // Find the old card element before re-rendering
    const oldPlayerSlot = document.querySelector(`.player-slot[data-player-id="${data.playerId}"]`);
    const oldCardSlot = oldPlayerSlot?.querySelector(`.card-slot[data-slot-index="${data.slotIndex}"]`);
    const oldCard = oldCardSlot?.querySelector('.card');
    
    let clone = null;
    if (oldCard) {
        const rect = oldCard.getBoundingClientRect();
        clone = oldCard.cloneNode(true);
        clone.style.position = 'fixed';
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.margin = '0';
        clone.style.zIndex = '9999';
        clone.style.transition = 'all 0.5s cubic-bezier(0.5, 0, 0.2, 1)';
        document.body.appendChild(clone);
    }

    state.gameState.players = data.players;
    state.discardHistory = data.discardHistory;
    renderGame();
    
    // Trigger Effects
    if (clone) {
        const penaltyZone = elements.penaltyZone;
        const pRect = penaltyZone.getBoundingClientRect();
        const targetX = pRect.left + pRect.width / 2 - clone.offsetWidth / 2;
        const targetY = pRect.top + pRect.height / 2 - clone.offsetHeight / 2;
        
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                clone.style.left = `${targetX}px`;
                clone.style.top = `${targetY}px`;
                clone.classList.add('void-suck');
                
                const isMe = data.playerId === state.playerId;
                
                if (isMe) {
                    // Add screen shake and vignette
                    elements.gameTable.classList.add('shake-effect');
                    const vignette = document.getElementById('vignetteOverlay');
                    if (vignette) vignette.classList.add('vignette-effect');
                    
                    // Haptic feedback
                    if (navigator.vibrate) {
                        navigator.vibrate([150, 50, 150]);
                    }
                }
                
                setTimeout(() => {
                    clone.remove();
                    if (isMe) {
                        elements.gameTable.classList.remove('shake-effect');
                        const vignette = document.getElementById('vignetteOverlay');
                        if (vignette) vignette.classList.remove('vignette-effect');
                    }
                    
                    if (data.gameOver) {
                        showGameOver(data.loserName);
                    }
                }, 500);
            });
        });
    } else if (data.gameOver) {
        showGameOver(data.loserName);
    }
}

function handleCardMoved(data) {
    playSound('deal', 0.5);
    // Find the old card element
    const oldPlayerSlot = document.querySelector(`.player-slot[data-player-id="${data.fromPlayerId}"]`);
    const oldCardSlot = oldPlayerSlot?.querySelector(`.card-slot[data-slot-index="${data.fromSlot}"]`);
    const oldCard = oldCardSlot?.querySelector('.card');
    
    let clone = null;
    if (oldCard) {
        const rect = oldCard.getBoundingClientRect();
        clone = oldCard.cloneNode(true);
        clone.style.position = 'fixed';
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.margin = '0';
        clone.style.zIndex = '9999';
        clone.style.transition = 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
        document.body.appendChild(clone);
    }
    
    // Update state and render
    state.gameState.players = data.players;
    renderGame();
    
    if (clone) {
        // Find the new DOM position of the card
        const newCard = document.querySelector(`.card[data-card-id="${data.card.id}"]`);
        
        if (newCard) {
            newCard.style.opacity = '0'; // Hide real one during animation
            
            // Yield to allow DOM update
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const newRect = newCard.getBoundingClientRect();
                    clone.style.left = `${newRect.left}px`;
                    clone.style.top = `${newRect.top}px`;
                    clone.style.transform = ''; // Clear any perspective transform just in case
                    
                    setTimeout(() => {
                        clone.remove();
                        newCard.style.opacity = '1';
                    }, 500);
                });
            });
        } else {
            clone.remove();
        }
    }
}

function showGameOver(loserName) {
    elements.gameOverMessage.textContent = `${loserName} đã bị 3 lần phạt và thua cuộc!`;
    elements.gameOverModal.classList.remove('hidden');
}

// Start
init();
