/* reMarketplace — Express app (shared by local server.js and Vercel api/index.js) */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieSession = require('cookie-session');
const QRCode = require('qrcode');

const store = require('./store');
const SITE_URL = (process.env.SITE_URL || 'https://remarketplace.store').replace(/\/$/, '');
const PUB = path.join(__dirname, '..', 'public');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '300kb' }));
app.use(cookieSession({
  name: 'rm_sess',
  keys: [process.env.SESSION_SECRET || 'dev-only-change-me'],
  maxAge: 7 * 24 * 3600 * 1000,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production'
}));

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
/* visible = switched on AND inside its optional schedule window (showFrom / showUntil, YYYY-MM-DD, Dubai date) */
const today = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const live = p => p.visible && (!p.showFrom || p.showFrom <= today()) && (!p.showUntil || p.showUntil >= today());
const visible = async () => (await store.load()).products.filter(live);
const bySlug = async s => (await visible()).find(p => p.slug === s);

/* ---------- Public data API ---------- */
app.get('/api/site', wrap(async (_req, res) => { const { settings } = await store.load(); res.json({ siteUrl: SITE_URL, qr: settings.qr }); }));
app.get('/api/products', wrap(async (_req, res) => res.json(await visible())));
app.get('/api/products/:slug', wrap(async (req, res) => {
  const p = await bySlug(req.params.slug);
  p ? res.json(p) : res.status(404).json({ error: 'not_found' });
}));
app.get('/api/home', wrap(async (_req, res) => {
  const { settings } = await store.load();
  const list = await visible();
  const map = new Map(list.map(p => [p.slug, p]));
  const used = new Set(list.map(p => p.category));
  res.json({
    showCatalog: settings.showCatalog,
    content: settings.content,
    home: settings.home,
    categories: settings.categories.filter(c => used.has(c)).concat([...used].filter(c => c && !settings.categories.includes(c))),
    rows: settings.rows.map(r => ({ id: r.id, title: r.title, subtitle: r.subtitle, products: r.slugs.map(s => map.get(s)).filter(Boolean) })).filter(r => r.products.length),
    products: list
  });
}));

/* ---------- QR codes: /qr/home.svg, /qr/<slug>.svg|.png ---------- */
app.get('/qr/:name.:ext(svg|png)', wrap(async (req, res) => {
  const { name, ext } = req.params;
  if (name !== 'home' && !(await bySlug(name))) return res.status(404).end();
  const { settings } = await store.load();
  const url = name === 'home' ? (settings.qr.mainUrl || SITE_URL + '/') : `${SITE_URL}/product/${name}`;
  const opts = { margin: 1, errorCorrectionLevel: 'M', color: { dark: '#141317', light: '#FFFFFF' } };
  res.set('Cache-Control', 'no-cache');
  if (req.query.dl) res.attachment(`${name === 'home' ? 'remarketplace' : name}-qr.${ext}`);
  if (ext === 'svg') {
    res.type('image/svg+xml').send(await QRCode.toString(url, Object.assign({ type: 'svg' }, opts)));
  } else {
    res.type('image/png').send(await QRCode.toBuffer(url, Object.assign({ width: 640 }, opts)));
  }
}));

/* ---------- Demo bookings ---------- */
const { sendBookingEmails, zonedToUtc } = require('./mailer');
app.get('/api/booking/config', wrap(async (_req, res) => {
  const { settings } = await store.load();
  const b = settings.booking;
  res.json({ timezone: b.timezone, durationMin: b.durationMin, daysAhead: b.daysAhead, minNoticeHours: b.minNoticeHours,
    workDays: b.workDays, slots: b.slots, languages: b.languages, specialists: b.specialists.filter(s => s.active).map(s => ({ id: s.id, name: s.name, title: s.title, photo: s.photo, bio: s.bio, langs: s.langs, products: s.products, days: s.days, start: s.start, end: s.end })) });
}));
app.get('/api/booking/availability', wrap(async (req, res) => {
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'bad_date' });
  res.json({ taken: await store.takenSlots(date) });
}));
const BOOK_LIMIT = new Map();
app.post('/api/bookings', wrap(async (req, res) => {
  const ip = req.ip, now = Date.now(), hits = (BOOK_LIMIT.get(ip) || []).filter(t => now - t < 3600e3);
  if (hits.length >= 8) return res.status(429).json({ error: 'Too many bookings from this connection. Please email info@remarketplace.store.' });
  const { settings, products } = await store.load();
  const cfg = settings.booking, b = req.body || {};
  const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const picked = (Array.isArray(b.products) ? b.products : []).map(String);
  const prods = products.filter(p => p.visible && picked.includes(p.slug)).map(p => ({ slug: p.slug, name: p.name, category: p.category, tagline: p.tagline, image: p.image }));
  const sp = cfg.specialists.find(x => x.id === b.specialist);
  const date = str(b.date, 10), time = str(b.time, 5);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(date) && cfg.slots.includes(time) ? zonedToUtc(date, time, cfg.timezone) : null;
  const dow = start ? new Date(date + 'T12:00:00Z').getUTCDay() : -1;
  const errs = [];
  if (!prods.length) errs.push('Pick at least one product.');
  if (!start || !cfg.workDays.includes(dow)) errs.push('Pick an available date and time.');
  else if (start.getTime() < now + cfg.minNoticeHours * 3600e3 || start.getTime() > now + (cfg.daysAhead + 1) * 864e5) errs.push('That time is outside the booking window.');
  if (!cfg.languages.includes(b.lang)) errs.push('Pick a call language.');
  const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  if (!sp || !sp.active || !sp.langs.includes(b.lang)) errs.push('Pick a specialist who speaks that language.');
  else if (!sp.days.includes(dow) || toMin(time) < toMin(sp.start) || toMin(time) + cfg.durationMin > toMin(sp.end)) errs.push(`${sp.name} isn't available at that time. Please pick another slot or specialist.`);
  if (str(b.name, 100).length < 2) errs.push('Enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(str(b.email, 160))) errs.push('Enter a valid work email.');
  if (str(b.company, 120).length < 2) errs.push('Enter your company.');
  if (!b.consent) errs.push('Please accept to be contacted about this booking.');
  if (errs.length) return res.status(400).json({ error: errs[0], errors: errs });
  const ref = 'RMK-' + date.replace(/-/g, '').slice(2) + '-' + require('crypto').randomBytes(2).toString('hex').toUpperCase();
  const booking = { ref, slotKey: `${sp.id}|${date}|${time}`, date, time, timezone: cfg.timezone, durationMin: cfg.durationMin,
    products: prods, lang: b.lang, specialist: { id: sp.id, name: sp.name, role: sp.title, photo: sp.photo },
    name: str(b.name, 100), email: str(b.email, 160), company: str(b.company, 120), phone: str(b.phone, 40), role: str(b.role, 80), notes: str(b.notes, 1500),
    visitorTz: str(b.visitorTz, 60), user: req.session.user || null, receivedAt: new Date().toISOString() };
  await store.addBooking(booking);
  hits.push(now); BOOK_LIMIT.set(ip, hits);
  let mail = { sent: false };
  try { mail = await sendBookingEmails(booking, cfg); } catch (e) { console.error('[mail]', e.message); }
  if (process.env.BOOKING_WEBHOOK_URL) fetch(process.env.BOOKING_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(booking) }).catch(() => {});
  res.json({ ok: true, ref, emailed: mail.sent, start: zonedToUtc(date, time, cfg.timezone).toISOString(), end: new Date(zonedToUtc(date, time, cfg.timezone).getTime() + cfg.durationMin * 60000).toISOString() });
}));

/* ---------- reID Connect: sign-in, QR sign-in and purchases (server/reid.js) ---------- */
require('./reid')(app, { SITE_URL, store, wrap });

/* ---------- Admin console ---------- */
require('./admin')(app, store);

/* ---------- Pages ---------- */
app.get(['/admin', '/admin/'], (_req, res) => res.sendFile(path.join(PUB, 'admin', 'index.html')));

/* ---------- Server-rendered SEO (title, description, canonical, Open Graph, Twitter, JSON-LD) ---------- */
const fs = require('fs');
const TPL = {};
const tpl = f => TPL[f] || (TPL[f] = fs.readFileSync(path.join(PUB, f), 'utf8'));
const ea = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const abs = u => !u ? '' : /^https?:/.test(u) ? u : SITE_URL + (u.startsWith('/') ? u : '/' + u);
/* ---------- Share images (Open Graph) ----------
   WhatsApp, LinkedIn, X, Facebook and Telegram drop images that are large (WhatsApp ~600 KB) or the wrong shape.
   /og/<slug>.jpg and /og/home.jpg serve the chosen image resized to 1200×630 JPEG (~100–200 KB), cached at the edge. */
const sharp = (() => { try { return require('sharp'); } catch (_) { return null; } })();
const ogSrc = (p, c) => (p ? p.ogImage || p.image || p.hero : '') || c.seo.ogImage || '/img/og.png';
const ogUrl = (key, src) => `${SITE_URL}/og/${key}.jpg?v=${crypto.createHash('sha1').update(String(src)).digest('hex').slice(0, 8)}`;
async function readImage(src) {
  if (/^https?:/.test(src) && !src.startsWith(SITE_URL)) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 8000);
    try { const r = await fetch(src, { signal: ac.signal }); if (!r.ok) throw new Error('image ' + r.status); return Buffer.from(await r.arrayBuffer()); } finally { clearTimeout(t); }
  }
  const rel = src.replace(SITE_URL, '').split('?')[0];
  const f = path.join(PUB, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!f.startsWith(PUB)) throw new Error('bad path');
  return fs.readFileSync(f);
}
app.get('/og/:key', wrap(async (req, res, next) => {
  const key = String(req.params.key).replace(/\.jpg$/, '');
  const { settings } = await store.load(), c = settings.content;
  let src;
  if (key === 'home') src = ogSrc(null, c); else { const p = await bySlug(key); if (!p) return next(); src = ogSrc(p, c); }
  if (!sharp) return res.redirect(302, abs(src));
  let out;
  try { out = await sharp(await readImage(src)).rotate().resize(1200, 630, { fit: 'cover', position: 'centre' }).flatten({ background: '#141317' }).jpeg({ quality: 80, mozjpeg: true }).toBuffer(); }
  catch (e) { console.error('[og]', key, e.message); out = await sharp(fs.readFileSync(path.join(PUB, 'img/og.png'))).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 80, mozjpeg: true }).toBuffer(); }
  res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400' }).send(out);
}));

function page(file, m) {
  const ld = m.jsonld.map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');
  const head = `<title>${ea(m.title)}</title>
<meta name="description" content="${ea(m.description)}">
${m.keywords ? `<meta name="keywords" content="${ea(m.keywords)}">` : ''}
<link rel="canonical" href="${ea(m.url)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website"><meta property="og:site_name" content="${ea(m.siteName)}">
<meta property="og:title" content="${ea(m.title)}"><meta property="og:description" content="${ea(m.description)}">
<meta property="og:url" content="${ea(m.url)}"><meta property="og:image" content="${ea(m.image)}"><meta property="og:image:secure_url" content="${ea(m.image)}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${ea(m.title)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${ea(m.title)}"><meta name="twitter:description" content="${ea(m.description)}"><meta name="twitter:image" content="${ea(m.image)}">${m.twitter ? `<meta name="twitter:site" content="${ea(m.twitter)}">` : ''}
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" href="/img/favicon.png"><link rel="apple-touch-icon" href="/img/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">
<link rel="alternate" type="text/plain" title="LLM summary" href="/llms.txt">
${m.googleVerify ? `<meta name="google-site-verification" content="${ea(m.googleVerify)}">` : ''}${m.bingVerify ? `<meta name="msvalidate.01" content="${ea(m.bingVerify)}">` : ''}
${ld}`;
  return tpl(file)
    .replace(/<title>[\s\S]*?<\/title>/, '').replace(/<meta name="description"[^>]*>/, '').replace(/<meta property="og:[^>]*>/g, '')
    .replace(/<link rel="icon"[^>]*>/, '').replace('</head>', head + '\n</head>');
}
const org = c => ({ '@context': 'https://schema.org', '@type': 'Organization', name: c.seo.siteName, url: SITE_URL, logo: SITE_URL + '/img/icon-512.png', email: c.footer.email,
  parentOrganization: { '@type': 'Organization', name: 'ReSystem', url: 'https://resystem.org' }, sameAs: [c.footer.linkedin, c.footer.x].filter(Boolean),
  address: { '@type': 'PostalAddress', addressLocality: 'Dubai', addressCountry: 'AE' } });
app.get(['/', '/index.html'], wrap(async (_req, res) => {
  const { settings } = await store.load(); const c = settings.content; const list = await visible();
  res.set('Cache-Control', 'no-cache').type('html').send(page('index.html', {
    googleVerify: c.seo.googleVerify, bingVerify: c.seo.bingVerify,
    title: c.seo.title, description: c.seo.description, keywords: c.seo.keywords, url: SITE_URL + '/', siteName: c.seo.siteName, twitter: c.seo.twitter,
    image: ogUrl('home', ogSrc(null, c)),
    jsonld: [org(c), { '@context': 'https://schema.org', '@type': 'WebSite', name: c.seo.siteName, url: SITE_URL + '/', description: c.seo.description },
      { '@context': 'https://schema.org', '@type': 'ItemList', name: 'reMarketplace products', itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/product/${p.slug}`, name: p.name })) },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: c.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }]
  }));
}));
// Share/search descriptions: cut to ~160 characters on a word boundary
const clip = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '').replace(/[,;:.\s]+$/, '') + '…'; };
app.get('/product/:slug', wrap(async (req, res, next) => {
  const p = await bySlug(req.params.slug); if (!p) return next();
  const { settings } = await store.load(); const c = settings.content, url = `${SITE_URL}/product/${p.slug}`;
  res.set('Cache-Control', 'no-cache').type('html').send(page('product.html', {
    title: p.seoTitle || `${p.name} — ${p.tagline || p.category} | ${c.seo.siteName}`, description: clip(p.seoDescription || p.summary || p.tagline || c.seo.description, 160),
    keywords: [p.name, p.category, p.group, 'white label', ...(p.useCases || [])].filter(Boolean).join(', '), url, siteName: c.seo.siteName, twitter: c.seo.twitter, type: 'product',
    image: ogUrl(p.slug, ogSrc(p, c)),
    jsonld: [org(c), { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: p.name, url, description: p.summary || p.tagline, applicationCategory: 'BusinessApplication',
      applicationSubCategory: p.category, operatingSystem: 'Web', image: abs(p.image || p.hero) || undefined, featureList: (p.features || []).join(', ') || undefined,
      brand: { '@type': 'Brand', name: c.seo.siteName }, publisher: { '@type': 'Organization', name: c.seo.siteName, url: SITE_URL },
      offers: { '@type': 'Offer', availability: /soon/i.test(p.status) ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock', price: '0', priceCurrency: 'USD', description: p.price || 'Pricing on request', url } },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: c.seo.siteName, item: SITE_URL + '/' }, { '@type': 'ListItem', position: 2, name: 'Products', item: SITE_URL + '/#catalog' }, { '@type': 'ListItem', position: 3, name: p.name, item: url }] }]
  }));
}));

/* ---------- IndexNow (Bing, Yandex, Seznam, Naver …): instant URL submission ---------- */
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || crypto.createHash('sha256').update('remarketplace-indexnow:' + SITE_URL).digest('hex').slice(0, 32);
app.get(`/${INDEXNOW_KEY}.txt`, (_req, res) => res.type('text/plain').send(INDEXNOW_KEY));
app.locals.indexNow = async () => {
  const urls = [SITE_URL + '/', SITE_URL + '/llms.txt', ...(await visible()).map(p => `${SITE_URL}/product/${p.slug}`)];
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: new URL(SITE_URL).host, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`, urlList: urls }) });
    return { ok: r.status === 200 || r.status === 202, status: r.status, count: urls.length };
  } catch (e) { return { ok: false, status: e.message, count: 0 }; }
};

/* ---------- Crawlers & AI agents ---------- */
const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot', 'CCBot', 'Meta-ExternalAgent', 'Amazonbot', 'DuckAssistBot', 'MistralAI-User', 'cohere-ai'];
app.get('/robots.txt', (_req, res) => res.type('text/plain').send(
  `# reMarketplace — search engines and AI assistants are welcome\nUser-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin\n\n` +
  AI_BOTS.map(b => `User-agent: ${b}\nAllow: /\nDisallow: /admin\n`).join('\n') + `\nSitemap: ${SITE_URL}/sitemap.xml\n# LLM-friendly summary: ${SITE_URL}/llms.txt\n`));
const llms = async full => {
  const { settings } = await store.load(); const c = settings.content; const list = await visible();
  const lines = [`# ${c.seo.siteName}`, '', `> ${c.seo.description}`, '',
    `${c.seo.siteName} (${SITE_URL}) is the white-label product marketplace of the ReSystem ecosystem, operated by ${c.footer.company}. Businesses license pre-built "master label" products and launch them under their own brand as "white labels".`, '',
    `- ${c.glossary.masterTitle}: ${c.glossary.master}`, `- ${c.glossary.whiteTitle}: ${c.glossary.white}`, `- Contact: ${c.footer.email}`, `- Book a demo: ${SITE_URL}/#catalog (any "Book a demo" button)`, '',
    '## Products', ''];
  list.forEach(p => {
    lines.push(`- [${p.name}](${SITE_URL}/product/${p.slug}): ${p.tagline || ''}${p.category ? ` — ${p.category}` : ''}${p.status ? ` (${p.status})` : ''}`);
    if (full) {
      if (p.summary) lines.push(`  - Summary: ${p.summary}`);
      if ((p.features || []).length) lines.push(`  - Features: ${p.features.join('; ')}`);
      if ((p.useCases || []).length) lines.push(`  - Use cases: ${p.useCases.join('; ')}`);
      if (p.deploy) lines.push(`  - Go-live: ${p.deploy}`);
      if (p.externalUrl) lines.push(`  - Live site: ${p.externalUrl}`);
      if (p.investUrl) lines.push(`  - Investment opportunity: ${p.investUrl}`);
    }
  });
  lines.push('', '## FAQ', '', ...c.faq.map(f => `- **${f.q}** ${f.a}`));
  if (!full) lines.push('', '## Optional', '', `- [Full product details](${SITE_URL}/llms-full.txt)`, `- [Sitemap](${SITE_URL}/sitemap.xml)`);
  return lines.join('\n') + '\n';
};
app.get('/llms.txt', wrap(async (_req, res) => res.type('text/plain; charset=utf-8').send(await llms(false))));
app.get('/llms-full.txt', wrap(async (_req, res) => res.type('text/plain; charset=utf-8').send(await llms(true))));
app.get('/site.webmanifest', wrap(async (_req, res) => { const { settings } = await store.load();
  res.type('application/manifest+json').send(JSON.stringify({ name: settings.content.seo.siteName, short_name: settings.content.seo.siteName, start_url: '/', display: 'standalone', background_color: '#F4F3F0', theme_color: '#F7541D',
    icons: [{ src: '/img/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/img/icon-512.png', sizes: '512x512', type: 'image/png' }] })); }));
app.get('/api/content', wrap(async (_req, res) => { const { settings } = await store.load(); res.json(settings.content); }));

app.use(express.static(PUB, { extensions: ['html'], maxAge: 0, index: false, setHeaders: res => res.set('Cache-Control', 'no-cache') }));
app.get('/sitemap.xml', wrap(async (_req, res) => {
  const list = await visible(); const d = new Date().toISOString().slice(0, 10);
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">` +
    `<url><loc>${SITE_URL}/</loc><lastmod>${d}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>` +
    list.map(p => `<url><loc>${SITE_URL}/product/${p.slug}</loc><lastmod>${d}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority>${p.image ? `<image:image><image:loc>${ea(abs(p.image))}</image:loc><image:title>${ea(p.name)}</image:title></image:image>` : ''}</url>`).join('') + '</urlset>');
}));
app.use((_req, res) => res.status(404).sendFile(path.join(PUB, '404.html')));
app.use((err, req, res, _next) => {
  console.error('[error]', err.message);
  const status = err.status || 500;
  if (req.path.startsWith('/api/')) return res.status(status).json({ error: status === 500 ? 'server_error' : err.message });
  res.status(status).send('Something went wrong.');
});

module.exports = app;
