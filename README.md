# That's Not a Hat

An interactive online card game for 2-8 players. A sandbox-style implementation where players interact freely, just like in real life.

## Online Play
The old `partykit.dev` address is no longer available. Deploy the project to Cloudflare Workers as described below to get a new URL.

## Setupt the Game

That's Not a Hat is a memory and bluffing card game. Players draw cards, remember them, and pass them to other players face-down. The challenge is to remember what card you're receiving - or convincingly pretend you do!

### Features

- Real-time multiplayer (2-8 players)
- Drag and drop cards between players
- Flip cards to see/hide them
- Discard pile with history tracking
- Mobile and desktop responsive
- No account required - just share the room code

## How to Play

1. **Create or Join a Game**
   - One player creates a room and shares the 4-letter code
   - Other players join using the code

2. **Draw Cards**
   - Click the deck to draw a card to your hand
   - First card goes to the bottom slot, second to the top

3. **Manage Your Cards**
   - Click your cards to flip them face-up/face-down
   - Drag cards to other players' empty slots
   - Drag cards to the Discard zone to discard (adds a penalty)

4. **Win Condition**
   - A player with 3 penalties loses the game

## Tech Stack

- **Frontend:** Vanilla JavaScript + Vite
- **Backend:** PartyServer (WebSocket rooms with Durable Objects)
- **Hosting:** Cloudflare Workers and Workers Assets

## Local Development

### Prerequisites

- Node.js 22 or newer and npm
- A Cloudflare account for deployment (the Workers Free plan supports SQLite-backed Durable Objects)

### Run locally

```bash
npm ci
npm run dev
```

Open the URL printed by Wrangler (normally `http://localhost:8787`). The command builds the site first, then runs the Worker and rooms locally. Re-run it after changing frontend files. The frontend and WebSockets must use the same host; use Wrangler rather than the Vite preview server to play.

### Deploy to Cloudflare

1. Create a Cloudflare account and enable Workers. Select the Free plan if desired; Cloudflare's free usage limits apply.
2. In a terminal on your computer, run:

```bash
npm ci
npx wrangler login
npm run deploy
```

3. Open and share the `https://...workers.dev` URL printed by Wrangler. If prompted, choose a workers.dev subdomain. The frontend automatically connects to the same host, so no URL needs to be hard-coded.

The previous PartyKit hosted platform and its deployment command have shut down. Old room state is not migrated. Rooms in this app are kept in memory while connected, so a room may reset when the Worker restarts. If usage exceeds Cloudflare's free limits, service may be restricted; see [Cloudflare Workers pricing](https://workers.cloudflare.com/plans).

## Project Structure

```
├── index.html          # Main HTML file
├── src/
│   ├── main.js         # Client-side game logic
│   ├── game.js         # Game state management
│   ├── player.js       # Player rendering
│   ├── card.js         # Card component
│   ├── drag.js         # Drag and drop handling
│   └── styles.css      # Styling
├── party/
│   └── server.js       # PartyKit WebSocket server
├── public/
│   └── cards/          # Card images
└── partykit.json       # PartyKit configuration
```

## License

MIT
