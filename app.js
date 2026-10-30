/* reMarketplace — Express app (shared by local server.js and Vercel api/index.js) */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieSession = require('cookie-session');
const QRCode = require('qrcode');

const PRODUCTS = require('./data/products.json');
const SITE_URL = (process.env.SITE_URL || 'https://remarketplace.store').replace(/\/$/, '');
const PUB = path.join(__dirname, 'public');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));
app.use(cookieSession({
  name: 'rm_sess',
  keys: [process.env.SESSION_SECRET || 'dev-only-change-me'],
  maxAge: 7 * 24 * 3600 * 1000,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production'
}));

const bySlug = s => PRODUCTS.find(p => p.slug === s);

/* ---------- Data API ---------- */
app.get('/api/products', (_req, res) => res.json(PRODUCTS));
app.get('/api/products/:slug', (req, res) => {
  const p = bySlug(req.params.slug);
  p ? res.json(p) : res.status(404).json({ error: 'not_found' });
});

/* ---------- QR codes: /qr/home.svg, /qr/<slug>.svg|.png ---------- */
app.get('/qr/:name.:ext(svg|png)', async (req, res) => {
  const { name, ext } = req.params;
  if (name !== 'home' && !bySlug(name)) return res.status(404).end();
  const url = name === 'home' ? SITE_URL + '/' : `${SITE_URL}/product/${name}`;
  const opts = { margin: 1, errorCorrectionLevel: 'M', color: { dark: '#141317', light: '#FFFFFF' } };
  res.set('Cache-Control', 'public, max-age=86400');
  if (ext === 'svg') {
    res.type('image/svg+xml').send(await QRCode.toString(url, Object.assign({ type: 'svg' }, opts)));
  } else {
    res.type('image/png').send(await QRCode.toBuffer(url, Object.assign({ width: 640 }, opts)));
  }
});

/* ---------- Demo bookings ---------- */
app.post('/api/bookings', async (req, res) => {
  const b = req.body || {};
  const ok = Array.isArray(b.products) && b.products.length && b.date && b.time &&
    typeof b.email === 'string' && /.+@.+\..+/.test(b.email) && b.name && b.company;
  if (!ok) return res.status(400).json({ error: 'invalid_booking' });
  const booking = Object.assign({}, b, { receivedAt: new Date().toISOString(), user: req.session.user || null });
  console.log('[booking]', JSON.stringify(booking));
  if (process.env.BOOKING_WEBHOOK_URL) {
    try {
      await fetch(process.env.BOOKING_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(booking) });
    } catch (e) { console.error('[booking webhook]', e.message); }
  }
  res.json({ ok: true, ref: b.ref });
});

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

/* ---------- Pages ---------- */
app.use(express.static(PUB, { extensions: ['html'], maxAge: '1h' }));
app.get('/product/:slug', (req, res, next) => bySlug(req.params.slug) ? res.sendFile(path.join(PUB, 'product.html')) : next());
app.get('/sitemap.xml', (_req, res) => {
  const urls = ['/', ...PRODUCTS.map(p => '/product/' + p.slug)];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${SITE_URL}${u}</loc></url>`).join('')}</urlset>`);
});
app.use((_req, res) => res.status(404).sendFile(path.join(PUB, '404.html')));

module.exports = app;
