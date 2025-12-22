# 🎩 That's Not a Hat! - Online Card Game

An interactive online multiplayer card game for 3-8 players. Pass cards around, remember what you have, and try not to get penalties!

## 🎮 How to Play

1. **Create/Join Room**: Enter your name and create a room or join with a code
2. **Draw Cards**: Click/tap the deck in the center to draw a card
3. **Flip Cards**: Double-click/tap your card to flip it (face ↔ back)
4. **Pass Cards**: Drag your card to another player's empty slot
5. **Swap Cards**: Drag to rearrange your top/bottom cards
6. **Penalty**: Drag your card to the penalty zone at the bottom
7. **Game Over**: First player to get 3 penalties loses!

## 🚀 Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:3000
```

The game includes **mock mode** for local testing - it will auto-start with dummy players.

## 🌐 Deployment

### Step 1: Deploy PartyKit Server

```bash
# Login to PartyKit (creates account if needed)
npx partykit login

# Deploy server
npx partykit deploy
```

After deployment, you'll get a URL like: `your-project.username.partykit.dev`

### Step 2: Update Configuration

Edit `src/main.js` and update the PARTYKIT_HOST:

```javascript
const PARTYKIT_HOST = 'your-project.username.partykit.dev';
```

Or set environment variable `VITE_PARTYKIT_HOST` during build.

### Step 3: Deploy to Vercel/Netlify

**Vercel:**
```bash
npm run build
npx vercel --prod
```

**Netlify:**
```bash
npm run build
npx netlify deploy --prod --dir=dist
```

Or connect your GitHub repo for automatic deployments.

## 📁 Project Structure

```
├── index.html          # Main HTML
├── src/
│   ├── main.js         # Entry point & game logic
│   ├── game.js         # Game state management
│   ├── card.js         # Card component
│   ├── drag.js         # Touch/mouse drag handling
│   ├── player.js       # Player slots
│   ├── table.js        # Table & deck rendering
│   └── styles.css      # Pastel theme
├── party/
│   └── server.js       # PartyKit multiplayer server
└── public/
    └── cards/          # Card images
        ├── items/      # 110 item cards
        └── backs/      # Black & white backs
```

## 🎨 Features

- ✅ Pastel color theme
- ✅ 3D card flip animation
- ✅ Touch & mouse drag support
- ✅ Real-time multiplayer sync
- ✅ Responsive design (mobile-friendly)
- ✅ Penalty tracking
- ✅ Game reset on game over

## 📱 Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| Draw card | Click deck | Tap deck |
| Flip card | Double-click | Double-tap |
| Move card | Drag | Touch drag |
| Discard | Drag to bottom | Drag to bottom |

## 🔧 Tech Stack

- **Frontend**: Vanilla JS + Vite
- **Realtime**: PartyKit
- **Styling**: CSS (pastel theme)
