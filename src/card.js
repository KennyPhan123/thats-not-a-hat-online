// Card component with flip animation
export function createCard(cardData, isLarge = false) {
    const card = document.createElement('div');
    card.className = `card${isLarge ? ' large' : ''}${cardData.isFlipped ? ' flipped' : ''}`;
    card.dataset.cardId = cardData.id;
    card.draggable = false; // We handle drag manually for touch support

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    const front = document.createElement('div');
    front.className = 'card-face card-front';
    front.style.backgroundImage = `url(${cardData.front})`;

    const back = document.createElement('div');
    back.className = 'card-face card-back';
    back.style.backgroundImage = `url(${cardData.back})`;

    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);

    return card;
}

// Handle double tap/click to flip
let lastTapTime = 0;
export function setupFlipHandler(cardElement, onFlip) {
    const handlePotentialFlip = (e) => {
        const now = Date.now();
        if (now - lastTapTime < 300) {
            e.preventDefault();
            onFlip();
            lastTapTime = 0;
        } else {
            lastTapTime = now;
        }
    };

    cardElement.addEventListener('touchend', handlePotentialFlip);
    cardElement.addEventListener('dblclick', (e) => {
        e.preventDefault();
        onFlip();
    });
}

// Preload card images
export function preloadCardImages(cardList) {
    const promises = cardList.map(card => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = resolve; // Continue even if image fails
            img.src = card.front;
        });
    });

    // Also preload backs
    ['back_black.png', 'back_white.png'].forEach(back => {
        const img = new Image();
        img.src = `/cards/backs/${back}`;
    });

    return Promise.all(promises);
}
