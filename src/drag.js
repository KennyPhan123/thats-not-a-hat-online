// Unified drag and drop handler for both mouse and touch
export class DragHandler {
    constructor(options) {
        this.container = options.container;
        this.onDragStart = options.onDragStart || (() => { });
        this.onDragMove = options.onDragMove || (() => { });
        this.onDragEnd = options.onDragEnd || (() => { });
        this.onDrop = options.onDrop || (() => { });

        this.isDragging = false;
        this.dragElement = null;
        this.dragClone = null;
        this.startX = 0;
        this.startY = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.dragData = null;

        this.bindEvents();
    }

    bindEvents() {
        // Mouse events
        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));

        // Touch events
        this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }

    getCardElement(target) {
        return target.closest('.card');
    }

    handleMouseDown(e) {
        const card = this.getCardElement(e.target);
        if (!card) return;

        // Prevent dragging during flip animation
        if (Date.now() - (card.lastTapTime || 0) < 300) return;

        this.startDrag(card, e.clientX, e.clientY);
    }

    handleTouchStart(e) {
        if (e.touches.length !== 1) return;

        const touch = e.touches[0];
        const card = this.getCardElement(touch.target);
        if (!card) return;

        // Store touch start for double-tap detection
        card.touchStartTime = Date.now();
        this.touchStartCard = card;

        // Delay drag start to allow for tap detection
        this.dragTimeout = setTimeout(() => {
            this.startDrag(card, touch.clientX, touch.clientY);
            e.preventDefault();
        }, 150);
    }

    startDrag(card, x, y) {
        const rect = card.getBoundingClientRect();
        this.isDragging = true;
        this.dragElement = card;
        this.startX = x;
        this.startY = y;
        this.offsetX = x - rect.left;
        this.offsetY = y - rect.top;

        // Create clone for dragging
        this.dragClone = card.cloneNode(true);
        this.dragClone.className = card.className + ' dragging';
        this.dragClone.style.position = 'fixed';
        this.dragClone.style.left = `${rect.left}px`;
        this.dragClone.style.top = `${rect.top}px`;
        this.dragClone.style.width = `${rect.width}px`;
        this.dragClone.style.height = `${rect.height}px`;
        this.dragClone.style.zIndex = '9999';
        document.body.appendChild(this.dragClone);

        // Hide original
        card.style.opacity = '0.3';

        // Get drag data from parent
        const slot = card.closest('.card-slot');
        const playerSlot = card.closest('.player-slot');
        if (slot && playerSlot) {
            this.dragData = {
                cardId: card.dataset.cardId,
                fromPlayerId: playerSlot.dataset.playerId,
                fromSlot: parseInt(slot.dataset.slotIndex)
            };
        }

        this.onDragStart(this.dragData);
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;
        this.moveDrag(e.clientX, e.clientY);
    }

    handleTouchMove(e) {
        if (this.dragTimeout) {
            clearTimeout(this.dragTimeout);
            this.dragTimeout = null;
        }

        if (!this.isDragging) return;
        if (e.touches.length !== 1) return;

        e.preventDefault();
        const touch = e.touches[0];
        this.moveDrag(touch.clientX, touch.clientY);
    }

    moveDrag(x, y) {
        if (!this.dragClone) return;

        this.dragClone.style.left = `${x - this.offsetX}px`;
        this.dragClone.style.top = `${y - this.offsetY}px`;

        // Check drop targets
        this.updateDropTargets(x, y);
        this.onDragMove(x, y, this.dragData);
    }

    updateDropTargets(x, y) {
        // Remove previous highlights
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });

        // Find elements under cursor
        if (this.dragClone) {
            this.dragClone.style.pointerEvents = 'none';
        }

        const elementsUnder = document.elementsFromPoint(x, y);

        if (this.dragClone) {
            this.dragClone.style.pointerEvents = '';
        }

        // Check for drop targets
        for (const el of elementsUnder) {
            if (el.classList.contains('card-slot') && !el.classList.contains('occupied')) {
                el.classList.add('drag-over');
                break;
            }
            if (el.classList.contains('penalty-zone')) {
                el.classList.add('drag-over');
                break;
            }
        }
    }

    handleMouseUp(e) {
        if (!this.isDragging) return;
        this.endDrag(e.clientX, e.clientY);
    }

    handleTouchEnd(e) {
        if (this.dragTimeout) {
            clearTimeout(this.dragTimeout);
            this.dragTimeout = null;
        }

        if (!this.isDragging) return;

        const touch = e.changedTouches[0];
        this.endDrag(touch.clientX, touch.clientY);
    }

    endDrag(x, y) {
        if (!this.isDragging) return;

        // Restore original card
        if (this.dragElement) {
            this.dragElement.style.opacity = '';
        }

        // Remove clone
        if (this.dragClone) {
            this.dragClone.remove();
            this.dragClone = null;
        }

        // Remove highlights
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });

        // Find drop target
        const elementsUnder = document.elementsFromPoint(x, y);
        let dropTarget = null;

        for (const el of elementsUnder) {
            if (el.classList.contains('penalty-zone')) {
                dropTarget = { type: 'penalty' };
                break;
            }
            if (el.classList.contains('card-slot')) {
                const playerSlot = el.closest('.player-slot');
                dropTarget = {
                    type: 'player',
                    playerId: playerSlot?.dataset.playerId,
                    slotIndex: parseInt(el.dataset.slotIndex),
                    isEmpty: !el.classList.contains('occupied')
                };
                break;
            }
        }

        this.onDrop(this.dragData, dropTarget);
        this.onDragEnd();

        this.isDragging = false;
        this.dragElement = null;
        this.dragData = null;
    }

    destroy() {
        // Clean up event listeners if needed
    }
}
