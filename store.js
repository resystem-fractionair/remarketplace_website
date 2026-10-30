/* Data store. Supabase (Postgres + Storage) when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set,
   otherwise local JSON files in /data (dev only — Vercel's filesystem is read-only). */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = process.env.SUPABASE_BUCKET || 'rm-images';
const MODE = SB && KEY ? 'supabase' : 'file';
const DATA = path.join(__dirname, 'data');
const SEED_PRODUCTS = path.join(DATA, 'products.json');
const SEED_SETTINGS = path.join(DATA, 'settings.json');
const UPLOADS = path.join(__dirname, 'public', 'uploads');

const LIST_FIELDS = ['features', 'whyPoints', 'whatYouCanDo', 'useCases', 'stats'];
const TEXT_FIELDS = ['name', 'tagline', 'category', 'group', 'status', 'deploy', 'price', 'summary', 'whatItIs',
  'image', 'hero', 'mobileImage', 'logo', 'externalUrl', 'demoUrl', 'investUrl', 'pdfDesktop', 'pdfMobile', 'tone', 'sourceUrl'];

const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/* Whitelist + normalise a product coming from the admin form */
function clean(p) {
  const o = { slug: slugify(p.slug || p.name) };
  TEXT_FIELDS.forEach(k => { o[k] = String(p[k] == null ? '' : p[k]).trim().slice(0, k === 'summary' || k === 'whatItIs' ? 2000 : 500); });
  LIST_FIELDS.forEach(k => { o[k] = (Array.isArray(p[k]) ? p[k] : []).map(x => String(x).trim()).filter(Boolean).slice(0, 30); });
  o.highlights = (Array.isArray(p.highlights) ? p.highlights : [])
    .map(h => ({ title: String(h.title || '').trim(), text: String(h.text || '').trim() })).filter(h => h.title || h.text).slice(0, 20);
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
    ]
  };
};
function cleanSettings(s) {
  const strList = a => (Array.isArray(a) ? a : []).map(x => String(x).trim()).filter(Boolean).slice(0, 50);
  return {
    categories: [...new Set(strList(s.categories))],
    groups: [...new Set(strList(s.groups))],
    showCatalog: s.showCatalog !== false,
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
    headers: Object.assign({ apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, opts.headers || {})
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
    const r = await fetch(`${SB}/storage/v1/object/${BUCKET}/${file}`, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': type, 'x-upsert': 'true' }, body: buf });
    if (!r.ok) throw new Error('upload failed: ' + r.status);
    return `${SB}/storage/v1/object/public/${BUCKET}/${file}`;
  }
  fs.mkdirSync(UPLOADS, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS, file), buf);
  return '/uploads/' + file;
}

module.exports = { MODE, load, saveProduct, deleteProduct, reorder, saveSettings, upload, slugify };
