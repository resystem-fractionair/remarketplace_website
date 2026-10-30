/* Admin API — password login (ADMIN_PASSWORD), product CRUD, ordering, homepage rows, categories, uploads. */
const crypto = require('crypto');
const express = require('express');

module.exports = function (app, store) {
  const USER = (process.env.ADMIN_USER || 'admin').trim().toLowerCase();
  const PASS = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'admin');
  if (!process.env.ADMIN_PASSWORD) console.warn('[admin] ADMIN_PASSWORD not set' + (PASS ? ' — using dev password "admin"' : ' — admin login disabled'));
  const hash = s => crypto.createHash('sha256').update(String(s)).digest();
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const attempts = new Map();

  app.post('/api/admin/login', (req, res) => {
    const ip = req.ip, a = attempts.get(ip) || { n: 0, t: Date.now() };
    if (Date.now() - a.t > 15 * 60e3) { a.n = 0; a.t = Date.now(); }
    if (a.n >= 10) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    const b = req.body || {};
    const ok = PASS && crypto.timingSafeEqual(hash(String(b.username || '').trim().toLowerCase()), hash(USER)) & crypto.timingSafeEqual(hash(b.password), hash(PASS));
    if (!ok) { a.n++; attempts.set(ip, a); return res.status(401).json({ error: PASS ? 'Wrong username or password' : 'Admin is not configured (set ADMIN_USER and ADMIN_PASSWORD)' }); }
    attempts.delete(ip);
    req.session.admin = true;
    res.json({ ok: true });
  });
  app.post('/api/admin/logout', (req, res) => { req.session.admin = false; res.json({ ok: true }); });

  const guard = (req, res, next) => req.session && req.session.admin ? next() : res.status(401).json({ error: 'unauthorised' });
  app.use('/api/admin', guard);

  app.get('/api/admin/state', wrap(async (_req, res) => {
    const { products, settings } = await store.load();
    res.json({ mode: store.MODE, products, settings });
  }));
  /* every product change pings IndexNow in production so search engines re-crawl it */
  const ping = () => { if (process.env.NODE_ENV === 'production' || process.env.VERCEL) app.locals.indexNow && app.locals.indexNow().catch(() => {}); };
  app.post('/api/admin/products', wrap(async (req, res) => { const p = await store.saveProduct(req.body || {}, null); ping(); res.json(p); }));
  app.put('/api/admin/products/:slug', wrap(async (req, res) => { const p = await store.saveProduct(req.body || {}, req.params.slug); ping(); res.json(p); }));
  app.delete('/api/admin/products/:slug', wrap(async (req, res) => { await store.deleteProduct(req.params.slug); res.json({ ok: true }); }));
  app.put('/api/admin/order', wrap(async (req, res) => { await store.reorder((req.body && req.body.slugs) || []); res.json({ ok: true }); }));
  app.get('/api/admin/bookings', wrap(async (_req, res) => res.json(await store.listBookings(500))));
  app.put('/api/admin/bookings/:ref', wrap(async (req, res) => { await store.setBookingStatus(req.params.ref, req.body && req.body.status); res.json({ ok: true }); }));
  app.post('/api/admin/indexnow', wrap(async (_req, res) => res.json(await app.locals.indexNow())));
  app.put('/api/admin/settings', wrap(async (req, res) => res.json(await store.saveSettings(req.body || {}))));
  app.post('/api/admin/upload', express.raw({ type: () => true, limit: '8mb' }), wrap(async (req, res) => {
    if (!req.body || !req.body.length) return res.status(400).json({ error: 'Empty file' });
    res.json({ url: await store.upload(req.body, String(req.headers['content-type'] || '').split(';')[0], req.query.name) });
  }));
};
