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

## SEO & AI discovery
Server-rendered title, description, canonical, Open Graph, Twitter and JSON-LD (Organization, WebSite, ItemList, FAQPage, SoftwareApplication, BreadcrumbList) on every page. `/robots.txt` welcomes search engines and AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, …), `/sitemap.xml` includes images, `/llms.txt` and `/llms-full.txt` summarise the site and products for AI agents, plus `/site.webmanifest`, favicon.ico and app icons. All generated from the admin data.

## Admin console — `/admin`
Password: `ADMIN_PASSWORD` env var (dev default `admin` only when NODE_ENV isn't production).
- **Products:** add / edit / delete, upload images (card, hero, mobile, logo) and PDFs, edit all page content, show/hide toggle, drag to reorder the catalog.
- **Homepage rows:** create rows, pick which products go in each row and their order (drag), reorder/delete rows, toggle the full catalog.
- **Categories & groups:** add, rename (applied to all products), reorder (sets the homepage filter order).

Storage: set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and run `supabase/schema.sql` once. The first load seeds the database from `data/products.json`. Without Supabase, edits are written to `data/*.json` (local dev only).
