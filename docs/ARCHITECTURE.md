# Architecture

## Overview

```
Browser ──► Vercel (api/index.js) ──► server/app.js (Express)
                                         ├── server/store.js ──► Supabase Postgres (rm_products, rm_settings, rm_bookings)
                                         │                   └─► Supabase Storage bucket rm-images (uploads)
                                         ├── server/admin.js  (admin API, cookie session)
                                         └── server/mailer.js ──► SMTP (booking emails + .ics)
```

The front end is static HTML/CSS/JS in `public/`. Pages are shells: the server injects SEO meta tags, then the page script fetches JSON (`/api/home`, `/api/content`, `/api/booking/config`) and renders. No framework, no build step.

## Data model

All data goes through `server/store.js`, which has two modes:

| Mode | When | Where data lives |
|---|---|---|
| `supabase` | `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set | Postgres tables + Storage bucket |
| `file` | otherwise (local dev) | `data/products.json`, `data/settings.json`, `data/bookings.json`, `public/uploads/` |

On first load in Supabase mode an empty `rm_products` table is seeded from `data/products.json`, and `rm_settings` is created from the defaults in `store.js`.

### Tables (`supabase/schema.sql`)

| Table | Key | Contents |
|---|---|---|
| `rm_products` | `slug` | `data` (jsonb: all product fields), `visible`, `position` |
| `rm_settings` | `key` (`site`) | `value` (jsonb): categories, groups, home, rows, booking, qr, content |
| `rm_bookings` | `ref` | `slot_key` (unique, prevents double booking), `status`, `data` (jsonb) |

RLS is enabled with no public policies; only the server (service-role key) reads and writes.

### Product fields

`name, slug, tagline, category, group, status, deploy, price, summary, whatItIs, features[], whyPoints[], whatYouCanDo[], useCases[], stats[], highlights[{title,text}], image, hero, logo, externalUrl, demoUrl, demoCreds[{label,value}], demoNote, investUrl, pdfDesktop, pdfMobile, seoTitle, seoDescription, showFrom, showUntil, visible, position, tone`

A product is public when `visible` is on **and** today (Dubai) is inside `showFrom … showUntil`.

### Settings (`rm_settings.site`)

| Key | What it drives |
|---|---|
| `content` | Every text on the site: seo, header, product labels, booking panel, hero, why, steps, glossary, usecases, catalog, faq, footer |
| `home` | `defaultSlugs` (homepage default products, ordered) and `limit` |
| `rows` | Curated rows; row 1 = "Featured products" on product pages |
| `categories`, `groups` | Filter chips order, product grouping |
| `booking` | Notification email, time zone, call length, booking window, notice, working days, slots, languages, agents |
| `qr` | `mainUrl` — target of the main QR code |

`cleanContent()` merges saved content over `DEFAULT_CONTENT()`, so new fields added in code appear automatically with defaults.

## Request flow

| Page | Server | Browser |
|---|---|---|
| `/` | `page('index.html', meta)` injects title, OG, JSON-LD | `common.js` (header/footer/booking), `home.js` (content + catalog), `explainer.js` |
| `/product/:slug` | 404 unless public; injects product meta + JSON-LD | `product.js` renders the product from `/api/home` |
| `/admin` | static | `admin/admin.js` |

## Booking flow

1. Wizard (`common.js`): products → date & time → language & agent → details → review.
2. Availability: `/api/booking/availability?date=` returns taken `agent|date|time` keys; the browser shows a slot only if an agent who works then is free.
3. `POST /api/bookings` re-validates everything (window, notice, working hours, language), stores with a unique `slot_key` (409 if taken), then sends two HTML emails with an `.ics` invite via `mailer.js`.
4. Cancelling a booking in the admin clears its `slot_key`, freeing the slot.

## Explainer

`public/media/explainer.mp3` is one mixed track (Kokoro natural voice + generated ambient music, ducked under the voice). `explainer.js` reads `audio.currentTime` every frame and shows the matching scene, so picture and sound cannot drift. Chapter start times live in `explainer.js` (`CH`) and `data/explainer-script.json`.

To change the narration: edit the script, regenerate the audio with Kokoro (`kokoro-onnx`, voice `af_heart`), update the chapter times in `explainer.js`.
