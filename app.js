/* reMarketplace — Express app (shared by local server.js and Vercel api/index.js) */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieSession = require('cookie-session');
const QRCode = require('qrcode');

const store = require('./store');
const SITE_URL = (process.env.SITE_URL || 'https://remarketplace.store').replace(/\/$/, '');
const PUB = path.join(__dirname, 'public');

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
const visible = async () => (await store.load()).products.filter(p => p.visible);
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

/* ---------- reID sign-in (OAuth 2.0 / OIDC authorization-code + PKCE) ---------- */
const R = {
  id: process.env.REID_CLIENT_ID,
  secret: process.env.REID_CLIENT_SECRET,
  auth: process.env.REID_AUTH_URL,
  token: process.env.REID_TOKEN_URL,
  info: process.env.REID_USERINFO_URL,
  scope: process.env.REID_SCOPE || 'openid profile email'
};
const reidReady = () => R.id && R.auth && R.token && R.info;
const b64url = buf => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const back = (res, q) => res.redirect('/?' + q);

app.get('/api/auth/reid/start', (req, res) => {
  if (!reidReady()) return back(res, 'reidError=not_configured');
  const state = b64url(crypto.randomBytes(16));
  const verifier = b64url(crypto.randomBytes(32));
  req.session.oauth = { state, verifier, ret: String(req.query.ret || '/').startsWith('/') ? String(req.query.ret || '/') : '/' };
  const u = new URL(R.auth);
  u.search = new URLSearchParams({
    response_type: 'code', client_id: R.id, redirect_uri: SITE_URL + '/api/auth/reid/callback', scope: R.scope, state,
    code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256'
  });
  res.redirect(u.toString());
});

app.get('/api/auth/reid/callback', async (req, res) => {
  const o = req.session.oauth;
  req.session.oauth = null;
  if (req.query.error) return back(res, 'reidError=access_denied');
  if (!o || !req.query.code || req.query.state !== o.state) return back(res, 'reidError=invalid_or_expired_request');
  try {
    const body = new URLSearchParams({ grant_type: 'authorization_code', code: req.query.code, redirect_uri: SITE_URL + '/api/auth/reid/callback', client_id: R.id, code_verifier: o.verifier });
    if (R.secret) body.set('client_secret', R.secret);
    const t = await fetch(R.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body });
    if (!t.ok) throw new Error('token ' + t.status);
    const { access_token } = await t.json();
    const i = await fetch(R.info, { headers: { Authorization: 'Bearer ' + access_token, Accept: 'application/json' } });
    if (!i.ok) throw new Error('userinfo ' + i.status);
    const u = await i.json();
    req.session.user = { id: u.sub || u.id, name: u.name || u.preferred_username || '', email: u.email || '', wallet: u.wallet_address || u.wallet || '' };
    const sep = o.ret.includes('?') ? '&' : '?';
    res.redirect(o.ret + sep + 'signedIn=1');
  } catch (e) {
    console.error('[reid]', e.message);
    back(res, 'reidError=sign_in_failed');
  }
});

app.get('/api/me', (req, res) => res.json({ user: req.session.user || null }));
app.post('/api/auth/logout', (req, res) => { req.session = null; res.json({ ok: true }); });

/* ---------- Admin console ---------- */
require('./admin')(app, store);

/* ---------- Pages ---------- */
app.get(['/admin', '/admin/'], (_req, res) => res.sendFile(path.join(PUB, 'admin', 'index.html')));
app.use(express.static(PUB, { extensions: ['html'], maxAge: 0, setHeaders: res => res.set('Cache-Control', 'no-cache') }));
app.get('/product/:slug', wrap(async (req, res, next) => (await bySlug(req.params.slug)) ? res.sendFile(path.join(PUB, 'product.html')) : next()));
app.get('/sitemap.xml', wrap(async (_req, res) => {
  const urls = ['/', ...(await visible()).map(p => '/product/' + p.slug)];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${SITE_URL}${u}</loc></url>`).join('')}</urlset>`);
}));
app.use((_req, res) => res.status(404).sendFile(path.join(PUB, '404.html')));
app.use((err, req, res, _next) => {
  console.error('[error]', err.message);
  const status = err.status || 500;
  if (req.path.startsWith('/api/')) return res.status(status).json({ error: status === 500 ? 'server_error' : err.message });
  res.status(status).send('Something went wrong.');
});

module.exports = app;
