# Admin guide — `/admin`

Sign in with `ADMIN_USER` / `ADMIN_PASSWORD`. The badge at the top right shows **● Live database** (Supabase) or **● Local files (dev)**.

## Products
- **List:** drag ⋮⋮ to set catalog order; switch = show/hide; badges show homepage row and schedule ("Goes live …", "Live until …", "Ended …").
- **+ New product / Edit:**
  - *Basics* — name, URL slug, tagline, category, group, badge (e.g. Coming soon), go-live time, pricing, summary, what it is, visible, icon colour.
  - *Schedule* — show from / hide after (Dubai dates). Plan launches in advance.
  - *SEO & sharing* — custom search title and description.
  - *Images* — card image (catalog, banner, share image), banner override, logo. Upload or paste a URL.
  - *Links, demo access & brochures* — live site, demo URL, sandbox note, investment URL, desktop/mobile PDF (upload or URL), source page.
  - *Page content* — features, why points, what you can do, use cases, stats, highlights (`Title | text`), one per line.
  - *Sandbox / demo credentials* — `Label | value` per line; shown in the Try-demo panel with Copy buttons.
- **Duplicate** copies a product into a hidden draft. **Delete** is permanent (hide instead to keep data).

## Homepage
- **Default products** — which products the homepage shows first, in order, and how many. Visitors see "View all products (N)". Search and category chips always cover every product.
- **Featured on product pages** — row 1 is the "Featured products" list on every product page.

## Site content
Every text on the site, with add / remove / reorder for lists:
SEO (site name, title, description, keywords, share image, X handle, Google/Bing verification), Header (menu links, button, search placeholder, announcement bar), Product page labels, Book-a-demo panel, Hero (label, first word, rotating words, headline, subtitle, buttons, stats), Why cards, Listing steps, Glossary & QR card, Use cases & target market, All products section, FAQ, Footer.

## Categories
Add, rename (applied to every product in it), reorder (filter chip order), remove. Same for groups.

## Bookings
- List of all bookings with status (confirmed, completed, cancelled, no-show); cancelling frees the slot. **Export CSV**.
- **Booking settings:** notification email, time zone, call length, days ahead, minimum notice, working days, time slots, languages.
- **Agents:** photo, name, job title, bio, languages, products they cover, working days and hours, bookable switch.

## QR & SEO
- **Submit all pages now** — sends every public URL to IndexNow engines (Bing, Yandex, Seznam, Naver). Product saves also submit automatically in production.
- **Main QR** — set what it points to; download PNG/SVG; copy link.
- **Product QRs** — one per product, always current; PNG for print, SVG for design.
