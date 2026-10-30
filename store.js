/* Data store. Supabase (Postgres + Storage) when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set,
   otherwise local JSON files in /data (dev only — Vercel's filesystem is read-only). */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = process.env.SUPABASE_BUCKET || 'rm-images';
const MODE = SB && KEY ? 'supabase' : 'file';
// New sb_secret_ keys go in the apikey header only; legacy JWT service_role keys also go in Authorization.
const AUTH = KEY.startsWith('eyJ') ? { apikey: KEY, Authorization: 'Bearer ' + KEY } : { apikey: KEY };
const DATA = path.join(__dirname, 'data');
const SEED_PRODUCTS = path.join(DATA, 'products.json');
const SEED_SETTINGS = path.join(DATA, 'settings.json');
const UPLOADS = path.join(__dirname, 'public', 'uploads');

const LIST_FIELDS = ['features', 'whyPoints', 'whatYouCanDo', 'useCases', 'stats'];
const TEXT_FIELDS = ['showFrom', 'showUntil', 'seoTitle', 'seoDescription', 'name', 'tagline', 'category', 'group', 'status', 'deploy', 'price', 'summary', 'whatItIs',
  'image', 'hero', 'mobileImage', 'logo', 'externalUrl', 'demoUrl', 'demoEmail', 'demoPassword', 'demoNote', 'investUrl', 'pdfDesktop', 'pdfMobile', 'tone', 'sourceUrl'];

const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/* Whitelist + normalise a product coming from the admin form */
function clean(p) {
  const o = { slug: slugify(p.slug || p.name) };
  TEXT_FIELDS.forEach(k => { o[k] = String(p[k] == null ? '' : p[k]).trim().slice(0, k === 'summary' || k === 'whatItIs' ? 2000 : 500); });
  LIST_FIELDS.forEach(k => { o[k] = (Array.isArray(p[k]) ? p[k] : []).map(x => String(x).trim()).filter(Boolean).slice(0, 30); });
  o.highlights = (Array.isArray(p.highlights) ? p.highlights : [])
    .map(h => ({ title: String(h.title || '').trim(), text: String(h.text || '').trim() })).filter(h => h.title || h.text).slice(0, 20);
  o.demoCreds = (Array.isArray(p.demoCreds) ? p.demoCreds : [])
    .map(c => ({ label: String(c.label || '').trim().slice(0, 60), value: String(c.value || '').trim().slice(0, 300) })).filter(c => c.label && c.value).slice(0, 12);
  if (!o.demoCreds.length) {
    if (o.demoEmail) o.demoCreds.push({ label: 'Test email', value: o.demoEmail });
    if (o.demoPassword) o.demoCreds.push({ label: 'Password', value: o.demoPassword });
  }
  o.demoEmail = ''; o.demoPassword = '';
  o.visible = p.visible !== false;
  o.position = Number.isFinite(+p.position) ? +p.position : 999;
  o.tone = ['a', 'b', 'c', 'd'].includes(o.tone) ? o.tone : 'a';
  return o;
}

const DEFAULT_SETTINGS = () => {
  const products = readJson(SEED_PRODUCTS, []);
  return {
    categories: [...new Set(products.map(p => p.category).filter(Boolean))],
    groups: ['ReSuit', 'ReProduct', 'RePartner'],
    showCatalog: true,
    rows: [
      { id: 'featured', title: 'Featured', subtitle: 'Flagship products of the ReSystem ecosystem', slugs: ['remarketplace', 'infra-reaed', 'reid', 'rewallet'] },
      { id: 'invest', title: 'Invest & own', subtitle: 'Wealth, fractional ownership and real-world assets', slugs: ['reinvest', 'fractionaire', 'cet', 'infra-global'] },
      { id: 'partners', title: 'Partner products', subtitle: 'Live businesses ready to white-label', slugs: ['redomain', 'tunetailor', 'mine', 'prohandover', 'hostick'] }
    ],
    booking: DEFAULT_BOOKING(),
    home: { defaultSlugs: ['remarketplace', 'reid', 'rewallet', 'reinvest', 'fractionaire', 'infra-reaed'], limit: 6 },
    qr: { mainUrl: '' },
    content: DEFAULT_CONTENT()
  };
};
const DEFAULT_CONTENT = () => ({
  seo: { siteName: 'reMarketplace', title: 'reMarketplace — Launch fintech & Web3 products in days', description: 'reMarketplace gives businesses pre-built, white-label fintech, Web3, AI and identity products to customise, rebrand and deploy in days, not months.',
    keywords: 'white label fintech, white label crypto exchange, white label wallet, tokenization platform, RWA marketplace, digital identity, master label, Dubai, UAE', ogImage: '', twitter: '@Reidentity_net' },
  header: { announcement: '', announcementLink: '', cta: 'Book a demo', search: 'Search products',
    links: [{ label: 'Products', href: '/#catalog' }, { label: 'Explainer', href: '/#explainer' }, { label: 'Why us', href: '/#why' }, { label: 'Use cases', href: '/#use-cases' }, { label: 'ReSystem ↗', href: 'https://resystem.org' }] },
  product: { model: 'Master label · White label', credsTitle: 'Sandbox credentials', credsNote: 'Sandbox data resets nightly. No real funds, KYC records, or on-chain transactions are created.',
    credsRequest: 'Login credentials are shared on request — usually within one business day.', investTitle: 'Own a share of', investText: 'On-chain shares on INFRA Network via ReSystem Business Opportunity.',
    investCta: 'View opportunity', brochureTitle: 'Brochure & links', featuredTitle: 'Featured products', bookCta: 'Book a demo', demoCta: 'Try demo' },
  booking: { railTitle: 'Book a demo', railNote: '30-minute walkthrough with a ReSystem specialist in your language.' },
  hero: { eyebrow: 'White-label concept · ReSystem ecosystem', prefix: 'Launch', words: ['fintech', 'identity', 'Web3', 'wallet', 'investment', 'AI'], line2: 'products in days,', accent: 'not months.',
    subtitle: 'Pre-built infrastructure to build, launch and scale fully functional products — simple to customise, rebrand and deploy under your name.',
    cta1: 'Browse products', cta2: 'Book a demo call',
    stats: [{ value: '', suffix: '', label: 'ecosystem products' }, { value: '3', suffix: ' wks', label: 'to a vertical marketplace' }, { value: '99.9', suffix: '%', label: 'uptime · 38ms latency' }, { value: '1200', suffix: '', label: 'TPS on ReSystem backend' }] },
  why: { eyebrow: 'Why reMarketplace', title: 'Everything you need to launch, own and scale.', items: [
    { t: 'Affordable entry', d: 'Own a share of assets that are normally out of reach.' }, { t: 'Fast resale', d: 'Sell or trade in a built-in marketplace — no waiting for buyers.' },
    { t: 'Provable ownership', d: 'Every holding and transfer is recorded on-chain.' }, { t: 'Live in 3 weeks', d: 'White-label a vertical marketplace under your brand.' }] },
  steps: { eyebrow: 'For product builders', title: 'Everyone gets a chance to be listed.', subtitle: 'From idea to a licensed product other businesses can deploy — in six steps.', items: [
    { t: 'Get it built', d: 'The ReSystem team builds your master label.' }, { t: 'List it', d: 'Publish your master label in the pre-built marketplace.' },
    { t: 'Promote it', d: 'Advertise your product to the whole ecosystem.' }, { t: 'Upgrade B2C', d: 'Turn an existing consumer product into a master label.' },
    { t: 'Stay compliant', d: 'Audit-ready with KYC, logs and controls by default.' }, { t: 'Scale globally', d: 'Run on the ReSystem backend from day one.' }] },
  glossary: { masterTitle: 'Master label', master: 'Software or a B2B-licensed product built to be scaled and customised.', arrow: 'rebrand & sub-license',
    whiteTitle: 'White label', white: 'A sub-licensed product created and rebranded from a master label.', qrTitle: 'Scan to explore', qrText: 'Open the catalog on your phone. Every product page has its own QR code too.' },
  catalog: { title: 'All products', note: 'Open any product for full details, its live demo, brochure, QR code and investment opportunity.', viewAll: 'View all products' },
  faq: [
    { q: 'What does “pre-built” actually mean?', a: 'Each product is a running system — backend, admin console, APIs and front-end — already built, tested and deployed. You configure it, apply your brand, connect your data and go live.' },
    { q: 'How long until we are live?', a: 'Between three days and three weeks depending on the product. A white-label vertical marketplace takes about three weeks.' },
    { q: 'Whose brand does the customer see?', a: 'Yours only. Domains, logo, colours, emails and documentation all ship under your brand name.' },
    { q: 'Can we run more than one product together?', a: 'Yes. Products share one identity layer (reID), one ledger on INFRA Network and one admin console, so they behave like a single platform.' },
    { q: 'Can I list my own product?', a: 'Yes. Have the ReSystem team build your master label, or upgrade an existing B2C product into one, and list it here for other businesses to license.' },
    { q: 'Do we get the source code?', a: 'Source access and self-hosting are available on enterprise agreements. Most customers stay on the managed deployment, which includes updates, monitoring and support.' },
    { q: 'Can I invest in a product?', a: 'Several products offer on-chain shares through the ReSystem Business Opportunity programme. Each product page links to its investment opportunity where one exists.' }],
  footer: { colTitle: 'ReSystem', links: [{ label: 'resystem.org', href: 'https://resystem.org' }, { label: 'Ecosystem', href: 'https://resystem.org/ecosystem' }, { label: 'Business opportunity', href: 'https://resystem.org/business-opportunity' }, { label: 'Join reID', href: 'https://resystem.org/id' }],
    tagline: 'Pre-built, white-label products for fintech, Web3, AI and identity. Part of the ReSystem ecosystem.', email: 'info@remarketplace.store',
    linkedin: 'https://www.linkedin.com/company/resystemglobal', x: 'https://x.com/Reidentity_net', company: 'Desert Tech Cloud Services LLC · Dubai, UAE' }
});
/* Merge saved content over defaults, keeping shapes; strings capped, lists limited */
function cleanContent(c) {
  const d = DEFAULT_CONTENT(); c = c && typeof c === 'object' ? c : {};
  const str = (v, df, n) => typeof v === 'string' ? v.trim().slice(0, n || 400) : df;
  const merge = (dv, v) => {
    if (Array.isArray(dv)) {
      if (!Array.isArray(v)) return dv;
      if (typeof dv[0] === 'string') return v.map(x => String(x).trim()).filter(Boolean).slice(0, 20);
      return v.slice(0, 20).map(x => Object.fromEntries(Object.keys(dv[0]).map(k => [k, str(x && x[k], '', 1200)]))).filter(x => Object.values(x).some(Boolean));
    }
    if (dv && typeof dv === 'object') return Object.fromEntries(Object.keys(dv).map(k => [k, merge(dv[k], v && v[k])]));
    return str(v, dv, 1200);
  };
  return merge(d, c);
}
const DEFAULT_BOOKING = () => ({
  notifyEmail: 'info@remarketplace.store',
  timezone: 'Asia/Dubai',
  durationMin: 30,
  daysAhead: 21,
  minNoticeHours: 12,
  workDays: [1, 2, 3, 4, 5],
  slots: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'],
  languages: ['English', 'Arabic', 'Hindi', 'Spanish', 'French', 'Russian'],
  specialists: [
    { id: 'identity-specialist', name: 'Senior Product Specialist', title: 'Identity & Payments', photo: '', bio: 'Walks you through reID sign-in, wallets and the INFRA payment rails.',
      langs: ['English', 'Arabic', 'Hindi'], products: ['reid', 'rewallet', 'infra-reaed', 'infra-global'], days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', active: true },
    { id: 'investment-specialist', name: 'Investment Specialist', title: 'RWA & Investment', photo: '', bio: 'Covers tokenised real-world assets, fractional ownership and private wealth.',
      langs: ['English', 'Arabic', 'Russian'], products: ['fractionaire', 'reinvest', 'cet'], days: [1, 2, 3, 4, 5], start: '10:00', end: '18:00', active: true },
    { id: 'partnerships-specialist', name: 'Partnerships Specialist', title: 'White-label & Partners', photo: '', bio: 'Helps you launch a branded marketplace or list your own master label.',
      langs: ['English', 'Spanish', 'French', 'Hindi'], products: ['remarketplace', 'redomain', 'tunetailor', 'mine', 'prohandover', 'hostick', 'rechain'], days: [0, 1, 2, 3, 4], start: '09:00', end: '17:00', active: true }
  ]
});
function cleanBooking(b) {
  const d = DEFAULT_BOOKING(); b = b || {};
  const strList = (a, n) => (Array.isArray(a) ? a : []).map(x => String(x).trim()).filter(Boolean).slice(0, n || 50);
  const num = (v, lo, hi, df) => Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : df;
  const slots = strList(b.slots, 48).filter(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)).sort();
  const hm = (v, df) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? String(v) : df;
  const sp = (Array.isArray(b.specialists) ? b.specialists : d.specialists).slice(0, 40).map((x, i) => ({
    id: slugify(x.id || x.name) || 'agent-' + (i + 1), name: String(x.name || '').trim().slice(0, 80),
    title: String(x.title || x.role || '').trim().slice(0, 120), photo: String(x.photo || '').trim().slice(0, 500), bio: String(x.bio || '').trim().slice(0, 300),
    langs: strList(x.langs, 12), products: strList(x.products, 40).map(slugify),
    days: [...new Set((Array.isArray(x.days) ? x.days : [1, 2, 3, 4, 5]).map(Number).filter(n => n >= 0 && n <= 6))].sort(),
    start: hm(x.start, '09:00'), end: hm(x.end, '17:00'), active: x.active !== false
  })).filter(x => x.name && x.langs.length);
  const ids = new Set(); sp.forEach(x => { while (ids.has(x.id)) x.id += '-2'; ids.add(x.id); });
  return {
    notifyEmail: /.+@.+\..+/.test(b.notifyEmail || '') ? String(b.notifyEmail).trim() : d.notifyEmail,
    timezone: String(b.timezone || d.timezone),
    durationMin: num(b.durationMin, 15, 120, d.durationMin),
    daysAhead: num(b.daysAhead, 3, 90, d.daysAhead),
    minNoticeHours: num(b.minNoticeHours, 0, 168, d.minNoticeHours),
    workDays: [...new Set((Array.isArray(b.workDays) ? b.workDays : d.workDays).map(Number).filter(n => n >= 0 && n <= 6))].sort(),
    slots: slots.length ? [...new Set(slots)] : d.slots,
    languages: strList(b.languages, 20).length ? [...new Set(strList(b.languages, 20))] : d.languages,
    specialists: sp.length ? sp : d.specialists
  };
}
function cleanSettings(s) {
  const strList = a => (Array.isArray(a) ? a : []).map(x => String(x).trim()).filter(Boolean).slice(0, 50);
  return {
    categories: [...new Set(strList(s.categories))],
    groups: [...new Set(strList(s.groups))],
    showCatalog: s.showCatalog !== false,
    booking: cleanBooking(s.booking),
    home: { defaultSlugs: [...new Set(strList(s.home && s.home.defaultSlugs).map(slugify))].slice(0, 24), limit: Math.min(24, Math.max(1, +(s.home && s.home.limit) || 6)) },
    qr: { mainUrl: /^https?:\/\//.test(String(s.qr && s.qr.mainUrl || '')) ? String(s.qr.mainUrl).trim().slice(0, 300) : '' },
    content: cleanContent(s.content),
    rows: (Array.isArray(s.rows) ? s.rows : []).slice(0, 12).map((r, i) => ({
      id: slugify(r.id || r.title) || 'row-' + (i + 1),
      title: String(r.title || '').trim().slice(0, 80),
      subtitle: String(r.subtitle || '').trim().slice(0, 160),
      slugs: [...new Set(strList(r.slugs).map(slugify))].slice(0, 12)
    }))
  };
}

function readJson(f, dflt) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return dflt; } }
function writeJson(f, v) { fs.writeFileSync(f, JSON.stringify(v, null, 1)); }

/* ---------- Supabase REST helpers ---------- */
async function sb(pathname, opts = {}) {
  const r = await fetch(SB + pathname, Object.assign({}, opts, {
    headers: Object.assign({}, AUTH, { 'Content-Type': 'application/json' }, opts.headers || {})
  }));
  if (!r.ok) throw new Error(`supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const rowToProduct = r => Object.assign({}, r.data, { slug: r.slug, visible: r.visible, position: r.position });
const productToRow = p => {
  const { slug, visible, position } = p;
  const data = Object.assign({}, p); delete data.slug; delete data.visible; delete data.position;
  return { slug, visible, position, data, updated_at: new Date().toISOString() };
};

/* ---------- Cache ---------- */
let cache = null, cacheAt = 0;
const TTL = 30 * 1000;
const bust = () => { cache = null; };

async function load() {
  if (cache && Date.now() - cacheAt < TTL) return cache;
  let products, settings;
  if (MODE === 'supabase') {
    const rows = await sb('/rest/v1/rm_products?select=*&order=position.asc');
    if (!rows.length) {
      const seed = readJson(SEED_PRODUCTS, []).map((p, i) => clean(Object.assign({ position: i }, p)));
      if (seed.length) await sb('/rest/v1/rm_products', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(seed.map(productToRow)) });
      products = seed;
    } else products = rows.map(rowToProduct);
    const s = await sb('/rest/v1/rm_settings?key=eq.site&select=value');
    if (s.length) settings = s[0].value;
    else { settings = DEFAULT_SETTINGS(); await saveSettings(settings, true); }
  } else {
    products = readJson(SEED_PRODUCTS, []).map((p, i) => clean(Object.assign({ position: i }, p)));
    settings = readJson(SEED_SETTINGS, null) || DEFAULT_SETTINGS();
  }
  products.sort((a, b) => a.position - b.position);
  cache = { products, settings: cleanSettings(settings) }; cacheAt = Date.now();
  return cache;
}

async function saveAllFile(products) {
  writeJson(SEED_PRODUCTS, products.slice().sort((a, b) => a.position - b.position).map(p => clean(p)));
}

async function saveProduct(input, originalSlug) {
  const { products } = await load();
  const p = clean(input);
  if (!p.slug || !p.name) throw Object.assign(new Error('Name and slug are required'), { status: 400 });
  const clash = products.find(x => x.slug === p.slug && x.slug !== originalSlug);
  if (clash) throw Object.assign(new Error(`Slug "${p.slug}" is already used`), { status: 409 });
  const prev = products.find(x => x.slug === originalSlug);
  if (!Number.isFinite(+input.position)) p.position = prev ? prev.position : products.length;
  if (MODE === 'supabase') {
    await sb('/rest/v1/rm_products', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([productToRow(p)]) });
    if (originalSlug && originalSlug !== p.slug) await sb('/rest/v1/rm_products?slug=eq.' + encodeURIComponent(originalSlug), { method: 'DELETE' });
  } else {
    const next = products.filter(x => x.slug !== originalSlug && x.slug !== p.slug).concat(p);
    await saveAllFile(next);
  }
  if (originalSlug && originalSlug !== p.slug) await renameInRows(originalSlug, p.slug);
  bust();
  return p;
}

async function deleteProduct(slug) {
  const { products } = await load();
  if (MODE === 'supabase') await sb('/rest/v1/rm_products?slug=eq.' + encodeURIComponent(slug), { method: 'DELETE' });
  else await saveAllFile(products.filter(x => x.slug !== slug));
  await renameInRows(slug, null);
  bust();
}

async function reorder(slugs) {
  const { products } = await load();
  const pos = new Map(slugs.map((s, i) => [s, i]));
  const next = products.map(p => Object.assign({}, p, { position: pos.has(p.slug) ? pos.get(p.slug) : 900 + p.position }));
  if (MODE === 'supabase') await sb('/rest/v1/rm_products', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(next.map(productToRow)) });
  else await saveAllFile(next);
  bust();
}

async function renameInRows(from, to) {
  const { settings } = await load();
  let changed = false;
  settings.rows.forEach(r => {
    const i = r.slugs.indexOf(from);
    if (i > -1) { changed = true; to ? r.slugs.splice(i, 1, to) : r.slugs.splice(i, 1); }
  });
  if (changed) await saveSettings(settings);
}

async function saveSettings(s, raw) {
  const v = raw ? s : cleanSettings(s);
  if (MODE === 'supabase') await sb('/rest/v1/rm_settings', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ key: 'site', value: v, updated_at: new Date().toISOString() }]) });
  else writeJson(SEED_SETTINGS, v);
  bust();
  return v;
}

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'application/pdf': 'pdf' };
async function upload(buf, type, name) {
  const ext = EXT[type];
  if (!ext) throw Object.assign(new Error('Only PNG, JPG, WEBP, GIF, SVG or PDF files'), { status: 415 });
  const file = `${slugify(name) || 'file'}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  if (MODE === 'supabase') {
    const r = await fetch(`${SB}/storage/v1/object/${BUCKET}/${file}`, { method: 'POST', headers: Object.assign({}, AUTH, { 'Content-Type': type, 'x-upsert': 'true' }), body: buf });
    if (!r.ok) throw new Error('upload failed: ' + r.status);
    return `${SB}/storage/v1/object/public/${BUCKET}/${file}`;
  }
  fs.mkdirSync(UPLOADS, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS, file), buf);
  return '/uploads/' + file;
}

/* ---------- Bookings ---------- */
const BOOKINGS = path.join(DATA, 'bookings.json');
async function listBookings(limit) {
  if (MODE === 'supabase') return (await sb('/rest/v1/rm_bookings?select=*&order=created_at.desc&limit=' + (limit || 500))).map(r => Object.assign({}, r.data, { ref: r.ref, status: r.status, createdAt: r.created_at }));
  return readJson(BOOKINGS, []).slice().reverse().slice(0, limit || 500);
}
async function takenSlots(date) {
  if (MODE === 'supabase') return (await sb('/rest/v1/rm_bookings?select=slot_key&slot_key=like.' + encodeURIComponent('*|' + date + '|*'))).map(r => r.slot_key);
  return readJson(BOOKINGS, []).filter(b => b.slotKey && b.date === date).map(b => b.slotKey);
}
async function addBooking(b) {
  const conflict = () => Object.assign(new Error('That time was just booked. Please pick another slot.'), { status: 409 });
  if (MODE === 'supabase') {
    const r = await fetch(SB + '/rest/v1/rm_bookings', { method: 'POST', headers: Object.assign({}, AUTH, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ ref: b.ref, slot_key: b.slotKey, status: 'confirmed', data: b }) });
    if (r.status === 409) throw conflict();
    if (!r.ok) throw new Error('supabase ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return b;
  }
  const all = readJson(BOOKINGS, []);
  if (all.some(x => x.slotKey === b.slotKey)) throw conflict();
  all.push(Object.assign({ status: 'confirmed', createdAt: new Date().toISOString() }, b));
  writeJson(BOOKINGS, all);
  return b;
}
async function setBookingStatus(ref, status) {
  if (!['confirmed', 'completed', 'cancelled', 'no_show'].includes(status)) throw Object.assign(new Error('Bad status'), { status: 400 });
  const free = status === 'cancelled';
  if (MODE === 'supabase') {
    const patch = { status }; if (free) patch.slot_key = null;
    return sb('/rest/v1/rm_bookings?ref=eq.' + encodeURIComponent(ref), { method: 'PATCH', body: JSON.stringify(patch) });
  }
  const all = readJson(BOOKINGS, []);
  all.forEach(b => { if (b.ref === ref) { b.status = status; if (free) b.slotKey = null; } });
  writeJson(BOOKINGS, all);
}

module.exports = { DEFAULT_CONTENT, MODE, load, saveProduct, deleteProduct, reorder, saveSettings, upload, slugify, listBookings, takenSlots, addBooking, setBookingStatus, cleanBooking };
