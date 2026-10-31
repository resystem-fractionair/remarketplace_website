# Deployment & go-live

## 1. Supabase (done)
Project **Re-system-org's Project** (`plqxwrvktriaclifwurc`). Tables `rm_products`, `rm_settings`, `rm_bookings` and bucket `rm-images` exist. To recreate elsewhere run `supabase/schema.sql` and the bookings table from ARCHITECTURE.md.

## 2. Vercel
Project `remarketplace_website` (team re-system) is linked to `resystem-fractionair/remarketplace_website` and deploys `main` automatically.

Set in **Settings → Environment Variables** (Production), then **Redeploy**:
`SITE_URL`, `SESSION_SECRET`, `ADMIN_USER`, `ADMIN_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` `REID_CLIENT_ID`, `REID_CLIENT_SECRET`, `REID_REDIRECT_URI`, `REID_BASE_URL`, `REID_APP_URL`, `APP_PUBLIC_URL` (see REID.md).

## 3. Domain
Vercel → Settings → Domains → add `remarketplace.store` and `www.remarketplace.store`, then set the DNS records Vercel shows at the registrar. Keep `SITE_URL=https://remarketplace.store`.

## 4. Search engines
1. Google Search Console → add property `https://remarketplace.store` → HTML-tag method → paste the code in Admin → Site content → SEO → Google verification → Save → Verify → submit `https://remarketplace.store/sitemap.xml`.
2. Bing Webmaster Tools → import from Google (or HTML tag → Bing verification field) → submit the sitemap.
3. Admin → QR & SEO → **Submit all pages now** (IndexNow).

## 5. Go-live checklist
- [ ] Env vars set and redeployed; `/admin` shows **● Live database**
- [ ] Replace placeholder agents with real people and photos
- [ ] Replace placeholder sandbox credentials / demo URLs with real ones
- [ ] Upload card images for reWALLET, 21 Mine and the coming-soon products
- [ ] Test a booking end to end (both emails arrive, calendar invite opens)
- [ ] Domain live, Search Console + Bing verified, sitemap submitted
- [ ] Rotate the Supabase keys that were shared in chat; update Vercel
