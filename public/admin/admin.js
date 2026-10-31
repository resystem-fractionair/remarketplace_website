/* Admin console (/admin): login, Products (CRUD, images, schedule, SEO, credentials, duplicate, drag order),
   Homepage (default products, featured row), Site content (generic editor for every text), Categories,
   Bookings (list, status, CSV, booking settings, agents) and QR & SEO (QR downloads, IndexNow). Talks to /api/admin/*. */
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = { products: [], settings: { categories: [], groups: [], rows: [], showCatalog: true }, mode: '', q: '', cat: '', renames: {} };

  const toast = m => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3200); };
  async function api(method, url, body, raw) {
    const r = await fetch(url, { method, headers: raw ? { 'Content-Type': raw.type || 'application/octet-stream' } : body ? { 'Content-Type': 'application/json' } : {}, body: raw || (body ? JSON.stringify(body) : undefined) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && !url.endsWith('/login')) { showLogin(); throw new Error('Session expired'); }
    if (!r.ok) throw new Error(j.error || 'Request failed');
    return j;
  }
  const initials = n => String(n).replace(/^re/i, '').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'RE';
  const thumb = p => (p.logo || p.image) ? `<span class="th"><img src="${esc(p.logo || p.image)}" alt=""></span>` : `<span class="th t-${esc(p.tone || 'a')}">${esc(initials(p.name))}</span>`;

  /* ---------- Auth ---------- */
  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; $('#pw').focus(); }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); $('#loginErr').hidden = true;
    try { await api('POST', '/api/admin/login', { username: $('#un').value, password: $('#pw').value }); $('#pw').value = ''; boot(); }
    catch (err) { $('#loginErr').textContent = err.message; $('#loginErr').hidden = false; }
  });
  $('#logout').onclick = async () => { await api('POST', '/api/admin/logout'); showLogin(); };

  async function boot() {
    try {
      const st = await api('GET', '/api/admin/state');
      Object.assign(S, st, { renames: {} });
      $('#login').hidden = true; $('#app').hidden = false;
      $('#mode').textContent = S.mode === 'supabase' ? '● Live database' : '● Local files (dev)';
      $('#mode').className = 'mode ' + S.mode;
      renderProducts(); renderRows(); renderCats(); renderHome(); renderOverview();
    } catch (_) { showLogin(); }
  }

  /* ---------- Tabs ---------- */
  $('#tabs').onclick = e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
    ['overview', 'products', 'rows', 'content', 'cats', 'bookings', 'qr'].forEach(t => { $('#tab-' + t).hidden = t !== b.dataset.tab; });
    if (b.dataset.tab === 'overview') renderOverview();
    if (b.dataset.tab === 'bookings') loadBookings();
    if (b.dataset.tab === 'qr') renderQR();
    if (b.dataset.tab === 'content') renderContent();
    if (b.dataset.tab === 'rows') renderHome();
  };

  /* ---------- Products list ---------- */
  const todayD = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
  const sched = p => { if (!p.showFrom && !p.showUntil) return ''; const t = todayD();
    if (p.showFrom && p.showFrom > t) return `<span class="sch up">Goes live ${esc(p.showFrom)}</span>`;
    if (p.showUntil && p.showUntil < t) return `<span class="sch end">Ended ${esc(p.showUntil)}</span>`;
    return `<span class="sch on">${p.showUntil ? 'Live until ' + esc(p.showUntil) : 'Scheduled · live'}</span>`; };
  /* ---------- Content completeness (used by the list badges and the Overview tab) ---------- */
  const okUrl = u => /^(https?:\/\/|\/)/.test(u || '');
  function checks(p) {
    const soon = /soon/i.test(p.status || ''), d = p.seoDescription || p.summary || '';
    const c = [
      ['Card image', okUrl(p.image), 'Images', true],
      ['Logo / app icon', okUrl(p.logo), 'Images', false],
      ['Tagline', !!p.tagline, 'Basics', true],
      ['Summary (2–3 sentences)', (p.summary || '').length >= 60, 'Basics', true],
      ['What it is', !!p.whatItIs, 'Basics', false],
      ['Go-live time', !!p.deploy, 'Basics', false],
      ['3+ key features', (p.features || []).length >= 3, 'Page content', !soon],
      ['Feature descriptions (highlights)', (p.highlights || []).length >= 2, 'Page content', false],
      ['2+ use cases', (p.useCases || []).length >= 2, 'Page content', false],
      ['Demo link or sandbox credentials', !!(p.demoUrl || (p.demoCreds || []).length), 'Sandbox', !soon],
      ['Brochure PDF (desktop)', okUrl(p.pdfDesktop), 'Links', false],
      ['Brochure PDF (mobile)', okUrl(p.pdfMobile), 'Links', false],
      ['Share image', okUrl(p.ogImage || p.image), 'Share', true],
      ['Share description 50–160 chars', p.seoDescription ? d.length >= 50 && d.length <= 160 : d.length >= 50, 'Share', false]
    ];
    if (p.buy && p.buy.enabled) c.push(['Buy with reID: price & wallet', /^\d/.test(p.buy.amount || '') && /^0x[0-9a-fA-F]{40}$/.test(p.buy.payTo || ''), 'Buy', true]);
    return c.map(([label, ok, where, must]) => ({ label, ok, where, must }));
  }
  const score = p => { const c = checks(p); return { pct: Math.round(100 * c.filter(x => x.ok).length / c.length), missing: c.filter(x => !x.ok), must: c.filter(x => !x.ok && x.must) }; };
  function renderProducts() {
    const sel = $('#pcat'); const cur = sel.value;
    sel.innerHTML = '<option value="">All categories</option>' + S.settings.categories.map(c => `<option${c === cur ? ' selected' : ''}>${esc(c)}</option>`).join('');
    const q = S.q.toLowerCase(), filtering = !!(q || S.cat);
    const inRows = slug => S.settings.rows.map((r, i) => r.slugs.includes(slug) ? 'Row ' + (i + 1) : '').filter(Boolean);
    $('#plist').innerHTML = S.products.filter(p => (!S.cat || p.category === S.cat) && (!q || (p.name + ' ' + p.slug).toLowerCase().includes(q))).map(p => `
      <div class="pitem${p.visible ? '' : ' off'}" data-slug="${esc(p.slug)}" draggable="${!filtering}">
        <span class="grip" title="${filtering ? 'Clear search/filter to reorder' : 'Drag to reorder'}">⋮⋮</span>
        ${thumb(p)}
        <div class="pi-t"><b>${esc(p.name)}</b><span>${esc(p.category || 'No category')} · /${esc(p.slug)}${p.status ? ' · ' + esc(p.status) : ''}</span></div>
        <div class="pi-rows">${(() => { const s = score(p); return `<span class="cq ${s.must.length ? 'bad' : s.pct < 100 ? 'mid' : 'ok'}" title="${esc(s.missing.length ? 'Missing:\n' + s.missing.map(m => '• ' + m.label + ' (' + m.where + ')').join('\n') : 'All content complete')}">${s.pct}% content</span>`; })()}${sched(p)}${inRows(p.slug).map(r => `<span>${r}</span>`).join('')}${(() => { const s = shareInfo(p), bad = s.checks.filter(c => !c[0]).length; return `<span class="${bad ? 'sh-bad' : 'sh-ok'}" title="${esc(s.checks.map(c => (c[0] ? '✓ ' : '! ') + c[1]).join('\n'))}">${bad ? 'Share: ' + bad + ' to fix' : 'Share ✓'}</span>`; })()}</div>
        <button class="btn btn-ghost sm" data-copylink="${esc(p.slug)}" title="Copy share link">🔗 Link</button>
        <label class="switch" title="Show on site"><input type="checkbox" data-vis="${esc(p.slug)}"${p.visible ? ' checked' : ''}><span class="sw"></span></label>
        <button class="btn btn-ghost sm" data-edit="${esc(p.slug)}">Edit</button>
      </div>`).join('') || '<p class="muted">No products match.</p>';
  }
  $('#pq').oninput = e => { S.q = e.target.value; renderProducts(); };
  $('#plist').addEventListener('click', async e => { const b = e.target.closest('[data-copylink]'); if (!b) return; e.stopPropagation(); const site = await siteInfo(); navigator.clipboard.writeText(`${site.siteUrl}/product/${b.dataset.copylink}`).then(() => toast('Share link copied')); }, true);
  $('#pcat').onchange = e => { S.cat = e.target.value; renderProducts(); };
  $('#plist').addEventListener('change', async e => {
    const slug = e.target.dataset.vis; if (!slug) return;
    const p = S.products.find(x => x.slug === slug);
    p.visible = e.target.checked; renderProducts();
    try { await api('PUT', '/api/admin/products/' + encodeURIComponent(slug) + '/visible', { visible: p.visible }); toast(`${p.name} is now ${p.visible ? 'visible on the site' : 'hidden'}`); }
    catch (err) { toast(err.message); p.visible = !p.visible; renderProducts(); }
  });
  /* Always edit the latest saved version, so an old copy in this tab can never overwrite newer changes */
  async function editFresh(slug) {
    try { const fresh = await api('GET', '/api/admin/product/' + encodeURIComponent(slug)); const i = S.products.findIndex(x => x.slug === slug); if (i >= 0) S.products[i] = fresh; }
    catch (_) { /* fall back to the list copy */ }
    openEditor(slug);
  }
  $('#plist').addEventListener('click', e => { const b = e.target.closest('[data-edit]'); if (b) editFresh(b.dataset.edit); });
  $('#newProd').onclick = () => openEditor(null);

  /* Drag to reorder (generic) */
  function sortable(container, itemSel, onDrop) {
    let drag = null;
    container.addEventListener('dragstart', e => { drag = e.target.closest(itemSel); if (drag) { drag.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; } });
    container.addEventListener('dragend', () => { if (drag) { drag.classList.remove('dragging'); drag = null; onDrop(); } });
    container.addEventListener('dragover', e => {
      if (!drag) return; e.preventDefault();
      const over = e.target.closest(itemSel); if (!over || over === drag || over.parentNode !== drag.parentNode) return;
      const r = over.getBoundingClientRect();
      const after = over.parentNode.dataset.axis === 'x' ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
      over.parentNode.insertBefore(drag, after ? over.nextSibling : over);
    });
  }
  sortable($('#plist'), '.pitem', async () => {
    const slugs = [...document.querySelectorAll('#plist .pitem')].map(el => el.dataset.slug);
    S.products.sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug));
    S.products.forEach((p, i) => { p.position = i; });
    try { await api('PUT', '/api/admin/order', { slugs }); toast('Order saved'); } catch (err) { toast(err.message); }
  });

  let SITE = null;
  /* ---------- Icon picker (library from /js/icons.js + upload) ---------- */
  function iconPicker(anchor, current, onPick, uploadName) {
    let pop = $('#iconPop'); if (pop) pop.remove();
    pop = document.createElement('div'); pop.id = 'iconPop'; pop.className = 'ip-pop';
    pop.innerHTML = `<div class="ip-h"><b>Choose icon</b><button type="button" class="icon" data-ipx>✕</button></div>
      <div class="ip-grid">${RMI.names.map(n => `<button type="button" class="${n === current ? 'on' : ''}" data-ipn="${n}" title="${n}">${RMI.render(n, 20)}</button>`).join('')}</div>
      <div class="ip-f"><label class="btn btn-ghost sm">Upload icon<input type="file" accept="image/svg+xml,image/png,image/webp" hidden></label><button type="button" class="btn btn-ghost sm" data-ipn="">Automatic</button><small>Upload: 96 × 96 px, transparent SVG or PNG</small></div>`;
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect(), W = Math.min(340, innerWidth - 16);
    pop.style.width = W + 'px'; pop.style.left = Math.max(8, Math.min(r.left, innerWidth - W - 8)) + 'px';
    const top = r.bottom + 6; pop.style.top = (top + pop.offsetHeight > innerHeight ? Math.max(8, r.top - pop.offsetHeight - 6) : top) + 'px';
    const close = () => { pop.remove(); document.removeEventListener('mousedown', out, true); };
    const out = ev => { if (!pop.contains(ev.target)) close(); };
    setTimeout(() => document.addEventListener('mousedown', out, true));
    pop.addEventListener('click', ev => { const b = ev.target.closest('[data-ipn],[data-ipx]'); if (!b) return; if (b.dataset.ipn != null) onPick(b.dataset.ipn); close(); });
    pop.querySelector('input[type=file]').onchange = async ev => { const f = ev.target.files[0]; if (!f) return; toast('Uploading icon…');
      try { const { url } = await api('POST', '/api/admin/upload?name=' + encodeURIComponent(uploadName || 'icon'), null, f); onPick(url); close(); toast('Icon uploaded — remember to save'); } catch (err) { toast(err.message); } };
  }

  /* ---------- Editor ---------- */
  let editing = null;
  const LISTS = [['features', 'Key features'], ['whyPoints', 'Why points'], ['whatYouCanDo', 'What you can do'], ['useCases', 'Use cases'], ['stats', 'Stats chips (e.g. 99.9% uptime)']];
  // [field, label, recommended size, min width, min height, where it is used]
  const IMAGES = [
    ['image', 'Card image', '1600 × 900 px · 16:9 · JPG/WebP ≤ 400 KB', 1200, 675, 'Catalog cards, featured products, booking wizard, share preview (social), and the product banner when no banner override is set.'],
    ['hero', 'Banner override', '2100 × 800 px · 21:8 · JPG/WebP ≤ 600 KB', 1600, 600, 'Top banner on the product page only. Desktop crops to 21:8, phones to 16:9 — keep the important part in the centre.'],
    ['ogImage', 'Share image (social preview)', '1200 × 630 px · 1.91:1 · JPG/PNG ≤ 300 KB', 1200, 630, 'Shown when the product link is shared on WhatsApp, LinkedIn, X, Facebook, Slack, Telegram etc. Blank = card image is used.'],
    ['logo', 'Logo / app icon', '512 × 512 px · square · transparent PNG or SVG', 256, 256, 'Small product mark in cards, header chips and booking list when there is no card image.']];
  const sizeNote = (img, box) => { const k = box.dataset.img, spec = IMAGES.find(x => x[0] === k), w = img.naturalWidth, h = img.naturalHeight, out = box.querySelector('.dim'); if (!out || !spec) return;
    const small = w < spec[3] || h < spec[4]; out.className = 'dim ' + (small ? 'bad' : 'good'); out.textContent = `Current: ${w} × ${h} px` + (small ? ` — too small, use ${spec[2].split(' ·')[0]}` : ' ✓'); };
  const prevHTML = url => url ? `<img src="${esc(url)}" alt="" onload="window.__dim && __dim(this)">` : '<span>No image</span>';
  window.__dim = img => { const box = img.closest('.img-f'); if (box) sizeNote(img, box); };
  const LINKS = [['externalUrl', 'Live site'], ['demoUrl', 'Demo URL (login page)'], ['demoNote', 'Sandbox note (shown under credentials)'], ['investUrl', 'Investment opportunity URL'], ['pdfDesktop', 'Brochure PDF — desktop'], ['pdfMobile', 'Brochure PDF — mobile'], ['sourceUrl', 'resystem.org page']];
  const field = (k, label, v, attrs) => `<label>${esc(label)}<input name="${k}" value="${esc(v)}" ${attrs || ''}></label>`;
  const area = (k, label, v, rows, hint) => `<label>${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ''}<textarea name="${k}" rows="${rows || 4}">${esc(v)}</textarea></label>`;
  const select = (k, label, v, opts) => `<label>${esc(label)}<select name="${k}">${opts.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;

  function openEditor(slug, preset) {
    const p = preset ? preset : slug ? S.products.find(x => x.slug === slug) : { name: '', slug: '', visible: false, tone: 'a', category: S.settings.categories[0] || '', group: S.settings.groups[0] || '' };
    editing = { orig: slug, p };
    $('#edTitle').textContent = slug ? 'Edit ' + p.name : 'New product';
    $('#edDel').hidden = !slug; $('#edDup').hidden = !slug;
    $('#edView').hidden = !slug; $('#edView').href = '/product/' + (slug || '');
    const cats = [...new Set(['', ...S.settings.categories, p.category || ''])];
    const groups = [...new Set(['', ...S.settings.groups, p.group || ''])];
    $('#edForm').innerHTML = `<div class="ed-cols">
      <fieldset><legend>Basics</legend>
        <div class="two">${field('name', 'Name *', p.name, 'required')}${field('slug', 'URL slug *', p.slug, 'placeholder="auto from name"')}</div>
        ${field('tagline', 'Tagline', p.tagline)}
        <div class="two">${select('category', 'Category', p.category || '', cats)}${select('group', 'Group', p.group || '', groups)}</div>
        <div class="three">${field('status', 'Badge (e.g. Coming soon)', p.status)}${field('deploy', 'Go-live time', p.deploy, 'placeholder="2 weeks"')}${field('price', 'Pricing', p.price, 'placeholder="On request"')}</div>
        ${area('summary', 'Summary', p.summary, 3)}
        ${area('whatItIs', 'What it is', p.whatItIs, 3)}
        <div class="two"><label class="switch-l"><input type="checkbox" name="visible"${p.visible ? ' checked' : ''}><span class="sw"></span>Visible on site</label>
          <label>Icon colour (used when no logo)<select name="tone">${[['a', 'Orange'], ['b', 'Green'], ['c', 'Gold'], ['d', 'Blue']].map(([v, l]) => `<option value="${v}"${(p.tone || 'a') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
      </fieldset>
      <fieldset><legend>Schedule (optional)</legend><p class="muted small">Plan launches ahead: the product appears automatically from the start date and disappears after the end date (Dubai time). Leave blank to follow the Visible switch only.</p>
        <div class="two"><label>Show from<input type="date" name="showFrom" value="${esc(p.showFrom || '')}"></label><label>Hide after<input type="date" name="showUntil" value="${esc(p.showUntil || '')}"></label></div></fieldset>
      <fieldset class="share-fs"><legend>Share link & social preview</legend>
        <div class="sh-link"><input id="shUrl" readonly value=""><button type="button" class="btn btn-ghost sm" data-shcopy>Copy link</button><a class="btn btn-ghost sm" id="shOpen" target="_blank" rel="noopener">Open ↗</a></div>
        <div class="sh-net" id="shNet"></div>
        ${field('seoTitle', 'Share / search title', p.seoTitle || '', 'placeholder="' + esc(p.name || '') + ' — ' + esc(p.tagline || '') + '"')}
        ${area('seoDescription', 'Share / search description (50–160 characters)', p.seoDescription || '', 2)}
        <div class="img-f" data-img="ogImage"><span class="lbl">Share image <em class="rec">1200 × 630 px · JPG/PNG ≤ 300 KB</em></span>
          <small class="use">${esc(IMAGES.find(x => x[0] === 'ogImage')[5])}</small>
          <div class="prev og">${prevHTML(p.ogImage)}</div><span class="dim"></span>
          <input name="ogImage" value="${esc(p.ogImage || '')}" placeholder="Blank = use card image">
          <div class="img-a"><label class="btn btn-ghost sm">Upload<input type="file" accept="image/*" data-up="ogImage" hidden></label><button type="button" class="btn btn-ghost sm" data-clear="ogImage">Remove</button></div></div>
        <span class="lbl">Preview — how the link looks when shared</span><div id="shPrev"></div>
        <ul class="sh-check" id="shCheck"></ul></fieldset>
      <fieldset><legend>Images</legend><p class="muted small">Recommended sizes are shown on each image. After upload the actual size is checked; a red note means the image will look blurry.</p><div class="img-grid">${IMAGES.filter(x => x[0] !== 'ogImage').map(([k, l]) => `
        <div class="img-f" data-img="${k}"><span class="lbl">${esc(l)} <em class="rec">${esc(IMAGES.find(x => x[0] === k)[2])}</em></span>
          <small class="use">${esc(IMAGES.find(x => x[0] === k)[5])}</small>
          <div class="prev${k === 'logo' ? ' sq' : k === 'hero' ? ' wide' : ''}">${prevHTML(p[k])}</div><span class="dim"></span>
          <input name="${k}" value="${esc(p[k] || '')}" placeholder="Paste URL or upload">
          <div class="img-a"><label class="btn btn-ghost sm">Upload<input type="file" accept="image/*" data-up="${k}" hidden></label><button type="button" class="btn btn-ghost sm" data-clear="${k}">Remove</button></div>
        </div>`).join('')}</div></fieldset>
      <fieldset><legend>Links, demo access & brochures</legend>${LINKS.map(([k, l]) => k.startsWith('pdf')
        ? `<label>${esc(l)}<div class="inline"><input name="${k}" value="${esc(p[k] || '')}"><label class="btn btn-ghost sm">Upload PDF<input type="file" accept="application/pdf" data-up="${k}" hidden></label></div></label>`
        : field(k, l, p[k] || '')).join('')}</fieldset>
      <fieldset><legend>Page content</legend><p class="muted small">One item per line.</p>
        ${LISTS.map(([k, l]) => area(k, l, (p[k] || []).join('\n'), 4) + (k === 'features' ? '<div class="fi-box"><span class="lbl">Feature icons <small>— click an icon to change it. Library icon, or upload your own (96 × 96 px, transparent SVG/PNG).</small></span><div id="featIcons"></div></div>' : '')).join('')}
        ${area('highlights', 'Highlights', (p.highlights || []).map(h => h.title + ' | ' + h.text).join('\n'), 4, 'Title | description — one per line')}
      </fieldset>
      <fieldset><legend>Buy with reID (payments)</legend>
        <p class="muted small">Off = product can be viewed by anyone, no purchase. On = product page shows <b>Buy with reID</b>; buyers must sign in with reID and approve the payment in the reID app (INFRA chain).</p>
        <label class="switch-l"><input type="checkbox" name="buyEnabled"${p.buy && p.buy.enabled ? ' checked' : ''}><span class="sw"></span>Sell this product with reID</label>
        <div class="three">${field('buyAmount', 'Price amount *', (p.buy || {}).amount || '', 'placeholder="250" inputmode="decimal"')}${field('buySymbol', 'Currency symbol', (p.buy || {}).symbol || '', 'placeholder="USDC / reAED / INFRA"')}${field('buyLabel', 'Price label on page', (p.buy || {}).label || '', 'placeholder="250 USDC / one-time"')}</div>
        ${field('buyPayTo', 'Receiving wallet address *', (p.buy || {}).payTo || '', 'placeholder="0x… (your company wallet)"')}
        <div class="three">${field('buyToken', 'Token contract (blank = native coin)', (p.buy || {}).token || '', 'placeholder="0x… ERC-20 address"')}${field('buyDecimals', 'Token decimals', (p.buy || {}).decimals || 18, 'inputmode="numeric"')}${field('buyChainId', 'Chain ID', (p.buy || {}).chainId || 15324, 'inputmode="numeric"')}</div>
      </fieldset>
      <fieldset><legend>Sandbox / demo credentials</legend>
        <p class="muted small">Shown on the product page with Copy buttons and a TEST DATA badge. The Demo URL row comes from the Demo URL field above.</p>
        ${area('demoCreds', 'Credentials', (p.demoCreds || []).map(c => c.label + ' | ' + c.value).join('\n'), 5, 'Label | value — one per line, e.g. Test email | demo@yourapp.io')}
      </fieldset></div>`;
    editing.icons = {}; (p.features || []).forEach((f, i) => { editing.icons[f] = (p.featureIcons || [])[i] || ''; });
    renderFeatIcons(); renderShare();
    document.body.classList.add('lock'); $('#edOv').hidden = false;
  }
  const SHARE_TPL = { wa: ['WhatsApp', u => 'https://wa.me/?text=' + encodeURIComponent(u)], li: ['LinkedIn', u => 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(u)], x: ['X', u => 'https://x.com/intent/post?url=' + encodeURIComponent(u)], fb: ['Facebook', u => 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(u)], tg: ['Telegram', u => 'https://t.me/share/url?url=' + encodeURIComponent(u)] };
  async function siteInfo() { if (!SITE) try { SITE = await fetch('/api/site').then(r => r.json()); } catch (_) { SITE = { siteUrl: location.origin }; } return SITE; }
  const shareInfo = p => {
    const t = p.seoTitle || `${p.name} — ${p.tagline || p.category || ''} | reMarketplace`, d = p.seoDescription || p.summary || p.tagline || '', img = p.ogImage || p.image || p.hero || '';
    return { t, d, img, checks: [[!!p.slug, 'Share link'], [!!(p.seoTitle || p.name), p.seoTitle ? 'Custom title' : 'Title (automatic from name + tagline)'], p.seoDescription ? [d.length >= 50 && d.length <= 160, `Custom description ${d.length} characters` + (d.length > 160 ? ' — over 160, will be cut' : d.length < 50 ? ' — too short (aim for 50–160)' : '')] : [d.length >= 50, d.length >= 50 ? 'Description (automatic from summary, cut to 160)' : 'Description missing — add a summary or share description'], [!!img, p.ogImage ? 'Custom share image' : img ? 'Share image (using card image)' : 'No share image — upload one']] };
  };
  async function renderShare() {
    const f = $('#edForm'); if (!f || !$('#shPrev')) return;
    const site = await siteInfo(), v = k => (f.querySelector(`[name="${k}"]`) || {}).value || '';
    const p = { slug: v('slug'), name: v('name'), tagline: v('tagline'), category: v('category'), summary: v('summary'), seoTitle: v('seoTitle'), seoDescription: v('seoDescription'), ogImage: v('ogImage'), image: v('image'), hero: v('hero') };
    const url = `${site.siteUrl}/product/${p.slug}`, s = shareInfo(p), host = site.siteUrl.replace(/^https?:\/\//, '');
    $('#shUrl').value = p.slug ? url : 'Set a URL slug first'; $('#shOpen').href = url;
    $('#shNet').innerHTML = Object.values(SHARE_TPL).map(([n, fn]) => `<a href="${esc(fn(url))}" target="_blank" rel="noopener">${n}</a>`).join('');
    $('#shPrev').innerHTML = `<div class="og-card">${s.img ? `<img src="${esc(s.img)}" alt="">` : '<div class="og-noimg">No image</div>'}<div><span>${esc(host)}</span><b>${esc(s.t)}</b><small>${esc(s.d.length > 160 ? s.d.slice(0, 157) + '…' : s.d)}</small></div></div>`;
    $('#shCheck').innerHTML = s.checks.map(([ok, l]) => `<li class="${ok ? 'ok' : 'no'}">${ok ? '✓' : '!'} ${esc(l)}</li>`).join('');
  }
  function renderFeatIcons() {
    const box = $('#featIcons'); if (!box) return;
    const feats = ($('#edForm').features.value || '').split('\n').map(s => s.trim()).filter(Boolean);
    box.innerHTML = feats.length ? feats.map(f => `<div class="fi-row"><button type="button" class="ip-btn" data-ficon="${esc(f)}" title="Change icon">${RMI.render(editing.icons[f], 20) || '<span class="auto">Auto</span>'}</button><span>${esc(f)}</span></div>`).join('') : '<p class="muted small">Add key features above first.</p>';
  }
  $('#edForm').addEventListener('click', e => {
    if (e.target.closest('[data-shcopy]')) { navigator.clipboard.writeText($('#shUrl').value).then(() => toast('Link copied')); return; }
    const b = e.target.closest('[data-ficon]'); if (!b) return;
    iconPicker(b, editing.icons[b.dataset.ficon], v => { editing.icons[b.dataset.ficon] = v; renderFeatIcons(); }, ($('#edForm').slug.value || 'product') + '-icon');
  });
  const closeEditor = () => { $('#edOv').hidden = true; document.body.classList.remove('lock'); };
  $('#edOv').addEventListener('click', e => { if (e.target.id === 'edOv' || e.target.closest('[data-close]')) closeEditor(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#edOv').hidden) closeEditor(); });

  $('#edForm').addEventListener('input', e => {
    if (e.target.name === 'name' && !editing.orig) $('#edForm').slug.value = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const box = e.target.closest('.img-f');
    if (box && e.target.tagName === 'INPUT') { box.querySelector('.prev').innerHTML = prevHTML(e.target.value); box.querySelector('.dim').textContent = ''; }
    if (e.target.name === 'features') renderFeatIcons();
    if (/^(slug|name|tagline|summary|seoTitle|seoDescription|ogImage|image|hero)$/.test(e.target.name)) renderShare();
  });
  $('#edForm').addEventListener('click', e => {
    const k = e.target.dataset && e.target.dataset.clear; if (!k) return;
    const box = e.target.closest('.img-f'); box.querySelector('input[name]').value = ''; box.querySelector('.prev').innerHTML = '<span>No image</span>'; box.querySelector('.dim').textContent = ''; renderShare();
  });
  $('#edForm').addEventListener('change', async e => {
    const k = e.target.dataset.up; if (!k || !e.target.files[0]) return;
    const f = e.target.files[0];
    if (f.size > 8 * 1024 * 1024) return toast('File is over 8 MB');
    toast('Uploading…');
    try {
      const { url } = await api('POST', '/api/admin/upload?name=' + encodeURIComponent(($('#edForm').slug.value || 'product') + '-' + k), null, f);
      $('#edForm').querySelector(`[name="${k}"]`).value = url;
      const box = e.target.closest('.img-f'); if (box) box.querySelector('.prev').innerHTML = prevHTML(url);
      toast('Uploaded — remember to save'); renderShare();
    } catch (err) { toast(err.message); }
    e.target.value = '';
  });

  function readForm() {
    const f = $('#edForm'), v = k => (f.querySelector(`[name="${k}"]`) || {}).value || '';
    const p = Object.assign({}, editing.p);
    ['name', 'slug', 'tagline', 'category', 'group', 'status', 'deploy', 'price', 'summary', 'whatItIs', 'tone', 'showFrom', 'showUntil', 'seoTitle', 'seoDescription',
      ...IMAGES.map(x => x[0]), ...LINKS.map(x => x[0])].forEach(k => { p[k] = v(k).trim(); });
    LISTS.forEach(([k]) => { p[k] = v(k).split('\n').map(s => s.trim()).filter(Boolean); });
    p.highlights = v('highlights').split('\n').map(s => s.trim()).filter(Boolean).map(s => { const [t, ...rest] = s.split('|'); return { title: t.trim(), text: rest.join('|').trim() }; });
    p.demoCreds = v('demoCreds').split('\n').map(s => s.trim()).filter(Boolean).map(s => { const [l, ...rest] = s.split('|'); return { label: l.trim(), value: rest.join('|').trim() }; }).filter(c => c.label && c.value);
    p.buy = { enabled: f.buyEnabled.checked, amount: v('buyAmount').trim(), symbol: v('buySymbol').trim(), label: v('buyLabel').trim(), payTo: v('buyPayTo').trim(), token: v('buyToken').trim(), decimals: v('buyDecimals').trim(), chainId: v('buyChainId').trim() };
    if (p.buy.enabled && (!/^\d+(\.\d+)?$/.test(p.buy.amount) || !/^0x[0-9a-fA-F]{40}$/.test(p.buy.payTo) || (p.buy.token && !/^0x[0-9a-fA-F]{40}$/.test(p.buy.token)))) throw new Error('Buy with reID: enter a price amount and valid 0x wallet / token addresses');
    p.featureIcons = p.features.map(x => (editing.icons || {})[x] || '');
    p.visible = f.visible.checked;
    return p;
  }
  $('#edSave').onclick = async () => {
    let p; try { p = readForm(); } catch (err) { return toast(err.message); }
    if (!p.name) return toast('Name is required');
    $('#edSave').disabled = true;
    try {
      const saved = editing.orig ? await api('PUT', '/api/admin/products/' + encodeURIComponent(editing.orig), p) : await api('POST', '/api/admin/products', p);
      toast('Saved ' + saved.name);
      closeEditor(); await boot();
    } catch (err) { toast(err.message); }
    $('#edSave').disabled = false;
  };
  $('#edDup').onclick = () => {
    const src = (() => { try { return readForm(); } catch (_) { return Object.assign({}, editing.p); } })(), base = (src.slug || 'product') + '-copy';
    let s = base, n = 2; while (S.products.some(p => p.slug === s)) s = base + '-' + n++;
    closeEditor(); openEditor(null, Object.assign({}, src, { name: src.name + ' (copy)', slug: s, visible: false, position: S.products.length }));
    $('#edTitle').textContent = 'New product — copy of ' + src.name; toast('Copy ready — edit and save');
  };
  $('#edDel').onclick = async () => {
    if (!confirm(`Delete "${editing.p.name}" permanently? Tip: hide it instead to keep the data.`)) return;
    try { await api('DELETE', '/api/admin/products/' + encodeURIComponent(editing.orig)); toast('Deleted'); closeEditor(); await boot(); }
    catch (err) { toast(err.message); }
  };

  /* ---------- Homepage rows ---------- */
  const pBy = s => S.products.find(p => p.slug === s);
  function renderRows() {
    $('#showCatalog').checked = S.settings.showCatalog;
    $('#rows').innerHTML = S.settings.rows.map((r, i) => {
      const avail = S.products.filter(p => !r.slugs.includes(p.slug));
      return `<div class="row-card" data-row="${i}">
        <div class="rc-head"><span class="rc-n">Row ${i + 1}</span>
          <input data-rf="title" value="${esc(r.title)}" placeholder="Row title">
          <input data-rf="subtitle" value="${esc(r.subtitle)}" placeholder="Subtitle (optional)" class="grow">
          <button class="icon" data-rmove="-1" title="Move row up"${i ? '' : ' disabled'}>↑</button>
          <button class="icon" data-rmove="1" title="Move row down"${i < S.settings.rows.length - 1 ? '' : ' disabled'}>↓</button>
          <button class="icon danger" data-rdel title="Delete row">✕</button></div>
        <div class="chips-row" data-axis="x">${r.slugs.map(s => { const p = pBy(s); return p ? `
          <div class="pchip${p.visible ? '' : ' off'}" draggable="true" data-s="${esc(s)}">${thumb(p)}<span>${esc(p.name)}${p.visible ? '' : ' <em>(hidden)</em>'}</span><button data-rrem="${esc(s)}" title="Remove">×</button></div>` : ''; }).join('')}
          ${r.slugs.length ? '' : '<span class="muted small">No products yet — add some below.</span>'}</div>
        <div class="rc-add"><select data-radd><option value="">+ Add a product to this row…</option>${avail.map(p => `<option value="${esc(p.slug)}">${esc(p.name)} — ${esc(p.category)}</option>`).join('')}</select>
          <span class="muted small">${r.slugs.length} product${r.slugs.length === 1 ? '' : 's'} · drag chips to reorder</span></div>
      </div>`;
    }).join('') || '<p class="muted">No rows yet. Add one to curate the homepage.</p>';
    document.querySelectorAll('.chips-row').forEach(c => sortable(c, '.pchip', () => {
      const i = +c.closest('[data-row]').dataset.row;
      S.settings.rows[i].slugs = [...c.querySelectorAll('.pchip')].map(el => el.dataset.s);
    }));
  }
  $('#rows').addEventListener('input', e => {
    const k = e.target.dataset.rf; if (!k) return;
    S.settings.rows[+e.target.closest('[data-row]').dataset.row][k] = e.target.value;
  });
  $('#rows').addEventListener('change', e => {
    if (!('radd' in e.target.dataset) || !e.target.value) return;
    S.settings.rows[+e.target.closest('[data-row]').dataset.row].slugs.push(e.target.value); renderRows();
  });
  $('#rows').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const i = +b.closest('[data-row]').dataset.row, rows = S.settings.rows;
    if (b.dataset.rmove) { const j = i + +b.dataset.rmove; [rows[i], rows[j]] = [rows[j], rows[i]]; }
    else if ('rdel' in b.dataset) { if (!confirm(`Delete row "${rows[i].title || i + 1}"?`)) return; rows.splice(i, 1); }
    else if (b.dataset.rrem) rows[i].slugs = rows[i].slugs.filter(s => s !== b.dataset.rrem);
    renderRows();
  });
  $('#addRow').onclick = () => { S.settings.rows.push({ id: 'row-' + Date.now(), title: 'New row', subtitle: '', slugs: [] }); renderRows(); };
  $('#showCatalog').onchange = e => { S.settings.showCatalog = e.target.checked; };
  async function saveSettings(msg) {
    try { S.settings = await api('PUT', '/api/admin/settings', S.settings); toast(msg); renderRows(); renderCats(); renderProducts(); }
    catch (err) { toast(err.message); }
  }
  $('#saveRows').onclick = () => saveSettings('Homepage rows saved');

  /* ---------- Categories & groups ---------- */
  function listEditor(key, el) {
    const counts = {}; S.products.forEach(p => { const v = key === 'categories' ? p.category : p.group; counts[v] = (counts[v] || 0) + 1; });
    $(el).innerHTML = `<div class="clist" data-axis="y">` + S.settings[key].map((c, i) => `
      <div class="citem" draggable="true" data-i="${i}"><span class="grip">⋮⋮</span><input data-ck="${key}" data-i="${i}" value="${esc(c)}"><span class="muted small">${counts[c] || 0} product${counts[c] === 1 ? '' : 's'}</span>
      <button class="icon danger" data-cdel="${key}" data-i="${i}" title="Remove">✕</button></div>`).join('') + '</div>';
    sortable($(el).firstChild, '.citem', () => {
      const order = [...$(el).querySelectorAll('.citem')].map(x => S.settings[key][+x.dataset.i]);
      S.settings[key] = order; renderCats();
    });
  }
  function renderCats() { listEditor('categories', '#cats'); listEditor('groups', '#groups'); }
  document.addEventListener('focusin', e => { if (e.target.dataset && e.target.dataset.ck) e.target.dataset.old = e.target.value; });
  document.addEventListener('change', e => {
    const k = e.target.dataset && e.target.dataset.ck; if (!k) return;
    const old = e.target.dataset.old, nv = e.target.value.trim();
    if (!nv || nv === old) { e.target.value = old; return; }
    S.settings[k][+e.target.dataset.i] = nv;
    const field = k === 'categories' ? 'category' : 'group';
    const orig = Object.keys(S.renames).find(o => S.renames[o].v === old && S.renames[o].f === field) || old;
    S.renames[orig] = { v: nv, f: field };
    renderCats();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-cdel]'); if (!b) return;
    const key = b.dataset.cdel, name = S.settings[key][+b.dataset.i];
    const used = S.products.filter(p => (key === 'categories' ? p.category : p.group) === name).length;
    if (used && !confirm(`"${name}" is used by ${used} product(s). Remove it from the list anyway? Those products keep the value until you edit them.`)) return;
    S.settings[key].splice(+b.dataset.i, 1); renderCats();
  });
  const adder = (form, input, key) => $(form).addEventListener('submit', e => {
    e.preventDefault(); const v = $(input).value.trim();
    if (v && !S.settings[key].includes(v)) { S.settings[key].push(v); $(input).value = ''; renderCats(); }
  });
  adder('#addCat', '#newCat', 'categories'); adder('#addGroup', '#newGroup', 'groups');
  $('#saveCats').onclick = async () => {
    const ren = Object.entries(S.renames).filter(([o, r]) => o !== r.v);
    try {
      for (const [old, r] of ren) {
        for (const p of S.products.filter(x => x[r.f] === old)) { p[r.f] = r.v; await api('PUT', '/api/admin/products/' + encodeURIComponent(p.slug), p); }
      }
      S.renames = {};
      await saveSettings(ren.length ? `Saved — ${ren.length} rename(s) applied to products` : 'Categories saved');
    } catch (err) { toast(err.message); }
  };

  /* ---------- Bookings ---------- */
  let BK = [];
  async function loadBookings() {
    try { BK = await api('GET', '/api/admin/bookings'); } catch (err) { toast(err.message); }
    renderBookings(); renderBkForm(); loadOrders();
  }
  async function loadOrders() {
    let od = []; try { od = await api('GET', '/api/admin/orders'); } catch (_) {}
    $('#odRows').innerHTML = od.map(o => `<tr><td>${esc((o.createdAt || '').slice(0, 16).replace('T', ' '))}</td><td><b>${esc(o.userName || '')}</b><br><span class="muted small">${esc(o.wallet || o.userId || '')}</span></td>
      <td>${esc(o.product)}</td><td>${esc(o.price)}</td><td><span class="od-st ${esc(o.status)}">${esc(o.status)}</span>${o.error ? `<div class="muted small">${esc(o.error)}</div>` : ''}</td><td class="small">${o.txHash ? esc(o.txHash.slice(0, 10) + '…' + o.txHash.slice(-6)) : '—'}<br><span class="muted">${esc(o.ref)}</span></td></tr>`).join('')
      || '<tr><td colspan="6" class="muted">No purchases yet.</td></tr>';
  }
  $('#odRefresh').onclick = loadOrders;
  function renderBookings() {
    const f = $('#bkFilter').value, rows = BK.filter(x => !f || x.status === f);
    $('#bkRows').innerHTML = rows.map(x => `<tr>
      <td><b>${esc(x.date)}</b><br>${esc(x.time)}</td>
      <td><b>${esc(x.name)}</b><br><a href="mailto:${esc(x.email)}">${esc(x.email)}</a><br><span class="muted small">${esc(x.company)}${x.phone ? ' · ' + esc(x.phone) : ''}</span>${x.notes ? `<div class="muted small bk-note">${esc(x.notes)}</div>` : ''}</td>
      <td>${(x.products || []).map(p => esc(p.name)).join(', ')}</td>
      <td>${esc(x.lang)}<br><span class="muted small">${esc(x.specialist && x.specialist.name)}</span></td>
      <td class="small">${esc(x.ref)}</td>
      <td><select data-bkref="${esc(x.ref)}">${['confirmed', 'completed', 'cancelled', 'no_show'].map(s => `<option value="${s}"${s === x.status ? ' selected' : ''}>${s.replace('_', '-')}</option>`).join('')}</select></td></tr>`).join('')
      || '<tr><td colspan="6" class="muted">No bookings yet.</td></tr>';
  }
  $('#bkFilter').onchange = renderBookings;
  $('#bkRefresh').onclick = loadBookings;
  $('#bkCsv').onclick = () => {
    const cols = ['ref', 'status', 'date', 'time', 'name', 'email', 'company', 'phone', 'role', 'lang', 'specialist', 'products', 'notes', 'createdAt'];
    const val = (b, k) => k === 'specialist' ? (b.specialist && b.specialist.name) : k === 'products' ? (b.products || []).map(p => p.name).join('; ') : b[k];
    const csv = [cols.join(',')].concat(BK.map(b => cols.map(k => `"${String(val(b, k) == null ? '' : val(b, k)).replace(/"/g, '""')}"`).join(','))).join('\n');
    const a2 = document.createElement('a'); a2.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a2.download = 'remarketplace-bookings.csv'; a2.click();
  };
  $('#bkRows').addEventListener('change', async e => {
    const ref = e.target.dataset.bkref; if (!ref) return;
    try { await api('PUT', '/api/admin/bookings/' + encodeURIComponent(ref), { status: e.target.value }); toast('Booking ' + ref + ' → ' + e.target.value); loadBookings(); }
    catch (err) { toast(err.message); }
  });
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function renderBkForm() {
    const c = S.settings.booking || {};
    $('#bkForm').innerHTML = `
      <div class="two"><label>Notification email<input name="notifyEmail" value="${esc(c.notifyEmail)}"></label><label>Time zone<input name="timezone" value="${esc(c.timezone)}"></label></div>
      <div class="three"><label>Call length (min)<input name="durationMin" type="number" value="${esc(c.durationMin)}"></label><label>Bookable days ahead<input name="daysAhead" type="number" value="${esc(c.daysAhead)}"></label><label>Minimum notice (hours)<input name="minNoticeHours" type="number" value="${esc(c.minNoticeHours)}"></label></div>
      <label>Working days<div class="wd">${DAYS.map((d, i) => `<label class="wdi"><input type="checkbox" name="wd" value="${i}"${(c.workDays || []).includes(i) ? ' checked' : ''}>${d}</label>`).join('')}</div></label>
      <label>Time slots (HH:MM, comma separated)<input name="slots" value="${esc((c.slots || []).join(', '))}"></label>
      <label>Call languages offered (comma separated)<input name="languages" value="${esc((c.languages || []).join(', '))}"></label>
      <div class="ag-head"><div><b>Agents</b><small>The people customers can book. Each has their own languages, products and working hours.</small></div><button type="button" class="btn btn-ghost sm" id="addAgent">+ Add agent</button></div>
      <div id="agents"></div>`;
    renderAgents();
  }
  let AG = [];
  function renderAgents() {
    if (!AG.length && !renderAgents.init) { AG = JSON.parse(JSON.stringify((S.settings.booking || {}).specialists || [])); }
    renderAgents.init = true;
    const langs = (S.settings.booking || {}).languages || [];
    $('#agents').innerHTML = AG.map((g, i) => `<div class="ag" data-ag="${i}">
      <div class="ag-photo">${g.photo ? `<img src="${esc(g.photo)}" alt="">` : `<span>${esc((g.name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span>`}
        <label class="btn btn-ghost sm">Photo<input type="file" accept="image/*" data-agup="${i}" hidden></label><small class="muted" style="font-size:11px;text-align:center">400 × 400 px<br>square</small>${g.photo ? `<button type="button" class="link" data-agnophoto="${i}">Remove</button>` : ''}</div>
      <div class="ag-f">
        <div class="two"><label>Name *<input data-agf="name" value="${esc(g.name)}" placeholder="Full name"></label><label>Job title<input data-agf="title" value="${esc(g.title)}" placeholder="e.g. Senior Product Specialist"></label></div>
        <label>Short bio<input data-agf="bio" value="${esc(g.bio)}" placeholder="One line customers see on the booking card"></label>
        <label>Languages *<div class="wd">${langs.map(l => `<label class="wdi"><input type="checkbox" data-agl="${esc(l)}"${(g.langs || []).includes(l) ? ' checked' : ''}>${esc(l)}</label>`).join('')}</div></label>
        <label>Products they cover<div class="wd">${S.products.map(p => `<label class="wdi"><input type="checkbox" data-agp="${esc(p.slug)}"${(g.products || []).includes(p.slug) ? ' checked' : ''}>${esc(p.name)}</label>`).join('')}</div></label>
        <div class="ag-time"><label>Working days<div class="wd">${DAYS.map((d, k) => `<label class="wdi"><input type="checkbox" data-agd="${k}"${(g.days || []).includes(k) ? ' checked' : ''}>${d}</label>`).join('')}</div></label>
          <label>From<input type="time" data-agf="start" value="${esc(g.start || '09:00')}"></label><label>To<input type="time" data-agf="end" value="${esc(g.end || '17:00')}"></label></div>
        <div class="ag-foot"><label class="switch-l"><input type="checkbox" data-agf="active"${g.active !== false ? ' checked' : ''}><span class="sw"></span>Bookable</label><button type="button" class="link danger" data-agdel="${i}">Delete agent</button></div>
      </div></div>`).join('') || '<p class="muted small">No agents yet — add one so customers can book.</p>';
  }
  document.addEventListener('input', e => {
    const box = e.target.closest && e.target.closest('[data-ag]'); if (!box) return;
    const g = AG[+box.dataset.ag], t = e.target, d = t.dataset;
    if (d.agf) g[d.agf] = t.type === 'checkbox' ? t.checked : t.value;
    const toggle = (key, val) => { g[key] = g[key] || []; const i = g[key].indexOf(val); t.checked ? (i < 0 && g[key].push(val)) : (i > -1 && g[key].splice(i, 1)); };
    if (d.agl) toggle('langs', d.agl);
    if (d.agp) toggle('products', d.agp);
    if (d.agd) toggle('days', +d.agd);
  });
  document.addEventListener('change', async e => {
    const i = e.target.dataset && e.target.dataset.agup; if (i == null || !e.target.files[0]) return;
    toast('Uploading photo…');
    try { const { url } = await api('POST', '/api/admin/upload?name=agent-' + encodeURIComponent(AG[+i].name || 'photo'), null, e.target.files[0]); AG[+i].photo = url; renderAgents(); toast('Photo added — remember to save'); }
    catch (err) { toast(err.message); }
  });
  document.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'addAgent') { AG.push({ name: '', title: '', bio: '', photo: '', langs: ['English'], products: [], days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', active: true }); renderAgents(); }
    else if (t.dataset.agdel != null) { if (confirm('Delete this agent? Existing bookings keep their details.')) { AG.splice(+t.dataset.agdel, 1); renderAgents(); } }
    else if (t.dataset.agnophoto != null) { AG[+t.dataset.agnophoto].photo = ''; renderAgents(); }
  });
  $('#saveBk').onclick = async () => {
    const f = $('#bkForm'), v = n => f.querySelector(`[name="${n}"]`).value, list = n => v(n).split(',').map(x => x.trim()).filter(Boolean);
    const bad = AG.find(g => !String(g.name || '').trim() || !(g.langs || []).length);
    if (bad) return toast('Every agent needs a name and at least one language');
    S.settings.booking = {
      notifyEmail: v('notifyEmail').trim(), timezone: v('timezone').trim(), durationMin: +v('durationMin'), daysAhead: +v('daysAhead'), minNoticeHours: +v('minNoticeHours'),
      workDays: [...f.querySelectorAll('[name=wd]:checked')].map(x => +x.value), slots: list('slots'), languages: list('languages'),
      specialists: AG.map(g => Object.assign({}, g, { id: g.id || '' }))
    };
    await saveSettings('Booking settings saved');
    AG = []; renderAgents.init = false; renderBkForm();
  };

  /* ---------- Homepage default products ---------- */
  /* ---------- Homepage layout: rows of products (any count per row) ---------- */
  const H = () => { const h = S.settings.home || (S.settings.home = {}); if (!Array.isArray(h.layout)) h.layout = []; return h; };
  function renderHome() {
    const L = H().layout, used = new Set(L.flatMap(r => r.slugs));
    $('#layout').innerHTML = L.length ? L.map((r, ri) => `<div class="lay-row" data-r="${ri}">
        <div class="lay-h"><b>Row ${ri + 1}</b><span class="muted small">${r.slugs.length} product${r.slugs.length === 1 ? '' : 's'} · desktop ${Math.min(r.slugs.length, 6)} across · tablet ${Math.min(r.slugs.length, 3)} · phone ${Math.min(r.slugs.length, 2) > 1 && r.slugs.length > 1 ? '2' : '1'}</span>
          <span class="lay-a"><button class="icon" data-lmv="${ri}.-1" title="Move row up"${ri ? '' : ' disabled'}>↑</button><button class="icon" data-lmv="${ri}.1" title="Move row down"${ri < L.length - 1 ? '' : ' disabled'}>↓</button><button class="icon danger" data-ldel="${ri}" title="Delete row">✕</button></span></div>
        <div class="lay-cells" style="--n:${Math.max(1, Math.min(r.slugs.length, 6))}">${r.slugs.map((s, ci) => { const p = pBy(s); return p ? `<div class="lay-cell${p.visible ? '' : ' off'}" draggable="true" data-s="${esc(s)}">${thumb(p)}<span class="lc-n">${esc(p.name)}</span>${p.visible ? '' : '<em>hidden</em>'}
          <span class="lc-a">${ri ? `<button class="icon" data-lto="${ri}.${ci}.-1" title="Move to row ${ri}">⤒</button>` : ''}${ri < L.length - 1 ? `<button class="icon" data-lto="${ri}.${ci}.1" title="Move to row ${ri + 2}">⤓</button>` : ''}<button class="icon danger" data-lrem="${ri}.${ci}" title="Remove">✕</button></span></div>` : ''; }).join('')}
          ${r.slugs.length < 8 ? `<label class="lay-add"><select data-ladd="${ri}"><option value="">+ Add product</option>${S.products.filter(p => !used.has(p.slug)).map(p => `<option value="${esc(p.slug)}">${esc(p.name)}${p.visible ? '' : ' (hidden)'}</option>`).join('')}</select></label>` : ''}</div></div>`).join('')
      : '<p class="muted">No layout yet — pick a quick start above or add a row. Without a layout the homepage shows every product.</p>';
    document.querySelectorAll('.lay-cells').forEach(el => sortable(el, '.lay-cell', () => { const ri = +el.closest('.lay-row').dataset.r; H().layout[ri].slugs = [...el.querySelectorAll('.lay-cell')].map(x => x.dataset.s); renderHome(); }));
  }
  $('#layout').addEventListener('change', e => { const ri = e.target.dataset.ladd; if (ri == null || !e.target.value) return; H().layout[+ri].slugs.push(e.target.value); renderHome(); });
  $('#layout').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset, L = H().layout;
    if (d.lmv) { const [r, dir] = d.lmv.split('.').map(Number); [L[r], L[r + dir]] = [L[r + dir], L[r]]; }
    else if (d.ldel) L.splice(+d.ldel, 1);
    else if (d.lrem) { const [r, c] = d.lrem.split('.').map(Number); L[r].slugs.splice(c, 1); }
    else if (d.lto) { const [r, c, dir] = d.lto.split('.').map(Number); const [s] = L[r].slugs.splice(c, 1); L[r + dir].slugs.push(s); }
    else return;
    H().layout = L.filter(x => x.slugs.length || L.length === 1); renderHome();
  });
  $('#addLayoutRow').onclick = () => { H().layout.push({ slugs: [] }); renderHome(); };
  document.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
    const sizes = b.dataset.preset.split(',').map(Number), cur = H().layout.flatMap(r => r.slugs);
    const pool = [...new Set(cur.concat(S.products.filter(p => p.visible).map(p => p.slug)))];
    let i = 0; H().layout = sizes.map(n => ({ slugs: pool.slice(i, i += n) })).filter(r => r.slugs.length); renderHome();
    toast('Layout ' + sizes.join(' · ') + ' applied — adjust and Save');
  });
  $('#saveHome').onclick = () => { const h = H(); h.layout = h.layout.filter(r => r.slugs.length); h.defaultSlugs = h.layout.flatMap(r => r.slugs); h.limit = Math.max(1, h.defaultSlugs.length); saveSettings('Homepage layout saved'); renderHome(); };

  /* ---------- Overview: live status and what is missing ---------- */
  function renderOverview() {
    const P = S.products, live = P.filter(p => p.visible), todayS = todayD();
    const off = p => !p.visible || (p.showFrom && p.showFrom > todayS) || (p.showUntil && p.showUntil < todayS);
    const lay = (S.settings.home && S.settings.home.layout) || [], inLay = lay.flatMap(r => r.slugs);
    const c = S.settings.content || {}, seo = c.seo || {}, bk = S.settings.booking || {}, env = S.env || {};
    const site = [
      [env.reid, 'reID sign-in connected', 'Add REID_* values in Vercel → Environment Variables'],
      [env.smtp, 'Booking emails (SMTP)', 'Add SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM in Vercel'],
      [!env.adminDefault, 'Admin password set', 'Set ADMIN_PASSWORD in Vercel'],
      [!!seo.googleVerify, 'Google Search Console verified', 'Site content → SEO → Google verification code', 'content'],
      [!!seo.bingVerify, 'Bing Webmaster verified', 'Site content → SEO → Bing verification code', 'content'],
      [!!(c.footer && c.footer.email), 'Contact email in footer', 'Site content → Footer', 'content'],
      [!!bk.notifyEmail, 'Booking notification email', 'Bookings → Booking settings', 'bookings'],
      [(bk.specialists || []).filter(a => a.active).every(a => a.photo), 'All bookable specialists have photos', 'Bookings → Agents → Photo', 'bookings'],
      [inLay.length > 0, 'Homepage layout set', 'Homepage → Quick start or + Add row', 'rows'],
      [!inLay.some(s => { const p = P.find(x => x.slug === s); return !p || off(p); }), 'Homepage layout has no hidden products', 'Homepage → remove hidden products or switch them on', 'rows']
    ];
    const rows = P.map(p => ({ p, s: score(p) })).sort((a, b) => a.s.pct - b.s.pct);
    const avg = P.length ? Math.round(rows.reduce((t, r) => t + r.s.pct, 0) / P.length) : 0;
    $('#ovBody').innerHTML = `
      <div class="ov-kpi"><div><b>${live.length}</b><span>visible products</span></div><div><b>${P.length - live.length}</b><span>hidden</span></div><div><b>${inLay.length}</b><span>on homepage · ${lay.length} rows</span></div><div><b>${avg}%</b><span>average content complete</span></div></div>
      <h3 class="ov-h">Site setup</h3><ul class="ov-list">${site.map(([ok, l, fix, tab]) => `<li class="${ok ? 'ok' : 'no'}"><span>${ok ? '✓' : '!'}</span><b>${esc(l)}</b>${ok ? '' : `<small>${esc(fix)}</small>${tab ? `<button class="btn btn-ghost sm" data-go="${tab}">Fix</button>` : ''}`}</li>`).join('')}</ul>
      <h3 class="ov-h">Products — content to add <span class="muted small">(worst first; <b>required</b> items in red)</span></h3>
      <div class="ov-prods">${rows.map(({ p, s }) => `<div class="ov-p${p.visible ? '' : ' off'}"><div class="ov-pt">${thumb(p)}<b>${esc(p.name)}</b>${p.visible ? '' : '<em>hidden</em>'}<span class="cq ${s.must.length ? 'bad' : s.pct < 100 ? 'mid' : 'ok'}">${s.pct}%</span><button class="btn btn-ghost sm" data-ovedit="${esc(p.slug)}">Edit</button></div>
        ${s.missing.length ? `<div class="ov-miss">${s.missing.map(m => `<span class="${m.must ? 'must' : ''}">${esc(m.label)} <i>${esc(m.where)}</i></span>`).join('')}</div>` : '<div class="ov-miss"><span class="done">Everything filled in ✓</span></div>'}</div>`).join('')}</div>`;
  }
  $('#ovBody').addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) { document.querySelector(`#tabs [data-tab="${g.dataset.go}"]`).click(); return; }
    const ed = e.target.closest('[data-ovedit]'); if (ed) editFresh(ed.dataset.ovedit);
  });
  $('#ovRefresh').onclick = async () => { try { Object.assign(S, await api('GET', '/api/admin/state')); renderProducts(); renderHome(); renderOverview(); toast('Refreshed'); } catch (err) { toast(err.message); } };

  /* ---------- Site content (generic form built from the content structure) ---------- */
  const LABELS = { seo: 'SEO, social sharing & AI discovery', header: 'Header (menu, button, announcement bar)', product: 'Product page labels', booking: 'Book a demo panel', hero: 'Hero', why: 'Why reMarketplace cards', steps: 'Listing steps', usecases: 'Use cases & target market', glossary: 'Glossary & QR card', catalog: 'All products section', faq: 'FAQ', footer: 'Footer' };
  const pretty = k => ({ googleVerify: 'Google Search Console verification code', bingVerify: 'Bing Webmaster verification code', slowLabel: 'Slow option label', slowValue: 'Slow option value', fastLabel: 'Fast option label', fastValue: 'Fast option value', industries: 'Industries (comma separated)', cards: 'Cards', ogImage: 'Share image (Open Graph)', siteName: 'Site name', twitter: 'X handle', announcementLink: 'Announcement link', announcement: 'Announcement bar text (blank = hidden)', cta: 'Header button', search: 'Search placeholder', href: 'Link (URL or /#section)', label: 'Label', colTitle: 'Footer column title', railTitle: 'Panel title', railNote: 'Panel note', credsNote: 'Note under credentials', credsRequest: 'Note when no credentials', credsTitle: 'Credentials title', investCta: 'Invest button', investTitle: 'Invest title (product name follows)', investText: 'Invest text', brochureTitle: 'Brochure card title', featuredTitle: 'Featured section title', bookCta: 'Book button', demoCta: 'Demo button', model: 'Model label (blank = hidden)', cta1: 'Primary button', cta2: 'Secondary button', line2: 'Line 2', accent: 'Orange ending', prefix: 'First word', words: 'Rotating words (comma separated)', t: 'Title', d: 'Text', q: 'Question', a: 'Answer', x: 'X / Twitter URL', linkedin: 'LinkedIn URL', viewAll: '"View all" button' }[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()));
  let CT = null;
  function renderContent() {
    CT = JSON.parse(JSON.stringify(S.settings.content || {}));
    if (CT.why && Array.isArray(CT.why.items)) CT.why.items = CT.why.items.map(x => Object.assign({ icon: '' }, x));
    const field = (path, k, v) => {
      const long = String(v).length > 70 || /subtitle|description|master|white|text|tagline|^a$|^d$/.test(k);
      if (k === 'icon') return `<label>Icon<span class="ip-wrap"><button type="button" class="ip-btn" data-cicon="${path}">${RMI.render(v, 20) || '<span class="auto">Auto</span>'}</button><small>Click to choose</small></span></label>`;
      if (/image|logo/i.test(k)) return `<label>${esc(pretty(k))} <small>(1200 × 630 px · JPG/PNG · used when links are shared on social and chat apps; blank = built-in)</small><div class="inline"><input data-cp="${path}" value="${esc(v)}" placeholder="/img/og.png"><label class="btn btn-ghost sm">Upload<input type="file" accept="image/*" data-cup="${path}" hidden></label></div></label>`;
      return `<label>${esc(pretty(k))}${long ? `<textarea data-cp="${path}" rows="2">${esc(v)}</textarea>` : `<input data-cp="${path}" value="${esc(v)}">`}</label>`;
    };
    const obj = (o, base) => Object.entries(o).map(([k, v]) => {
      const p = base ? base + '.' + k : k;
      if (Array.isArray(v) && (typeof v[0] === 'string' || !v.length && k === 'words')) return `<label class="wide">${esc(pretty(k))}<input data-cp="${p}" data-list="1" value="${esc(v.join(', '))}"></label>`;
      if (Array.isArray(v)) return `<div class="ct-list wide"><div class="ct-lh"><b>${esc(pretty(k))}</b><button type="button" class="btn btn-ghost sm" data-cadd="${p}">+ Add</button></div>
        ${v.map((it, i) => `<div class="ct-item"><span class="pn">${i + 1}</span><div class="ct-if">${Object.entries(it).map(([kk, vv]) => field(`${p}.${i}.${kk}`, kk, vv)).join('')}</div>
          <div class="ct-ia"><button type="button" class="icon" data-cmv="${p}.${i}.-1" title="Up"${i ? '' : ' disabled'}>↑</button><button type="button" class="icon" data-cmv="${p}.${i}.1" title="Down"${i < v.length - 1 ? '' : ' disabled'}>↓</button><button type="button" class="icon danger" data-cdel="${p}.${i}" title="Remove">✕</button></div></div>`).join('')}</div>`;
      if (v && typeof v === 'object') return obj(v, p);
      return field(p, k, v);
    }).join('');
    $('#contentForm').innerHTML = Object.entries(CT).map(([k, v]) => `<fieldset class="box-card"><legend>${esc(LABELS[k] || k)}</legend><div class="ct-grid">${Array.isArray(v) ? obj({ [k]: v }, '').replace(/data-cp="\./g, 'data-cp="').replace(/data-c(add|mv|del)="\./g, 'data-c$1="') : obj(v, k)}</div></fieldset>`).join('');
  }
  const getP = (o, p) => p.split('.').reduce((x, k) => x[k], o);
  const setP = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((x, k) => x[k], o)[last] = v; };
  $('#contentForm').addEventListener('input', e => { const p = e.target.dataset.cp; if (!p) return; setP(CT, p, e.target.dataset.list ? e.target.value.split(',').map(x => x.trim()).filter(Boolean) : e.target.value); });
  $('#contentForm').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.cicon) { iconPicker(b, getP(CT, d.cicon), v => { setP(CT, d.cicon, v); S.settings.content = CT; renderContent(); }, 'site-icon'); return; }
    if (d.cadd) { const arr = getP(CT, d.cadd); arr.push(Object.fromEntries(Object.keys(arr[0] || { t: '', d: '' }).map(k => [k, '']))); }
    else if (d.cdel) { const ks = d.cdel.split('.'), i = +ks.pop(); getP(CT, ks.join('.')).splice(i, 1); }
    else if (d.cmv) { const ks = d.cmv.split('.'), dir = +ks.pop(), i = +ks.pop(), arr = getP(CT, ks.join('.')); [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]]; }
    else return;
    S.settings.content = CT; renderContent();
  });
  $('#contentForm').addEventListener('change', async e => {
    const p = e.target.dataset && e.target.dataset.cup; if (!p || !e.target.files[0]) return;
    toast('Uploading…');
    try { const { url } = await api('POST', '/api/admin/upload?name=og-image', null, e.target.files[0]); setP(CT, p, url); S.settings.content = CT; renderContent(); toast('Uploaded — remember to save'); } catch (err) { toast(err.message); }
  });
  $('#saveContent').onclick = async () => { S.settings.content = CT || S.settings.content; await saveSettings('Site content saved — refresh the site to see it'); renderContent(); };

  /* ---------- QR codes ---------- */
  async function renderQR() {
    if (!SITE) try { SITE = await fetch('/api/site').then(r => r.json()); } catch (_) { SITE = { siteUrl: location.origin }; }
    const q = S.settings.qr || (S.settings.qr = { mainUrl: '' }), v = Date.now();
    const target = q.mainUrl || SITE.siteUrl + '/';
    const dl = name => `<a class="btn btn-ghost sm" href="/qr/${name}.png?dl=1">PNG</a><a class="btn btn-ghost sm" href="/qr/${name}.svg?dl=1">SVG</a>`;
    $('#qrMain').innerHTML = `<img src="/qr/home.svg?v=${v}" alt="Main QR" width="150" height="150">
      <div class="qr-mi"><b>Main QR code</b><span class="muted small">Used on the homepage "Scan to explore" card.</span>
        <label>Points to<input id="qrMainUrl" value="${esc(q.mainUrl)}" placeholder="${esc(SITE.siteUrl)}/  (default: homepage)"></label>
        <span class="small">Current target: <a href="${esc(target)}" target="_blank">${esc(target)}</a></span>
        <div class="qr-acts">${dl('home')}<button class="btn btn-ghost sm" data-copy="${esc(target)}">Copy link</button><button class="btn btn-accent sm" id="saveQr">Save target</button></div></div>`;
    $('#qrGrid').innerHTML = S.products.map(p => { const url = `${SITE.siteUrl}/product/${p.slug}`; return `<div class="qr-card${p.visible ? '' : ' off'}">
      <img src="/qr/${esc(p.slug)}.svg?v=${v}" alt="" width="120" height="120" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'qr-na',textContent:'Hidden — QR off'}))">
      <b>${esc(p.name)}</b><a class="small" href="${esc(url)}" target="_blank">/product/${esc(p.slug)}</a>
      <div class="qr-acts">${p.visible ? dl(esc(p.slug)) : '<span class="muted small">Show the product to enable</span>'}</div></div>`; }).join('');
  }
  document.addEventListener('click', async e => {
    if (e.target.id === 'saveQr') { S.settings.qr = { mainUrl: $('#qrMainUrl').value.trim() }; await saveSettings('Main QR target saved'); renderQR(); }
    const c = e.target.closest('[data-copy]'); if (c && $('#tab-qr') && !$('#tab-qr').hidden) { try { navigator.clipboard.writeText(c.dataset.copy); toast('Link copied'); } catch (_) {} }
  });

  $('#indexNow').onclick = async () => {
    const b = $('#indexNow'); b.disabled = true; b.textContent = 'Submitting…';
    try { const r = await api('POST', '/api/admin/indexnow'); toast(r.ok ? `Submitted ${r.count} pages to search engines` : 'Search engines answered ' + r.status); }
    catch (err) { toast(err.message); }
    b.disabled = false; b.textContent = 'Submit all pages now';
  };

  boot();
})();
