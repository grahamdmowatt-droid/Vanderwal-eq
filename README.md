# VanderWal Equipment — vanderwaleq.com

Static site for VanderWal Equipment, Maple Ridge BC.

## Structure
- `index.html` — main page
- `assets/styles.css` — site styles
- `assets/script.js` — inventory fetch/render, model showroom overlay
- `assets/img/` — site images (placeholders pending real photography)
- `data/inventory.json` — placeholder inventory feed; will be replaced by the live Flyntlok-sourced feed URL

## Inventory feed
`assets/script.js` fetches inventory from `INVENTORY_FEED_URL` (currently `/data/inventory.json`).
See the comment block at the top of that file for the expected JSON schema.
