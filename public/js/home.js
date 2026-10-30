(function () {
  const { $, esc } = RM;
  const SORTS = ['Featured', 'Fastest to deploy', 'A–Z'];
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
    $('#grid').innerHTML = list.map((p, i) => `
      <a class="card pcard" href="/product/${esc(p.slug)}" style="animation-delay:${i * 40}ms">
        ${p.image ? `<div class="pc-img"><img src="${esc(p.image)}" alt="" loading="lazy"></div>` : ''}
        <div class="card-top">${RM.mark(p)}<span class="cat-tag">${esc(p.category)}</span>${p.status ? `<span class="badge">${esc(p.status)}</span>` : ''}</div>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.tagline || p.summary)}</p>
        <div class="card-foot"><span>${p.deploy ? 'Live in ' + esc(p.deploy) : esc(p.group || '')}</span><span class="view">View product →</span></div>
      </a>`).join('');
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
  RM.loadProducts().then(list => {
    cats = ['All', ...new Set(list.map(p => p.category))];
    $('#statCount').textContent = list.length;
    renderChips(); renderGrid();
  });
})();
