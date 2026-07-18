import { calculatePlayerPositions } from './game.js';
import { createCard, setupFlipHandler } from './card.js';

// Render all players around the table
export function renderPlayers(gameState, container, callbacks) {
    container.innerHTML = '';

    const positions = calculatePlayerPositions(
        gameState.players.length,
        gameState.players.findIndex(p => p.id === gameState.currentPlayerId),
        window.innerWidth,
        window.innerHeight
    );

    gameState.players.forEach((player, index) => {
        const pos = positions[index];
        const slot = createPlayerSlot(player, pos, gameState.currentPlayerId, callbacks);
        container.appendChild(slot);
    });
}

// Create a player slot element
function createPlayerSlot(player, position, currentPlayerId, callbacks) {
    const isCurrentPlayer = player.id === currentPlayerId;

    const slot = document.createElement('div');
    slot.className = `player-slot${isCurrentPlayer ? ' current-player' : ''}`;
    slot.dataset.playerId = player.id;
    slot.style.left = `${position.x}px`;
    slot.style.top = `${position.y}px`;

    // Player info
    const info = document.createElement('div');
    info.className = 'player-info';

    const name = document.createElement('span');
    name.className = 'player-name';
    name.textContent = player.name;
    info.appendChild(name);

    if (player.penalties > 0) {
        const penalty = document.createElement('span');
        penalty.className = 'player-penalty';
        penalty.textContent = `−${player.penalties}`;
        info.appendChild(penalty);
    }

    slot.appendChild(info);

    // Timer UI
    if (callbacks.timers && callbacks.timers[player.id]) {
        const timerData = callbacks.timers[player.id];
        const timerDiv = document.createElement('div');
        timerDiv.className = 'player-timer';
        
        const progressBar = document.createElement('div');
        progressBar.className = 'timer-progress';
        
        timerDiv.appendChild(progressBar);
        
        const durationMs = timerData.duration * 1000;
        
        const updateTimer = () => {
            if (!document.body.contains(timerDiv)) return;
            const now = Date.now();
            const left = Math.max(0, timerData.endTime - now);
            const p = (left / durationMs) * 100;
            progressBar.style.width = `${p}%`;
            
            if (p < 30) {
                progressBar.style.backgroundColor = 'var(--accent)';
            } else {
                progressBar.style.backgroundColor = '#4caf50';
            }
            
            if (left > 0) {
                requestAnimationFrame(updateTimer);
            }
        };
        requestAnimationFrame(updateTimer);
        
        slot.appendChild(timerDiv);
    }

    // Card slots - use dynamic slot count
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'player-cards';

    const slotCount = callbacks.slotCount || player.cards.length;

    for (let i = 0; i < slotCount; i++) {
        const cardSlot = document.createElement('div');
        cardSlot.className = 'card-slot';
        cardSlot.dataset.slotIndex = i;

        if (player.cards[i]) {
            cardSlot.classList.add('occupied');
            const card = createCard(player.cards[i], isCurrentPlayer);

            // Setup flip handler for current player's cards
            if (isCurrentPlayer && callbacks.onFlip) {
                setupFlipHandler(card, () => {
                    callbacks.onFlip(player.id, i);
                });
            }

            cardSlot.appendChild(card);
        }

        cardsContainer.appendChild(cardSlot);
    }

    slot.appendChild(cardsContainer);

    return slot;
}

// Update a specific player's display
export function updatePlayer(gameState, playerId, container) {
    const playerSlot = container.querySelector(`[data-player-id="${playerId}"]`);
    if (!playerSlot) return;

    const player = gameState.getPlayer(playerId);
    if (!player) return;

    // Update penalty display
    let penaltyEl = playerSlot.querySelector('.player-penalty');
    if (player.penalties > 0) {
        if (!penaltyEl) {
            penaltyEl = document.createElement('span');
            penaltyEl.className = 'player-penalty';
            playerSlot.querySelector('.player-info').appendChild(penaltyEl);
        }
        penaltyEl.textContent = `−${player.penalties}`;
    } else if (penaltyEl) {
        penaltyEl.remove();
    }
}
