// Render the deck in the center of the table - cards are FACE UP (showing items)
export function renderDeck(deckCards, container, onClick) {
    const deckEl = container.querySelector('.deck');
    const deckCardsEl = deckEl.querySelector('.deck-cards');
    const deckCount = deckEl.querySelector('.deck-count');

    // Clear existing
    deckCardsEl.innerHTML = '';

    // Show stacked cards effect (max 5 visible) - FACE UP showing the item
    const visibleCount = Math.min(deckCards.length, 5);
    for (let i = 0; i < visibleCount; i++) {
        const card = document.createElement('div');
        card.className = 'deck-card';
        // Show the FRONT of the card (face up) - top card is last in array
        const cardIndex = deckCards.length - 1 - i;
        if (cardIndex >= 0 && deckCards[cardIndex]) {
            card.style.backgroundImage = `url(${deckCards[cardIndex].front})`;
        }
        card.style.top = `${-i * 2}px`;
        card.style.left = `${i * 1}px`;
        deckCardsEl.appendChild(card);
    }

    // Update count
    deckCount.textContent = deckCards.length;

    // Setup click handler
    deckEl.onclick = () => {
        if (deckCards.length > 0) {
            onClick();
        }
    };

    // Hide deck if empty
    deckEl.style.display = deckCards.length > 0 ? '' : 'none';
}

// Animate card draw from deck to player slot
export function animateCardDraw(card, fromElement, toElement) {
    return new Promise((resolve) => {
        const fromRect = fromElement.getBoundingClientRect();
        const toRect = toElement.getBoundingClientRect();

        const flyingCard = document.createElement('div');
        flyingCard.className = 'card drawing';
        flyingCard.style.position = 'fixed';
        flyingCard.style.left = `${fromRect.left}px`;
        flyingCard.style.top = `${fromRect.top}px`;
        flyingCard.style.width = `${toRect.width}px`;
        flyingCard.style.height = `${toRect.height}px`;
        flyingCard.style.zIndex = '1000';

        // Show front of card
        const inner = document.createElement('div');
        inner.className = 'card-inner';

        const front = document.createElement('div');
        front.className = 'card-face card-front';
        front.style.backgroundImage = `url(${card.front})`;

        inner.appendChild(front);
        flyingCard.appendChild(inner);
        document.body.appendChild(flyingCard);

        // Animate to target
        requestAnimationFrame(() => {
            flyingCard.style.transition = 'all 0.4s ease';
            flyingCard.style.left = `${toRect.left}px`;
            flyingCard.style.top = `${toRect.top}px`;
        });

        setTimeout(() => {
            flyingCard.remove();
            resolve();
        }, 400);
    });
}
