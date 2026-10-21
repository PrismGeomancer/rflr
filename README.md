# RAFFLER

A static SOL raffle site. No server, database or build step is needed to run it. Raffles, entries and receipts are saved in the visitor's browser; Solana wallets connect through Wallet Standard (public address and balance only, never a signature or payment).

## Publish to GitHub Pages

1. Create a GitHub repository.
2. Upload the **contents of the `dist/` folder** to the repository root (drag them into the "Add file → Upload files" page, or push them with git). `index.html` must sit at the top level.
3. In **Settings → Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then save.

Your site goes live at `https://<user>.github.io/<repo>/` within a minute. `release/raffler-pages.zip` is the same `dist/` content, ready to unzip.

Prefer pushing the whole project? Push this folder to `main` and set **Settings → Pages → Source** to **GitHub Actions**; `.github/workflows/pages.yml` publishes `dist/`.

## Run locally

`npm run serve`, then open http://127.0.0.1:4187. Wallets only connect over HTTPS or localhost.

## How it works

- **Storage:** everything lives in the browser's localStorage, per device. Use **My entries → Export backup / Import backup** to move or protect data. Backups are checksummed and can be merged without overwriting existing raffles.
- **Draws:** the creator closes entries or waits for the deadline, then draws. The winner is chosen with `crypto.getRandomValues` using unbiased rejection sampling. Receipts can be downloaded, copied or turned into a share card.
- **Creator tools:** close early, draw, download entrants (CSV), duplicate, delete.
- **No money moves:** nothing is deposited, charged or paid out. Raffles are not shared between visitors; share one by exporting a backup for the recipient to import.
- **Balance reads:** use a public Solana RPC (default mainnet), changeable under Settings. The wallet's public address is sent there.

## Development

Source modules in `dist/`: `config.js`, `core.js` (model and validation), `wallet.js`, `app.js` (UI), `phone.js` (landing tour), `styles.css`. `dist/raffler.js` is the bundle the page loads.

- `npm test` – model and wallet tests (Node 20+)
- `npm run build` – rebuild `dist/raffler.js` after editing source (`npm ci` first)
- `npm run verify` – check asset references and bundle freshness
- `npm run package` – rebuild and refresh the ZIPs in `release/`

Fonts and the Wallet Standard registry are bundled locally with their licenses.
