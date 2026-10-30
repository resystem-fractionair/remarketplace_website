# reMarketplace — remarketplace.store

The white-label product marketplace of the ReSystem ecosystem. Businesses browse pre-built "master label" products (identity, payments, wallets, real-world assets, investment, AI), try the demo, book a walkthrough and launch them under their own brand.

Node.js + Express, plain HTML/CSS/JS (no build step), Supabase for data, deployed on Vercel.

## Repository structure

```
remarketplace_website/
├── api/index.js            Vercel serverless entry → server/app.js
├── server.js               Local entry (npm start → http://localhost:3000)
├── vercel.json             Routes every request to api/index.js, bundles public/ and data/
├── server/
│   ├── app.js              Express app: public API, SEO page rendering, QR codes, bookings, reID sign-in, crawlers
│   ├── admin.js            Admin API (/api/admin/*): login, products, settings, bookings, uploads, IndexNow
│   ├── store.js            Data layer: Supabase (Postgres + Storage) or local JSON files; defaults for all content
│   └── mailer.js           Booking emails (SMTP) with calendar invite (.ics)
├── public/
│   ├── index.html          Homepage
│   ├── product.html        Product page shell (filled by js/product.js)
│   ├── 404.html
│   ├── admin/              Admin console (index.html, admin.js, admin.css)
│   ├── js/                 common.js (shared + booking wizard), home.js, product.js, explainer.js, theme.js
│   ├── css/                style.css (base tokens), site.css (all page sections)
│   ├── img/                Logos, icons, OG share image
│   └── media/explainer.mp3 Narrated explainer soundtrack (voice + music)
├── data/
│   ├── products.json       Seed catalog (copied into Supabase on first run)
│   └── explainer-script.json  Explainer narration script and chapter timings
├── supabase/schema.sql     Tables and storage bucket
└── docs/                   ARCHITECTURE, ADMIN-GUIDE, API, DEPLOYMENT, SEO
```

## Run locally

```bash
npm install
npm start               # http://localhost:3000 — admin at /admin (dev login admin / admin)
```

Without Supabase variables the site reads and writes `data/*.json` (local development only).

## Configuration (Vercel → Settings → Environment Variables)

| Variable | Purpose |
|---|---|
| `SITE_URL` | Public URL, e.g. `https://remarketplace.store` (QR codes, canonical links, sitemap, reID redirect) |
| `SESSION_SECRET` | Long random string that signs login cookies |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Admin console login |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database + image storage (required for admin saves on Vercel) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Booking emails to info@remarketplace.store and the customer |
| `REID_CLIENT_ID`, `REID_CLIENT_SECRET`, `REID_AUTH_URL`, `REID_TOKEN_URL`, `REID_USERINFO_URL` | "Sign in with reID" (OAuth 2.0 + PKCE) |
| `BOOKING_WEBHOOK_URL` | Optional: every booking is also POSTed here as JSON |
| `INDEXNOW_KEY` | Optional: fixed IndexNow key (one is derived from `SITE_URL` otherwise) |

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pieces fit, data model, request flow
- [docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md) — everything the admin console can do
- [docs/API.md](docs/API.md) — every route
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Vercel, Supabase, email, domain, go-live checklist
- [docs/SEO.md](docs/SEO.md) — meta tags, structured data, sitemap, robots, llms.txt, IndexNow
- `docs/handover/` — technical and marketing handover PDFs
