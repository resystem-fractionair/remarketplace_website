/* reID Connect: sign-in (redirect + desktop QR) and user-approved purchases (wallet:tx).
   Uses fpreid-connect-sdk. Secrets come only from env vars and never reach the browser.

   Routes
     GET  /auth/reid/start?ret=/path     redirect sign-in (PKCE). Always starts on SITE_URL's origin.
     GET  /auth/reid/callback            registered redirect_uri (https://remarketplace.store/auth/reid/callback)
     POST /auth/reid/device/start        desktop QR sign-in → { qr, userCode, link, interval, expiresIn }
     POST /auth/reid/device/poll         → { status: pending | approved | denied | expired }
     GET  /api/me                        signed-in user (public profile only) or null
     POST /api/auth/logout
     POST /api/buy/:slug                 create a payment request for a product → { intentId, approvalUrl, qr }
     GET  /api/buy/status/:intentId      → { status: pending | broadcast | denied | failed | expired, txHash? }

   Session: cookie-session (signed). Tokens, PKCE verifier and device_code are AES-256-GCM encrypted
   inside the session, so the browser can neither read nor alter them. */
const crypto = require('crypto');
const QRCode = require('qrcode');
const sdk = require('fpreid-connect-sdk');

const SCOPES = ['profile', 'wallet:read', 'wallet:tx', 'kyc:read']; // all registered for reMARKETPLACE on UAT
const DEFAULT_CHAIN = 15324;                                     // INFRA UAT chain

module.exports = function mountReid(app, { SITE_URL, store, wrap }) {
  const env = k => (process.env[k] || '').trim();
  const PUBLIC_URL = (env('APP_PUBLIC_URL') || SITE_URL).replace(/\/$/, '');
  const config = () => ({
    clientId: env('REID_CLIENT_ID'),
    redirectUri: env('REID_REDIRECT_URI') || PUBLIC_URL + '/auth/reid/callback',
    clientSecret: env('REID_CLIENT_SECRET') || undefined, // empty string would be sent and rejected
    baseUrl: env('REID_BASE_URL') || 'https://uat-wallet.reidentity.net',
    appUrl: env('REID_APP_URL') || 'https://app.reidentity.net'
  });
  const ready = () => !!(env('REID_CLIENT_ID') && env('REID_CLIENT_SECRET'));

  /* ---- encryption of server-only values kept in the session cookie ---- */
  const KEY = crypto.createHash('sha256').update('reid-session:' + (process.env.SESSION_SECRET || 'dev-only-change-me')).digest();
  const seal = obj => { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    const enc = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64url'); };
  const open = s => { try { const b = Buffer.from(String(s), 'base64url'), d = crypto.createDecipheriv('aes-256-gcm', KEY, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28)); return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')); } catch (_) { return null; } };
  const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  const safeRet = r => { r = String(r || '/'); return r.startsWith('/') && !r.startsWith('//') ? r.slice(0, 300) : '/'; };
  const back = (res, ret, q) => res.redirect(PUBLIC_URL + ret + (ret.includes('?') ? '&' : '?') + q);
  const logErr = (where, e) => console.error('[reid]', where, e && e.status || '', e && e.message || e); // never tokens/codes/secret

  /* Sign the user in from a TokenResponse: public profile in session, tokens sealed */
  function signIn(req, t) {
    const p = t.profile || {}, granted = String(t.scope || '').split(/\s+/).filter(Boolean);
    req.session.user = {
      id: t.user_id, name: p.name || p.username || '', username: p.username || '', photo: p.profile_image_url || '',
      email: p.email || '', wallet: (granted.includes('wallet:read') && p.wallet && p.wallet.wallet_address) || '',
      kyc: p.kyc_status || '', scope: granted
    };
    req.session.rt = seal({ a: t.access_token, r: t.refresh_token, e: Date.now() + (Number(t.expires_in) || 86400) * 1000 });
  }
  /* A valid access token for the signed-in user, refreshing when close to expiry */
  async function accessToken(req) {
    const t = req.session.rt && open(req.session.rt); if (!t) return null;
    if (t.e - Date.now() > 5 * 60000) return t.a;
    try { const n = await sdk.refreshAccessToken(config(), { refreshToken: t.r }); signIn(req, n); return n.access_token; }
    catch (e) { logErr('refresh', e); req.session.user = null; req.session.rt = null; return null; }
  }

  /* ---------- Redirect sign-in ---------- */
  app.get(['/auth/reid/start', '/api/auth/reid/start'], wrap(async (req, res) => {
    const ret = safeRet(req.query.ret);
    // PKCE values live in the session cookie, which is tied to the host: start on the redirect URI's origin.
    const host = new URL(PUBLIC_URL).host;
    if (req.get('host') !== host && process.env.NODE_ENV === 'production') return res.redirect(PUBLIC_URL + '/auth/reid/start?ret=' + encodeURIComponent(ret));
    if (!ready()) return back(res, ret, 'reidError=not_configured');
    const { verifier, challenge } = await sdk.generatePkcePair();
    const state = await sdk.generateState();
    req.session.oa = seal({ v: verifier, s: state, ret, t: Date.now() });
    res.redirect(sdk.buildAuthorizeUrl(config(), { codeChallenge: challenge, state, scope: SCOPES }));
  }));

  app.get(['/auth/reid/callback', '/api/auth/reid/callback'], wrap(async (req, res) => {
    const o = req.session.oa && open(req.session.oa); req.session.oa = null;
    const ret = o ? o.ret : '/';
    if (req.query.error) return back(res, ret, 'reidError=' + (req.query.error === 'access_denied' ? 'access_denied' : 'reid_error'));
    const { code, state } = req.query;
    if (!o || !code || !state || Date.now() - o.t > 10 * 60000 || !same(state, o.s)) return back(res, ret, 'reidError=invalid_or_expired_request');
    try { signIn(req, await sdk.exchangeCodeForToken(config(), { code: String(code), codeVerifier: o.v })); back(res, ret, 'signedIn=1'); }
    catch (e) { logErr('exchange', e); back(res, ret, 'reidError=sign_in_failed'); }
  }));

  /* ---------- Desktop QR sign-in (device authorization) ---------- */
  app.post('/auth/reid/device/start', wrap(async (req, res) => {
    if (!ready()) return res.status(503).json({ error: 'not_configured' });
    try {
      const a = await sdk.startDeviceAuthorization(config(), { scope: SCOPES });
      req.session.dv = seal({ d: a.device_code, x: Date.now() + a.expires_in * 1000 });
      res.json({ qr: await QRCode.toString(a.verification_uri_complete, { type: 'svg', margin: 1 }), link: a.verification_uri_complete,
        userCode: a.user_code, interval: Math.max(3, a.interval || 5), expiresIn: a.expires_in });
    } catch (e) { logErr('device start', e); res.status(502).json({ error: 'reid_error' }); }
  }));
  app.post('/auth/reid/device/poll', wrap(async (req, res) => {
    const d = req.session.dv && open(req.session.dv);
    if (!d || Date.now() > d.x) { req.session.dv = null; return res.json({ status: 'expired' }); }
    try {
      const r = await sdk.checkDeviceAuthorization(config(), d.d);
      if (r.status === 'approved') { req.session.dv = null; signIn(req, r.tokens); return res.json({ status: 'approved', user: req.session.user }); }
      if (r.status !== 'pending') req.session.dv = null;
      res.json({ status: r.status, slowDown: !!r.slowDown });
    } catch (e) { logErr('device poll', e); res.status(502).json({ status: 'error' }); }
  }));

  app.get('/api/me', (req, res) => { const u = req.session.user; res.json({ user: u ? { name: u.name, username: u.username, photo: u.photo, wallet: u.wallet, kyc: u.kyc } : null, reid: ready() }); });
  app.post('/api/auth/logout', (req, res) => { req.session = null; res.json({ ok: true }); });

  /* ---------- Purchases (wallet:tx). Only for products with buying switched on in the admin. ---------- */
  const toUnits = (amount, decimals) => { // "12.5", 18 -> "12500000000000000000" without float errors
    const m = String(amount).trim().match(/^(\d+)(?:\.(\d+))?$/); if (!m) return null;
    const frac = (m[2] || '').slice(0, decimals).padEnd(decimals, '0');
    return (BigInt(m[1]) * 10n ** BigInt(decimals) + BigInt(frac || '0')).toString();
  };
  const isAddr = a => /^0x[0-9a-fA-F]{40}$/.test(a || '');
  const erc20Transfer = (to, units) => '0xa9059cbb' + to.slice(2).toLowerCase().padStart(64, '0') + BigInt(units).toString(16).padStart(64, '0');

  app.post('/api/buy/:slug', wrap(async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'sign_in_required' });
    const p = (await store.load()).products.find(x => x.slug === req.params.slug && x.visible);
    const b = p && p.buy;
    if (!b || !b.enabled) return res.status(404).json({ error: 'not_for_sale' });
    if (!(req.session.user.scope || []).includes('wallet:tx')) return res.status(403).json({ error: 'wallet_tx_not_granted' });
    const decimals = Number.isInteger(b.decimals) ? b.decimals : 18, units = toUnits(b.amount, decimals);
    if (!units || units === '0' || !isAddr(b.payTo) || (b.token && !isAddr(b.token))) return res.status(500).json({ error: 'product_payment_not_configured' });
    const at = await accessToken(req); if (!at) return res.status(401).json({ error: 'sign_in_required' });
    const label = b.label || `${b.amount} ${b.symbol || ''}`.trim();
    try {
      const intent = await sdk.createTxIntent(config(), at, {
        chainId: Number(b.chainId) || DEFAULT_CHAIN,
        to: b.token ? b.token : b.payTo, valueWei: b.token ? '0' : units, data: b.token ? erc20Transfer(b.payTo, units) : undefined,
        summary: { title: ('Buy ' + p.name).slice(0, 80), lines: [{ label: 'Price', value: label }, { label: 'Seller', value: 'reMARKETPLACE' }] } // built server-side only
      });
      const approvalUrl = sdk.buildApprovalUrl(config(), intent.intent_id);
      const order = { ref: 'ORD-' + crypto.randomBytes(4).toString('hex').toUpperCase(), intentId: intent.intent_id, slug: p.slug, product: p.name, price: label,
        userId: req.session.user.id, userName: req.session.user.name, wallet: req.session.user.wallet, status: 'pending', txHash: '', createdAt: new Date().toISOString() };
      await store.saveOrder(order).catch(e => console.error('[orders] save failed', e.message));
      res.json({ intentId: intent.intent_id, ref: order.ref, approvalUrl, qr: await QRCode.toString(approvalUrl, { type: 'svg', margin: 1 }) });
    } catch (e) { logErr('create intent', e); res.status(502).json({ error: 'reid_error', message: e.message }); }
  }));

  app.get('/api/buy/status/:id', wrap(async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'sign_in_required' });
    const at = await accessToken(req); if (!at) return res.status(401).json({ error: 'sign_in_required' });
    let r;
    try { r = await sdk.getTxIntentStatus(config(), at, String(req.params.id)); }
    catch (e) { if (e && e.status === 404) r = { status: 'expired' }; else { logErr('intent status', e); return res.status(502).json({ status: 'error' }); } }
    if (r.status !== 'pending') await store.updateOrder(String(req.params.id), { status: r.status, txHash: r.tx_hash || '', error: r.error || '' }).catch(() => {});
    res.json({ status: r.status, txHash: r.tx_hash || '', error: r.error || '' });
  }));

  return { ready };
};
