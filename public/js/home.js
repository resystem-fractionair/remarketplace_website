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
  const FAQS = [
    { q: 'What does “pre-built” actually mean?', a: 'Each product is a running system — backend, admin console, APIs and front-end — already built, tested and deployed. You configure it, apply your brand, connect your data and go live. Nothing is written from scratch.' },
    { q: 'How long until we are live?', a: 'Between three days and three weeks depending on the product. A white-label vertical marketplace takes about three weeks.' },
    { q: 'Whose brand does the customer see?', a: 'Yours only. Domains, logo, colours, emails and documentation all ship under your brand name.' },
    { q: 'Can we run more than one product together?', a: 'Yes. Products share one identity layer (reID), one ledger on INFRA Network and one admin console, so they behave like a single platform.' },
    { q: 'Can I list my own product?', a: 'Yes. Have the ReSystem team build your master label, or upgrade an existing B2C product into one, and list it here for other businesses to license.' },
    { q: 'Do we get the source code?', a: 'Source access and self-hosting are available on enterprise agreements. Most customers stay on the managed deployment, which includes updates, monitoring and support.' },
    { q: 'Can I invest in a product?', a: 'Several products offer on-chain shares through the ReSystem Business Opportunity programme. Each product page links to its investment opportunity where one exists.' }
  ];
  const days = s => (parseInt(s, 10) || 99) * (/week/.test(s || '') ? 7 : 1);
  const st = { q: '', cat: 'All', sort: 'Featured', faq: 0 };
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
    $('#count').textContent = `${list.length} of ${all.length} products`;
    $('#empty').hidden = list.length > 0;
    $('#grid').innerHTML = list.map(card).join('');
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
    if (d.cat) { st.cat = d.cat; renderChips(); renderGrid(); }
    else if (d.sort) { st.sort = d.sort; renderChips(); renderGrid(); }
    else if (d.faq) { st.faq = st.faq === +d.faq ? -1 : +d.faq; renderFaq(); }
  });
  $('#q').addEventListener('input', e => { st.q = e.target.value; renderGrid(); });
  $('#q').addEventListener('focus', () => { if (scrollY < 200) document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' }); });

  renderFaq();

  /* ---------- Animated hero ---------- */
  function hero(list) {
    const words = ['fintech', 'identity', 'Web3', 'wallet', 'investment', 'AI'];
    const rot = $('#hxRot'); let w = 0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* measure each word once; the box eases to the next word's width so the line never jumps or overlaps */
    const widthOf = txt => { const m = document.createElement('span'); m.className = 'hx-measure'; m.textContent = txt; rot.appendChild(m); const x = m.getBoundingClientRect().width; m.remove(); return Math.ceil(x) + 2; };
    const setW = () => { rot.style.width = widthOf(words[w]) + 'px'; };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(setW);
    addEventListener('resize', setW);
    const step = () => {
      if (document.hidden) return setTimeout(step, 1000);
      w = (w + 1) % words.length;
      const cur = rot.querySelector('.cur'), n = document.createElement('span');
      n.textContent = words[w]; n.className = 'cur in';
      if (cur) { cur.className = 'out'; setTimeout(() => cur.remove(), 700); }
      rot.appendChild(n); setW();
      setTimeout(step, 2800);
    };
    rot.firstElementChild.className = 'cur';
    if (!reduce) setTimeout(step, 2800);
    /* count-up */
    $('#statCount').dataset.count = list.length;
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; io.unobserve(e.target);
      const el = e.target, to = +el.dataset.count, dec = +(el.dataset.dec || 0), t0 = performance.now(), dur = reduce ? 1 : 1400;
      const f = now => { const k = Math.min(1, (now - t0) / dur), v = to * (1 - Math.pow(1 - k, 3));
        el.textContent = (el.dataset.sep ? Math.round(v).toLocaleString('en') : v.toFixed(dec)) + (el.dataset.suffix || ''); if (k < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }));
    document.querySelectorAll('.hx-stats [data-count]').forEach(el => io.observe(el));
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
  fetch('/api/home').then(r => r.json()).then(home => {
    const list = RM.products = home.products;
    cats = ['All', ...home.categories];
    hero(list);
    $('#homeRows').innerHTML = '' && home.rows.map(r => `
      <section class="wrap hrow">
        <div class="cat-head"><div><h2>${esc(r.title)}</h2>${r.subtitle ? `<p class="muted">${esc(r.subtitle)}</p>` : ''}</div></div>
        <div class="grid">${r.products.map(card).join('')}</div>
      </section>`).join('');
    $('#catalog').hidden = !home.showCatalog;
    renderChips(); renderGrid();
  });
})();
