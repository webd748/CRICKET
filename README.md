# Multi-Team Tournament Auctioneer Dashboard

A static single-page Auctioneer dashboard for managing a **multi-team cricket player auction**.

## How to run this

Because this app loads `players.json` via `fetch`, run it behind a local HTTP server (opening `index.html` directly may fail in some browsers).

### Option 1: Python (recommended)

```bash
cd /workspace/CRICKET
python -m http.server 4173
```

Then open:

- http://127.0.0.1:4173

### Option 2: Any static server

Serve this folder with any static server of your choice (e.g. `npx serve`, VS Code Live Server) and open the served URL.

## Quick usage flow

1. Configure wallet, squad size, and minimum base price.
2. Add teams (or click **Load Demo Teams**).
3. In **Auction Arena**, choose a winning team and sold price.
4. Click **Mark as Sold** (validation is enforced) or **Mark as Unsold (Passed)**.
5. Use **Teams View** for leaderboard/squads.
6. Use **Unsold Players** to re-auction passed players.

## Files

- `index.html` — layout and tabs.
- `styles.css` — responsive projector/tablet-friendly styling.
- `app.js` — state, business rules, rendering, interactions.
- `players.json` — predefined player pool.
