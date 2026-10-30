# Routes

## Pages
| Route | Notes |
|---|---|
| `GET /` | Homepage, server-rendered SEO meta + JSON-LD (Organization, WebSite, ItemList, FAQPage) |
| `GET /product/:slug` | Product page; 404 when hidden or outside its schedule; JSON-LD SoftwareApplication + BreadcrumbList |
| `GET /admin` | Admin console |

## Public API
| Route | Returns |
|---|---|
| `GET /api/home` | `{ products, rows, categories, content, home, showCatalog }` |
| `GET /api/products`, `GET /api/products/:slug` | Public products |
| `GET /api/content` | Site content (header, footer, labels …) |
| `GET /api/site` | `{ siteUrl, qr }` |
| `GET /api/booking/config` | Slots, languages, agents (active), window rules |
| `GET /api/booking/availability?date=YYYY-MM-DD` | `{ taken: ["agent|date|time"] }` |
| `POST /api/bookings` | Validates, stores, emails; `409` if the slot was just taken; rate-limited per IP |
| `GET /api/me` | Signed-in reID user or `null` |
| `GET /api/auth/reid/start`, `/callback` | reID OAuth 2.0 + PKCE |
| `POST /api/auth/logout` | Clears the session |

## Assets & crawlers
| Route | Notes |
|---|---|
| `GET /qr/home.svg|png`, `/qr/:slug.svg|png` | Live QR codes; `?dl=1` downloads |
| `GET /sitemap.xml` | Home + products with images |
| `GET /robots.txt` | All crawlers incl. AI bots allowed; `/admin` blocked |
| `GET /llms.txt`, `/llms-full.txt` | Plain-text site and product summary for AI agents |
| `GET /site.webmanifest`, `/favicon.ico` | App manifest and icons |
| `GET /<indexnow-key>.txt` | IndexNow ownership key |

## Admin API (cookie session; `401` when signed out)
| Route | Notes |
|---|---|
| `POST /api/admin/login` `{username,password}` | 10 attempts / 15 min per IP |
| `POST /api/admin/logout` | |
| `GET /api/admin/state` | `{ mode, products (all), settings }` |
| `POST /api/admin/products`, `PUT /api/admin/products/:slug`, `DELETE …` | Create, update (slug rename allowed), delete |
| `PUT /api/admin/order` `{slugs}` | Catalog order |
| `PUT /api/admin/settings` | Whole settings object (cleaned server-side) |
| `POST /api/admin/upload?name=` | Raw file body (image or PDF, ≤ 8 MB) → `{url}` |
| `GET /api/admin/bookings`, `PUT /api/admin/bookings/:ref` `{status}` | |
| `POST /api/admin/indexnow` | Submits all public URLs |
