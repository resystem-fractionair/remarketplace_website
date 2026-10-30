# reMarketplace — remarketplace.store

Standalone reMarketplace site (moved out of resystem.org). Node.js + Express, no build step.

- `/` — pitch, catalog (search, filters, sort), use cases, FAQ, demo booking
- `/product/:slug` — product page: details, features, use cases, live demo, PDF brochures, investment link, QR code
- `/qr/home.svg`, `/qr/:slug.svg|.png` — QR codes generated from `SITE_URL`
- `/api/products`, `/api/bookings`, `/api/me`, `/api/auth/reid/*` (reID OAuth 2.0 + PKCE), `/sitemap.xml`

## Run
```
npm install
cp .env.example .env   # fill in, then export the vars
npm start              # http://localhost:3000
```

## Edit products
All product content lives in `data/products.json` (sourced from resystem.org/suit/* pages). Add or edit an entry and redeploy — the catalog, product page, QR code and sitemap update automatically.

## Deploy (Vercel)
Import the repo as a new Vercel project; `vercel.json` routes everything through `api/index.js`. Set the env vars from `.env.example`, add the domain `remarketplace.store`, and register `https://remarketplace.store/api/auth/reid/callback` as the reID redirect URI.

Bookings are logged and, if `BOOKING_WEBHOOK_URL` is set, POSTed there as JSON.
