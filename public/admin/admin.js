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
    try { await api('POST', '/api/admin/login', { password: $('#pw').value }); $('#pw').value = ''; boot(); }
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
      renderProducts(); renderRows(); renderCats();
    } catch (_) { showLogin(); }
  }

  /* ---------- Tabs ---------- */
  $('#tabs').onclick = e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
    ['products', 'rows', 'cats'].forEach(t => { $('#tab-' + t).hidden = t !== b.dataset.tab; });
  };

  /* ---------- Products list ---------- */
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
        <div class="pi-rows">${inRows(p.slug).map(r => `<span>${r}</span>`).join('')}</div>
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
  const LINKS = [['externalUrl', 'Live site'], ['demoUrl', 'Demo URL (login page)'], ['demoEmail', 'Demo login — email / username'], ['demoPassword', 'Demo login — password'], ['demoNote', 'Demo note (e.g. resets nightly)'], ['investUrl', 'Investment opportunity URL'], ['pdfDesktop', 'Brochure PDF — desktop'], ['pdfMobile', 'Brochure PDF — mobile'], ['sourceUrl', 'resystem.org page']];
  const field = (k, label, v, attrs) => `<label>${esc(label)}<input name="${k}" value="${esc(v)}" ${attrs || ''}></label>`;
  const area = (k, label, v, rows, hint) => `<label>${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ''}<textarea name="${k}" rows="${rows || 4}">${esc(v)}</textarea></label>`;
  const select = (k, label, v, opts) => `<label>${esc(label)}<select name="${k}">${opts.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;

  function openEditor(slug) {
    const p = slug ? S.products.find(x => x.slug === slug) : { name: '', slug: '', visible: false, tone: 'a', category: S.settings.categories[0] || '', group: S.settings.groups[0] || '' };
    editing = { orig: slug, p };
    $('#edTitle').textContent = slug ? 'Edit ' + p.name : 'New product';
    $('#edDel').hidden = !slug;
    $('#edView').hidden = !slug; $('#edView').href = '/product/' + (slug || '');
    const cats = [...new Set(['', ...S.settings.categories, p.category || ''])];
    const groups = [...new Set(['', ...S.settings.groups, p.group || ''])];
    $('#edForm').innerHTML = `
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
      </fieldset>`;
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
    ['name', 'slug', 'tagline', 'category', 'group', 'status', 'deploy', 'price', 'summary', 'whatItIs', 'tone',
      ...IMAGES.map(x => x[0]), ...LINKS.map(x => x[0])].forEach(k => { p[k] = v(k).trim(); });
    LISTS.forEach(([k]) => { p[k] = v(k).split('\n').map(s => s.trim()).filter(Boolean); });
    p.highlights = v('highlights').split('\n').map(s => s.trim()).filter(Boolean).map(s => { const [t, ...rest] = s.split('|'); return { title: t.trim(), text: rest.join('|').trim() }; });
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

  boot();
})();
