/* Product page — template A: marketplace listing (header card, banner, section nav, details panel) */
(function () {
  const { $, esc } = RM;
  const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
  const host = u => { try { return new URL(u, location.origin).host.replace(/^www\./, ''); } catch (_) { return u; } };
  const has = a => Array.isArray(a) && a.length > 0;

  function render(p, all) {
    document.title = `${p.name} — reMarketplace`;
    const md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', p.summary || p.tagline || '');
    const pageUrl = location.origin + '/product/' + p.slug;
    const demo = p.demoUrl || p.externalUrl;
    const soon = /soon/i.test(p.status || '');
    const banner = p.hero || p.image;
    const bookLbl = soon ? 'Join early access' : 'Book a demo';
    const related = all.filter(x => x.slug !== p.slug && x.category === p.category)
      .concat(all.filter(x => x.slug !== p.slug && x.category !== p.category && x.group === p.group)).slice(0, 4);

    /* Features: use highlight descriptions when titles match, else plain titles */
    const hlBy = new Map((p.highlights || []).map(h => [h.title.toLowerCase(), h.text]));
    const features = (p.features || []).map(f => ({ t: f, d: hlBy.get(f.toLowerCase()) || '' }));
    const extraHl = (p.highlights || []).filter(h => !(p.features || []).some(f => f.toLowerCase() === h.title.toLowerCase()));
    const pdfMobile = p.pdfMobile && p.pdfMobile !== p.pdfDesktop ? p.pdfMobile : '';

    const tabs = [['overview', 'Overview'], (features.length || extraHl.length) && ['features', 'Features'],
      has(p.useCases) && ['use-cases', 'Use cases'], (demo || p.pdfDesktop) && ['resources', 'Resources'], p.investUrl && ['invest', 'Invest']].filter(Boolean);

    const details = [['Category', p.category], ['Ecosystem', p.group], ['Go-live', p.deploy], ['Pricing', p.price || 'On request'],
      ['Live site', demo ? `<a href="${esc(demo)}" target="_blank" rel="noopener">${esc(host(demo))} ↗</a>` : '', true]].filter(d => d[1]);

    $('#pMain').innerHTML = `
    <div class="wrap pa">
      <div class="crumbs"><a href="/">reMarketplace</a> / <a href="/#catalog">Products</a> / <span>${esc(p.name)}</span></div>

      <section class="pa-head">
        ${RM.mark(p, 'pa-icon')}
        <div class="pa-title">
          <div class="pa-name"><h1>${esc(p.name)}</h1>${p.group ? `<span class="pa-tag t-a">${esc(p.group)}</span>` : ''}${p.category ? `<span class="pa-tag t-d">${esc(p.category)}</span>` : ''}${p.status ? `<span class="pa-tag t-c">${esc(p.status)}</span>` : ''}</div>
          ${p.tagline ? `<p class="pa-sub">${esc(p.tagline)}</p>` : ''}
          <div class="pa-meta">${p.deploy ? `<span>Live in <b>${esc(p.deploy)}</b></span>` : ''}${demo ? `<span>Live site <b>${esc(host(demo))}</b></span>` : ''}<span>Model <b>Master label · White label</b></span></div>
        </div>
        <div class="pa-actions">
          <button class="btn btn-accent" data-book="${esc(p.name)}">${bookLbl}</button>
          ${demo ? `<a class="btn btn-ghost" href="${esc(demo)}" target="_blank" rel="noopener">Visit live site ↗</a>` : ''}
          ${p.investUrl ? `<a class="btn btn-ghost" href="${esc(p.investUrl)}" target="_blank" rel="noopener">Invest ↗</a>` : ''}
        </div>
      </section>

      ${banner ? `<section class="pa-banner"><img src="${esc(banner)}" alt="${esc(p.name)} product preview"></section>` : ''}

      <nav class="pa-tabs" id="paTabs">${tabs.map(([id, l], i) => `<a href="#${id}"${i ? '' : ' class="on"'}>${l}</a>`).join('')}</nav>

      <div class="pa-body">
        <main class="pa-main">
          <section id="overview" class="pa-sec">
            <h2>Overview</h2>
            ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
            ${p.whatItIs ? `<p class="muted">${esc(p.whatItIs)}</p>` : ''}
            ${soon && !features.length ? `<div class="pa-soon"><b>${esc(p.name)} is coming soon.</b><span>Book a call to join early access and get the walkthrough first.</span><button class="btn btn-accent" data-book="${esc(p.name)}">Join early access</button></div>` : ''}
            ${has(p.stats) ? `<div class="pa-stats">${p.stats.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
          </section>

          ${(features.length || extraHl.length) ? `<section id="features" class="pa-sec"><h2>Key features</h2>
            <div class="pa-feat">${features.map(f => `<div><b>${esc(f.t)}</b>${f.d ? `<span>${esc(f.d)}</span>` : ''}</div>`).join('')}
            ${extraHl.map(h => `<div><b>${esc(h.title)}</b>${h.text ? `<span>${esc(h.text)}</span>` : ''}</div>`).join('')}</div></section>` : ''}

          ${(has(p.whyPoints) || has(p.whatYouCanDo)) ? `<div class="pa-two">
            ${has(p.whyPoints) ? `<section class="pa-card"><h3>Why ${esc(p.name)}</h3><ul class="incl">${p.whyPoints.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
            ${has(p.whatYouCanDo) ? `<section class="pa-card"><h3>What you can do</h3><ul class="incl">${p.whatYouCanDo.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
          </div>` : ''}

          ${has(p.useCases) ? `<section id="use-cases" class="pa-sec"><h2>Use cases</h2><div class="pa-chips">${p.useCases.map(u => `<span>${esc(u)}</span>`).join('')}</div></section>` : ''}

          ${(demo || p.pdfDesktop) ? `<section id="resources" class="pa-sec"><h2>Resources</h2><div class="pa-res">
            ${demo ? `<a href="${esc(demo)}" target="_blank" rel="noopener"><span>Live site</span><b>${esc(host(demo))} ↗</b></a>` : ''}
            ${p.pdfDesktop ? `<a href="${esc(p.pdfDesktop)}" target="_blank" rel="noopener"><span>Brochure</span><b>${pdfMobile ? 'Desktop PDF' : 'PDF'} ↓</b></a>` : ''}
            ${pdfMobile ? `<a href="${esc(pdfMobile)}" target="_blank" rel="noopener"><span>Brochure</span><b>Mobile PDF ↓</b></a>` : ''}
          </div></section>` : ''}
        </main>

        <aside class="pa-side">
          <div class="pa-card pa-details"><h3>Details</h3>${details.map(([l, v, raw]) => `<div><span>${l}</span><b>${raw ? v : esc(v)}</b></div>`).join('')}</div>
          <div class="pa-card pa-qr">
            <img src="/qr/${esc(p.slug)}.svg" alt="QR code for this page" width="64" height="64">
            <div><b>Share this product</b><span>Scan to open on another device</span>
              <div><a href="/qr/${esc(p.slug)}.png" download="${esc(p.slug)}-qr.png">Download QR</a> · <button class="link" data-copy="${esc(pageUrl)}">Copy link</button></div></div>
          </div>
          ${p.investUrl ? `<div class="pa-invest" id="invest"><b>Own a share of ${esc(p.name)}</b><span>On-chain shares on INFRA Network via ReSystem Business Opportunity.</span>
            <a class="btn btn-white block" href="${esc(p.investUrl)}" target="_blank" rel="noopener">View opportunity ↗</a></div>` : ''}
        </aside>
      </div>

      ${related.length ? `<section class="pa-sec"><h2>Related products</h2><div class="pa-rel">${related.map(r => `
        <a href="/product/${esc(r.slug)}">${RM.mark(r)}<span><b>${esc(r.name)}</b><small>${esc(r.tagline || r.category)}</small></span><i>→</i></a>`).join('')}</div></section>` : ''}
    </div>
    <div class="pa-mbar"><button class="btn btn-accent grow" data-book="${esc(p.name)}">${bookLbl}</button>${demo ? `<a class="btn btn-ghost" href="${esc(demo)}" target="_blank" rel="noopener">Live site ↗</a>` : ''}</div>`;

    /* Highlight the active section in the nav */
    const links = [...document.querySelectorAll('#paTabs a')];
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(a => { const s = document.querySelector(a.getAttribute('href')); if (s) io.observe(s); });
  }

  RM.loadProducts().then(all => {
    const p = all.find(x => x.slug === slug);
    if (!p) { location.replace('/404'); return; }
    render(p, all);
  });
})();
