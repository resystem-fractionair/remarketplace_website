# SEO & AI discovery

| What | Where |
|---|---|
| Title, description, keywords, canonical, robots | Injected server-side by `page()` in `server/app.js` for `/` and every product |
| Open Graph + Twitter card | Same; product pages use the product card image, home uses `seo.ogImage` or `/img/og.png` |
| JSON-LD | Home: Organization, WebSite, ItemList, FAQPage. Product: Organization, SoftwareApplication (+Offer), BreadcrumbList |
| Sitemap | `/sitemap.xml` with image entries, built from public products |
| Robots | `/robots.txt`: everyone allowed; explicit allow for GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended, Bingbot, CCBot, Meta-ExternalAgent, Amazonbot, DuckAssistBot, MistralAI-User, cohere-ai; `/admin` blocked |
| AI summaries | `/llms.txt` (overview + product links + FAQ) and `/llms-full.txt` (with features, use cases, links) |
| Icons | `/favicon.ico`, `/img/favicon.png`, `/img/apple-touch-icon.png`, `/img/icon-192.png`, `/img/icon-512.png`, `/site.webmanifest` |
| Verification | Admin → Site content → SEO → Google / Bing verification codes (rendered as meta tags) |
| IndexNow | Key at `/<key>.txt`; Admin → QR & SEO → Submit all pages now; auto-ping on product save |

Everything is generated from admin data, so new or renamed products appear in all of the above automatically.
