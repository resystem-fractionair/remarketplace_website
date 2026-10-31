/* Homepage: hero (rotating word, network canvas, white-label motion graphic), site content from the admin,
   curated catalog with "View all", section reveal/step animations and the FAQ. Data: GET /api/home. */
(function () {
  const { $, esc } = RM;
  const SORTS = ['Featured', 'Fastest to deploy', 'A–Z'];
  const card = (p, i) => `
      <a class="card pcard" href="/product/${esc(p.slug)}" style="animation-delay:${i * 40}ms">
        ${p.image ? `<div class="pc-img"><img src="${esc(p.image)}" alt="" loading="lazy"></div>` : `<div class="pc-img pc-ph">${RM.mark(p)}</div>`}
        <div class="card-top">${RM.mark(p)}<span class="cat-tag">${esc(p.category)}</span>${p.status ? `<span class="badge">${esc(p.status)}</span>` : ''}</div>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.tagline || p.summary)}</p>
        <div class="card-foot"><span>${p.deploy ? 'Live in ' + esc(p.deploy) : esc(p.group || '')}</span><span class="view">View product →</span></div>
      </a>`;
  let FAQS = [], C = null, HOME = { layout: [] };
  const days = s => (parseInt(s, 10) || 99) * (/week/.test(s || '') ? 7 : 1);
  const st = { q: '', cat: 'All', sort: 'Featured', faq: 0, all: false };
  let cats = ['All'];

  function renderChips() {
    $('#cats').innerHTML = cats.map(c => `<button class="chip${c === st.cat ? ' on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    $('#sorts').innerHTML = SORTS.map(s => `<button class="chip${s === st.sort ? ' on' : ''}" data-sort="${esc(s)}">${esc(s)}</button>`).join('');
  }
  function renderGrid() {
    const all = RM.products, q = st.q.trim().toLowerCase();
    let list = all.filter(p => (st.cat === 'All' || p.category === st.cat) &&
      (!q || [p.name, p.category, p.tagline, p.summary].join(' ').toLowerCase().includes(q)));
    if (st.sort === 'A–Z') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (st.sort === 'Fastest to deploy') list.sort((a, b) => days(a.deploy) - days(b.deploy));
    /* default view: the rows built in Admin → Homepage layout (any number of products per row) */
    const bySlug = s => all.find(p => p.slug === s);
    const rows = (HOME.layout || []).map(r => r.slugs.map(bySlug).filter(Boolean)).filter(r => r.length);
    const curated = st.cat === 'All' && !q && !st.all && st.sort === 'Featured' && rows.length > 0;
    const g = $('#grid');
    if (curated) {
      const shown = rows.flat();
      $('#count').textContent = `Showing ${shown.length} of ${all.length} products`;
      $('#empty').hidden = true;
      g.className = 'hrows';
      let i = 0;
      g.innerHTML = rows.map(r => `<div class="hrow" style="--nd:${Math.min(r.length, 6)};--nt:${Math.min(r.length, 3)};--ns:${Math.min(r.length, 2)}">${r.map(p => card(p, i++)).join('')}</div>`).join('');
      list = shown;
    } else {
      $('#count').textContent = `${list.length} of ${all.length} products`;
      $('#empty').hidden = list.length > 0;
      g.className = 'grid';
      g.innerHTML = list.map(card).join('');
    }
    const va = $('#viewAll');
    if (va) { va.hidden = !(curated && list.length < all.length) && !(st.all && st.cat === 'All' && !q && rows.length);
      va.textContent = st.all ? 'Show featured only' : `${(C && C.catalog.viewAll) || 'View all products'} (${all.length})`; }
  }
  function renderFaq() {
    $('#faqs').innerHTML = FAQS.map((f, i) => `
      <div class="faq-item${st.faq === i ? ' open' : ''}">
        <button class="faq-q" data-faq="${i}" aria-expanded="${st.faq === i}"><span class="num">${String(i + 1).padStart(2, '0')}</span><span class="qt">${esc(f.q)}</span><span class="sign">${st.faq === i ? '–' : '+'}</span></button>
        <div class="faq-a"><p>${esc(f.a)}</p></div>
      </div>`).join('');
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    const d = t.dataset;
    if (t.id === 'viewAll') { st.all = !st.all; renderGrid(); if (!st.all) document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' }); return; }
    if (d.cat) { st.cat = d.cat; renderChips(); renderGrid(); }
    else if (d.sort) { st.sort = d.sort; renderChips(); renderGrid(); }
    else if (d.faq) { st.faq = st.faq === +d.faq ? -1 : +d.faq; renderFaq(); }
  });
  $('#q').addEventListener('input', e => { st.q = e.target.value; renderGrid(); });
  $('#q').addEventListener('focus', () => { if (scrollY < 200) document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' }); });

  renderFaq();

  /* ---------- Section motion: reveal on scroll + running step highlight ---------- */
  const motion = () => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = document.querySelectorAll('.wx-card, .lx-track li, .gx-card, .gx-arrow, .gx-qr, .wx-head, .ux-card, .ux-mq');
    els.forEach((el, i) => { el.classList.add('rv'); el.style.setProperty('--d', (([...el.parentNode.children].indexOf(el)) * 90) + 'ms'); });
    if (reduce) { els.forEach(el => el.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .2 });
    els.forEach(el => io.observe(el));
    const track = document.querySelector('.lx-track'); if (!track) return;
    const items = [...track.children]; let k = 0, timer = null;
    const run = () => { items.forEach((li, i) => li.classList.toggle('lx-act', i === k)); items.forEach((li, i) => li.classList.toggle('lx-done', i < k)); k = (k + 1) % (items.length + 1); };
    new IntersectionObserver(([e]) => { if (e.isIntersecting && !timer) { run(); timer = setInterval(run, 1100); } else if (!e.isIntersecting && timer) { clearInterval(timer); timer = null; } }, { threshold: .3 }).observe(track);
  };

  /* ---------- Animated hero ---------- */
  function hero(list) {
    const words = (C && C.hero.words.length) ? C.hero.words : ['fintech'];
    const rot = $('#hxRot'); let w = 0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* measure each word once; the box eases to the next word's width so the line never jumps or overlaps */
    const widthOf = txt => { const m = document.createElement('span'); m.className = 'hx-measure'; m.textContent = txt; rot.appendChild(m); const x = m.getBoundingClientRect().width; m.remove(); return Math.ceil(x) + 2; };
    /* box is always as wide as the longest word, so the rest of the headline never moves */
    const setW = () => { rot.style.width = Math.max(...words.map(widthOf)) + 'px'; };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(setW);
    addEventListener('resize', setW);
    const step = () => {
      if (document.hidden) return setTimeout(step, 1000);
      w = (w + 1) % words.length;
      const cur = rot.querySelector('.cur'), n = document.createElement('span');
      n.textContent = words[w]; n.className = 'cur in';
      if (cur) { cur.className = 'out'; setTimeout(() => cur.remove(), 700); }
      rot.appendChild(n);
      setTimeout(step, 2800);
    };
    rot.firstElementChild.className = 'cur';
    if (!reduce) setTimeout(step, 2800);
    /* count-up */
    if ($('#statCount')) $('#statCount').dataset.count = list.length;
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; io.unobserve(e.target);
      const el = e.target, to = +el.dataset.count, dec = +(el.dataset.dec || 0), t0 = performance.now(), dur = reduce ? 1 : 1400;
      const f = now => { const k = Math.min(1, (now - t0) / dur), v = to * (1 - Math.pow(1 - k, 3));
        el.textContent = (el.dataset.sep ? Math.round(v).toLocaleString('en') : v.toFixed(dec)) + (el.dataset.suffix || ''); if (k < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }));
    document.querySelectorAll('.hx-stats [data-count]').forEach(el => io.observe(el));
    /* white-label motion graphic: one master app, re-branded on a loop */
    const brands = [
      { n: 'NovaPay', d: 'app.novapay.io', c: '#F7541D', cur: 'AED', bal: 248930, u: '12.4k' },
      { n: 'Atlas ID', d: 'id.atlas.app', c: '#2B6BFF', cur: 'USD', bal: 91420, u: '38.1k' },
      { n: 'Verde Wealth', d: 'verde.finance', c: '#1F9D6B', cur: 'EUR', bal: 1204500, u: '4.9k' },
      { n: 'Zenith Estates', d: 'invest.zenith.ae', c: '#8B5CF6', cur: 'AED', bal: 5630000, u: '2.2k' }
    ];
    const viz = $('#hxViz'); let bi = 0;
    const steps = [...document.querySelectorAll('#hvSteps li')];
    const show = () => {
      const x = brands[bi];
      viz.style.setProperty('--brand', x.c);
      viz.classList.remove('swap'); void viz.offsetWidth; viz.classList.add('swap');
      const masked = x.n.replace(/\s+/g, '').slice(0, 2) + '#'.repeat(Math.max(3, x.n.replace(/\s+/g, '').length - 2));
      $('#hvName').textContent = masked; $('#hvLogo').textContent = x.n.slice(0, 2);
      $('#hvCur').textContent = x.cur; $('#hvUsers').textContent = x.u;
      const el = $('#hvBal'), t0 = performance.now(), to = x.bal;
      const tick = now => { const k = Math.min(1, (now - t0) / 900); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('en'); if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      steps.forEach((s, i) => { s.className = ''; setTimeout(() => { s.className = 'on'; }, 300 + i * 550); });
    };
    show();
    if (!reduce) setInterval(() => { if (!document.hidden) { bi = (bi + 1) % brands.length; show(); } }, 4200);

    /* network canvas background: drifting nodes, links and travelling packets */
    const cv = $('#hxNet'), ctx = cv.getContext('2d');
    let W = 0, H = 0, nodes = [], packets = [], mx = -999, my = -999, dpr = Math.min(2, devicePixelRatio || 1);
    const size = () => {
      const r = cv.parentElement.getBoundingClientRect(); W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, Math.max(28, W * H / 16000)));
      nodes = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25, r: 1.2 + Math.random() * 2, hub: Math.random() < .12 }));
    };
    size(); addEventListener('resize', size);
    const dark = () => document.documentElement.getAttribute('data-theme') === 'dark';
    const LINK = 150;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const dk = dark(), line = dk ? '255,140,100' : '247,84,29', dot = dk ? 'rgba(255,170,140,.85)' : 'rgba(194,66,26,.75)';
      for (const p of nodes) {
        if (!reduce) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; }
        const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy);
        if (d < 120 && d > 0) { p.x += dx / d * .6; p.y += dy / d * .6; }
      }
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], c = nodes[j], d = Math.hypot(a.x - c.x, a.y - c.y);
        if (d < LINK) { ctx.strokeStyle = `rgba(${line},${(1 - d / LINK) * .28})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
          if (!reduce && packets.length < 18 && Math.random() < .0009) packets.push({ a, c, t: 0 }); }
      }
      for (const p of nodes) { ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(p.x, p.y, p.hub ? p.r + 1.5 : p.r, 0, 6.283); ctx.fill();
        if (p.hub) { ctx.strokeStyle = `rgba(${line},.25)`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6, 0, 6.283); ctx.stroke(); } }
      packets = packets.filter(k => (k.t += .012) < 1);
      for (const k of packets) { const x = k.a.x + (k.c.x - k.a.x) * k.t, y = k.a.y + (k.c.y - k.a.y) * k.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 8); g.addColorStop(0, `rgba(${line},.95)`); g.addColorStop(1, `rgba(${line},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 8, 0, 6.283); ctx.fill(); }
      if (!reduce && running) requestAnimationFrame(draw);
    };
    let running = true;
    new IntersectionObserver(([e]) => { const was = running; running = e.isIntersecting; if (running && !was) requestAnimationFrame(draw); }).observe(cv);
    document.querySelector('.hx').addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
    document.querySelector('.hx').addEventListener('pointerleave', () => { mx = my = -999; });
    requestAnimationFrame(draw);

  }
  /* ---------- Site content from Admin → Site content ---------- */
  const IC = [
    '<path d="M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>', '<path d="M4 17l5-5 4 4 7-8"/><path d="M15 8h5v5"/>',
    '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'];
  const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const set = (sel, v) => { const el = $(sel); if (el && v != null) el.textContent = v; };
  function apply(c, count) {
    if (!c) return;
    if (c.seo.title) document.title = c.seo.title;
    const md = document.querySelector('meta[name="description"]'); if (md && c.seo.description) md.setAttribute('content', c.seo.description);
    const h = c.hero;
    set('.hx-copy > .eyebrow', h.eyebrow);
    $('#hxRot').innerHTML = `<span>${esc(h.words[0] || '')}</span>`;
    const l1 = $('.hx-l1'); if (l1) l1.firstChild.textContent = h.prefix + ' ';
    const h1 = $('.hx h1'); if (h1) { h1.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = h.line2 + ' '; }); }
    set('.hx h1 em', h.accent); set('.hx-copy > p', h.subtitle);
    const ctas = document.querySelectorAll('.hx-copy .hero-cta .btn'); if (ctas[0]) ctas[0].textContent = h.cta1; if (ctas[1]) ctas[1].textContent = h.cta2;
    $('.hx-stats').innerHTML = h.stats.map((x, i) => { const v = x.value || (i === 0 ? String(count) : '0'); const dec = (v.split('.')[1] || '').length;
      return `<div><b data-count="${esc(v)}" data-dec="${dec}" data-suffix="${esc(x.suffix)}"${+v >= 1000 ? ' data-sep="1"' : ''}${i === 0 && !x.value ? ' id="statCount"' : ''}>0</b><span>${esc(x.label)}</span></div>`; }).join('');
    const w = c.why;
    set('#why .wx-head .eyebrow', w.eyebrow); set('#why .wx-head h2', w.title);
    $('#why .wx-grid').innerHTML = w.items.map((x, i) => `<article class="wx-card"><span class="wx-ic">${(x.icon && window.RMI && RMI.render(x.icon, 22)) || svg(IC[i % IC.length])}</span><h3>${esc(x.t)}</h3><p>${esc(x.d)}</p></article>`).join('');
    const sp = c.steps;
    set('.lx .wx-head .eyebrow', sp.eyebrow); set('.lx .wx-head h2', sp.title); set('.lx .wx-head p', sp.subtitle);
    $('.lx-track').innerHTML = sp.items.map((x, i) => `<li><span class="lx-n">${String(i + 1).padStart(2, '0')}</span><b>${esc(x.t)}</b><small>${esc(x.d)}</small></li>`).join('');
    const g = c.glossary;
    set('.gx-master .gx-tag', g.masterTitle); set('.gx-master p', g.master); set('.gx-arrow em', g.arrow);
    set('.gx-white .gx-tag', g.whiteTitle); set('.gx-white p', g.white); set('.gx-qr b', g.qrTitle); set('.gx-qr div span', g.qrText);
    const u = c.usecases;
    if (u) {
      set('#uxEye', u.eyebrow); set('#uxTitle', u.title);
      u.cards.slice(0, 3).forEach((x, i) => { set(`#uxC${i} h3`, x.t); set(`#uxC${i} p`, x.d); });
      const bl = document.querySelectorAll('#uxC2 .ux-bl'), bv = document.querySelectorAll('#uxC2 .ux-bv');
      if (bl[0]) { bl[0].textContent = u.compare.slowLabel; bv[0].textContent = u.compare.slowValue; bl[1].textContent = u.compare.fastLabel; bv[1].textContent = u.compare.fastValue; }
      const chip = (x, i) => `<span class="ux-chip"><em>${String(i + 1).padStart(2, '0')}</em>${esc(x)}</span>`;
      const half = Math.ceil(u.industries.length / 2), a = u.industries.slice(0, half), b = u.industries.slice(half);
      $('#uxR1').innerHTML = (a.map(chip).join('')).repeat(3); $('#uxR2').innerHTML = (b.map((x, i) => chip(x, i + half)).join('')).repeat(3);
    }
    set('#catalog .cat-head h2', c.catalog.title); set('#catalog > .small', c.catalog.note);
    FAQS = c.faq; renderFaq();
  }

  fetch('/api/home').then(r => r.json()).then(home => {
    const list = RM.products = home.products;
    C = home.content; HOME = home.home || HOME;
    cats = ['All', ...home.categories];
    apply(C, list.length);
    hero(list);
    motion();
    $('#catalog').hidden = !home.showCatalog;
    renderChips(); renderGrid();
  });
})();
