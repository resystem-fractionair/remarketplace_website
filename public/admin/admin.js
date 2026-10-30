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
      renderProducts(); renderRows(); renderCats(); renderHome();
    } catch (_) { showLogin(); }
  }

  /* ---------- Tabs ---------- */
  $('#tabs').onclick = e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
    ['products', 'rows', 'content', 'cats', 'bookings', 'qr'].forEach(t => { $('#tab-' + t).hidden = t !== b.dataset.tab; });
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
        <div class="pi-rows">${sched(p)}${inRows(p.slug).map(r => `<span>${r}</span>`).join('')}</div>
        <label class="switch" title="Show on site"><input type="checkbox" data-vis="${esc(p.slug)}"${p.visible ? ' checked' : ''}><span class="sw"></span></label>
        <button class="btn btn-ghost sm" data-edit="${esc(p.slug)}">Edit</button>
      </div>`).join('') || '<p class="muted">No products match.</p>';
  }
  $('#pq').oninput = e => { S.q = e.target.value; renderProducts(); };
  $('#pcat').onchange = e => { S.cat = e.target.value; renderProducts(); };
  $('#plist').addEventListener('change', async e => {
    const slug = e.target.dataset.vis; if (!slug) return;
    const p = S.products.find(x => x.slug === slug);
    p.visible = e.target.checked; renderProducts();
    try { await api('PUT', '/api/admin/products/' + encodeURIComponent(slug), p); toast(`${p.name} is now ${p.visible ? 'visible' : 'hidden'}`); }
    catch (err) { toast(err.message); p.visible = !p.visible; renderProducts(); }
  });
  $('#plist').addEventListener('click', e => { const b = e.target.closest('[data-edit]'); if (b) openEditor(b.dataset.edit); });
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

  /* ---------- Editor ---------- */
  let editing = null;
  const LISTS = [['features', 'Key features'], ['whyPoints', 'Why points'], ['whatYouCanDo', 'What you can do'], ['useCases', 'Use cases'], ['stats', 'Stats chips (e.g. 99.9% uptime)']];
  const IMAGES = [['image', 'Card image (catalog + banner, 16:9)'], ['hero', 'Banner image override (wide)'], ['logo', 'Logo / icon (square)']];
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
      <fieldset><legend>SEO & sharing (optional)</legend><p class="muted small">Overrides the page title and search/social description. The card image is used as the share image.</p>
        ${field('seoTitle', 'SEO title', p.seoTitle || '', 'placeholder="' + esc(p.name || '') + ' — ' + esc(p.tagline || '') + '"')}
        ${area('seoDescription', 'SEO description (≈155 characters)', p.seoDescription || '', 2)}</fieldset>
      <fieldset><legend>Images</legend><div class="img-grid">${IMAGES.map(([k, l]) => `
        <div class="img-f" data-img="${k}"><span class="lbl">${esc(l)}</span>
          <div class="prev">${p[k] ? `<img src="${esc(p[k])}" alt="">` : '<span>No image</span>'}</div>
          <input name="${k}" value="${esc(p[k] || '')}" placeholder="Paste URL or upload">
          <div class="img-a"><label class="btn btn-ghost sm">Upload<input type="file" accept="image/*" data-up="${k}" hidden></label><button type="button" class="btn btn-ghost sm" data-clear="${k}">Remove</button></div>
        </div>`).join('')}</div></fieldset>
      <fieldset><legend>Links, demo access & brochures</legend>${LINKS.map(([k, l]) => k.startsWith('pdf')
        ? `<label>${esc(l)}<div class="inline"><input name="${k}" value="${esc(p[k] || '')}"><label class="btn btn-ghost sm">Upload PDF<input type="file" accept="application/pdf" data-up="${k}" hidden></label></div></label>`
        : field(k, l, p[k] || '')).join('')}</fieldset>
      <fieldset><legend>Page content</legend><p class="muted small">One item per line.</p>
        ${LISTS.map(([k, l]) => area(k, l, (p[k] || []).join('\n'), 4)).join('')}
        ${area('highlights', 'Highlights', (p.highlights || []).map(h => h.title + ' | ' + h.text).join('\n'), 4, 'Title | description — one per line')}
      </fieldset>
      <fieldset><legend>Sandbox / demo credentials</legend>
        <p class="muted small">Shown on the product page with Copy buttons and a TEST DATA badge. The Demo URL row comes from the Demo URL field above.</p>
        ${area('demoCreds', 'Credentials', (p.demoCreds || []).map(c => c.label + ' | ' + c.value).join('\n'), 5, 'Label | value — one per line, e.g. Test email | demo@yourapp.io')}
      </fieldset></div>`;
    document.body.classList.add('lock'); $('#edOv').hidden = false;
  }
  const closeEditor = () => { $('#edOv').hidden = true; document.body.classList.remove('lock'); };
  $('#edOv').addEventListener('click', e => { if (e.target.id === 'edOv' || e.target.closest('[data-close]')) closeEditor(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#edOv').hidden) closeEditor(); });

  $('#edForm').addEventListener('input', e => {
    if (e.target.name === 'name' && !editing.orig) $('#edForm').slug.value = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const box = e.target.closest('.img-f');
    if (box && e.target.tagName === 'INPUT') box.querySelector('.prev').innerHTML = e.target.value ? `<img src="${esc(e.target.value)}" alt="">` : '<span>No image</span>';
  });
  $('#edForm').addEventListener('click', e => {
    const k = e.target.dataset && e.target.dataset.clear; if (!k) return;
    const box = e.target.closest('.img-f'); box.querySelector('input[name]').value = ''; box.querySelector('.prev').innerHTML = '<span>No image</span>';
  });
  $('#edForm').addEventListener('change', async e => {
    const k = e.target.dataset.up; if (!k || !e.target.files[0]) return;
    const f = e.target.files[0];
    if (f.size > 8 * 1024 * 1024) return toast('File is over 8 MB');
    toast('Uploading…');
    try {
      const { url } = await api('POST', '/api/admin/upload?name=' + encodeURIComponent(($('#edForm').slug.value || 'product') + '-' + k), null, f);
      $('#edForm').querySelector(`[name="${k}"]`).value = url;
      const box = e.target.closest('.img-f'); if (box) box.querySelector('.prev').innerHTML = `<img src="${esc(url)}" alt="">`;
      toast('Uploaded — remember to save');
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
    p.visible = f.visible.checked;
    return p;
  }
  $('#edSave').onclick = async () => {
    const p = readForm();
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
    const src = readForm(), base = (src.slug || 'product') + '-copy';
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
    renderBookings(); renderBkForm();
  }
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
        <label class="btn btn-ghost sm">Photo<input type="file" accept="image/*" data-agup="${i}" hidden></label>${g.photo ? `<button type="button" class="link" data-agnophoto="${i}">Remove</button>` : ''}</div>
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
  function renderHome() {
    const h = S.settings.home || (S.settings.home = { defaultSlugs: [], limit: 6 });
    $('#homeLimit').value = h.limit;
    $('#homeChips').innerHTML = h.defaultSlugs.map((s, i) => { const p = pBy(s); return p ? `<div class="pchip${p.visible ? '' : ' off'}${i >= h.limit ? ' over' : ''}" draggable="true" data-s="${esc(s)}"><span class="pn">${i + 1}</span>${thumb(p)}<span>${esc(p.name)}${p.visible ? '' : ' <em>(hidden)</em>'}</span><button data-hrem="${esc(s)}" title="Remove">×</button></div>` : ''; }).join('')
      || '<span class="muted small">No default products — the homepage will show every product.</span>';
    $('#homeAdd').innerHTML = '<option value="">+ Add a product…</option>' + S.products.filter(p => !h.defaultSlugs.includes(p.slug)).map(p => `<option value="${esc(p.slug)}">${esc(p.name)} — ${esc(p.category)}</option>`).join('');
  }
  sortable($('#homeChips'), '.pchip', () => { S.settings.home.defaultSlugs = [...document.querySelectorAll('#homeChips .pchip')].map(el => el.dataset.s); renderHome(); });
  $('#homeAdd').onchange = e => { if (e.target.value) { S.settings.home.defaultSlugs.push(e.target.value); renderHome(); } };
  $('#homeChips').addEventListener('click', e => { const b = e.target.closest('[data-hrem]'); if (b) { S.settings.home.defaultSlugs = S.settings.home.defaultSlugs.filter(s => s !== b.dataset.hrem); renderHome(); } });
  $('#homeLimit').oninput = e => { S.settings.home.limit = Math.max(1, Math.min(24, +e.target.value || 6)); renderHome(); };
  $('#saveHome').onclick = () => saveSettings('Default products saved');

  /* ---------- Site content (generic form built from the content structure) ---------- */
  const LABELS = { seo: 'SEO, social sharing & AI discovery', header: 'Header (menu, button, announcement bar)', product: 'Product page labels', booking: 'Book a demo panel', hero: 'Hero', why: 'Why reMarketplace cards', steps: 'Listing steps', usecases: 'Use cases & target market', glossary: 'Glossary & QR card', catalog: 'All products section', faq: 'FAQ', footer: 'Footer' };
  const pretty = k => ({ googleVerify: 'Google Search Console verification code', bingVerify: 'Bing Webmaster verification code', slowLabel: 'Slow option label', slowValue: 'Slow option value', fastLabel: 'Fast option label', fastValue: 'Fast option value', industries: 'Industries (comma separated)', cards: 'Cards', ogImage: 'Share image (Open Graph)', siteName: 'Site name', twitter: 'X handle', announcementLink: 'Announcement link', announcement: 'Announcement bar text (blank = hidden)', cta: 'Header button', search: 'Search placeholder', href: 'Link (URL or /#section)', label: 'Label', colTitle: 'Footer column title', railTitle: 'Panel title', railNote: 'Panel note', credsNote: 'Note under credentials', credsRequest: 'Note when no credentials', credsTitle: 'Credentials title', investCta: 'Invest button', investTitle: 'Invest title (product name follows)', investText: 'Invest text', brochureTitle: 'Brochure card title', featuredTitle: 'Featured section title', bookCta: 'Book button', demoCta: 'Demo button', model: 'Model label (blank = hidden)', cta1: 'Primary button', cta2: 'Secondary button', line2: 'Line 2', accent: 'Orange ending', prefix: 'First word', words: 'Rotating words (comma separated)', t: 'Title', d: 'Text', q: 'Question', a: 'Answer', x: 'X / Twitter URL', linkedin: 'LinkedIn URL', viewAll: '"View all" button' }[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()));
  let CT = null;
  function renderContent() {
    CT = JSON.parse(JSON.stringify(S.settings.content || {}));
    const field = (path, k, v) => {
      const long = String(v).length > 70 || /subtitle|description|master|white|text|tagline|^a$|^d$/.test(k);
      if (/image|logo/i.test(k)) return `<label>${esc(pretty(k))} <small>(1200×630 recommended; blank = built-in)</small><div class="inline"><input data-cp="${path}" value="${esc(v)}" placeholder="/img/og.png"><label class="btn btn-ghost sm">Upload<input type="file" accept="image/*" data-cup="${path}" hidden></label></div></label>`;
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
  let SITE = null;
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
