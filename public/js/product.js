/* Product page — template A: header card, banner, section nav, rich side panel */
(function () {
  const { $, esc } = RM;
  const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
  const host = u => { try { return new URL(u, location.origin).host.replace(/^www\./, ''); } catch (_) { return u; } };
  const has = a => Array.isArray(a) && a.length > 0;
  const svg = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
    pdf: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
    phone: svg('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/>'),
    key: svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>'),
    play: svg('<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z"/>'),
    chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>')
  };
  const FEAT = [
    svg('<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/>'),
    svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h2M3 10h18"/>'),
    svg('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'),
    svg('<path d="M4 5h16v11H8l-4 4z"/>'),
    svg('<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M21 20a6 6 0 0 0-4-5.6"/>'),
    svg('<path d="M4 17l5-5 4 4 7-8"/><path d="M15 8h5v5"/>'),
    svg('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
    svg('<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>')
  ];

  function render(p, all) {
    document.title = `${p.name} — reMarketplace`;
    const md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', p.summary || p.tagline || '');
    const pageUrl = location.origin + '/product/' + p.slug;
    const live = p.externalUrl;
    const demo = p.demoUrl || p.externalUrl;
    const soon = /soon/i.test(p.status || '');
    const banner = p.image || p.hero;
    const bookLbl = soon ? 'Join early access' : 'Book a demo';
    const related = all.filter(x => x.slug !== p.slug && x.category === p.category)
      .concat(all.filter(x => x.slug !== p.slug && x.category !== p.category && x.group === p.group)).slice(0, 4);
    const hlBy = new Map((p.highlights || []).map(h => [h.title.toLowerCase(), h.text]));
    const features = (p.features || []).map(f => ({ t: f, d: hlBy.get(f.toLowerCase()) || '' }))
      .concat((p.highlights || []).filter(h => !(p.features || []).some(f => f.toLowerCase() === h.title.toLowerCase())).map(h => ({ t: h.title, d: h.text })));
    const pdfMobile = p.pdfMobile && p.pdfMobile !== p.pdfDesktop ? p.pdfMobile : '';
    const hasCreds = p.demoEmail || p.demoPassword;

    const tabs = [['overview', 'Overview'], features.length && ['features', 'Features'], (has(p.whyPoints) || has(p.whatYouCanDo)) && ['details', 'Why & how'],
      has(p.useCases) && ['use-cases', 'Use cases'], ['demo', 'Demo'], p.investUrl && ['invest', 'Invest']].filter(Boolean);
    const facts = [['Category', p.category], ['Ecosystem', p.group], ['Go-live', p.deploy], ['Pricing', p.price || 'On request']].filter(d => d[1]);
    const res = [
      live && { href: live, icon: I.globe, t: 'Live website', s: host(live), ext: true },
      p.pdfDesktop && { href: p.pdfDesktop, icon: I.pdf, t: pdfMobile ? 'Brochure — desktop' : 'Product brochure', s: 'PDF download' },
      pdfMobile && { href: pdfMobile, icon: I.phone, t: 'Brochure — mobile', s: 'PDF for phones' }
    ].filter(Boolean);
    const cred = (label, val) => `<div class="pa-cred"><span>${label}</span><code>${esc(val)}</code><button class="copy" data-copy="${esc(val)}">Copy</button></div>`;

    $('#pMain').innerHTML = `
    <div class="wrap pa">
      <div class="crumbs"><a href="/">reMarketplace</a> / <a href="/#catalog">Products</a> / <span>${esc(p.name)}</span></div>

      <section class="pa-head">
        ${RM.mark(p, 'pa-icon')}
        <div class="pa-title">
          <div class="pa-name"><h1>${esc(p.name)}</h1>${p.group ? `<span class="pa-tag t-a">${esc(p.group)}</span>` : ''}${p.category ? `<span class="pa-tag t-d">${esc(p.category)}</span>` : ''}${p.status ? `<span class="pa-tag t-c">${esc(p.status)}</span>` : ''}</div>
          ${p.tagline ? `<p class="pa-sub">${esc(p.tagline)}</p>` : ''}
          <div class="pa-meta">${p.deploy ? `<span>Live in <b>${esc(p.deploy)}</b></span>` : ''}${live ? `<span>Live site <b>${esc(host(live))}</b></span>` : ''}<span>Model <b>Master label · White label</b></span></div>
        </div>
        <div class="pa-actions">
          <button class="btn btn-accent" data-book="${esc(p.name)}">${bookLbl}</button>
          ${demo ? `<a class="btn btn-ghost" href="#demo">${I.play} Try demo</a>` : ''}
          ${p.investUrl ? `<a class="btn btn-ghost" href="${esc(p.investUrl)}" target="_blank" rel="noopener">Invest ↗</a>` : ''}
        </div>
      </section>

      <section class="pa-hero">
        ${banner ? `<div class="pa-banner"><img src="${esc(banner)}" alt="${esc(p.name)} product preview"></div>` : ''}
        <div class="pa-facts">${facts.map(([l, v]) => `<div><span>${l}</span><b>${esc(v)}</b></div>`).join('')}
          ${has(p.stats) ? p.stats.slice(0, 3).map(s => `<div class="acc"><span>Highlight</span><b>${esc(s)}</b></div>`).join('') : ''}</div>
      </section>

      <nav class="pa-tabs" id="paTabs">${tabs.map(([id, l], i) => `<a href="#${id}"${i ? '' : ' class="on"'}>${l}</a>`).join('')}</nav>

      <div class="pa-body">
        <main class="pa-main">
          <section id="overview" class="pa-sec">
            <h2>Overview</h2>
            <div class="pa-ov${p.whatItIs ? ' two' : ''}">
              ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
              ${p.whatItIs ? `<div class="pa-callout"><span>What it is</span><p>${esc(p.whatItIs)}</p></div>` : ''}
            </div>
            ${soon && !features.length ? `<div class="pa-soon"><b>${esc(p.name)} is coming soon.</b><span>Book a call to join early access and get the walkthrough first.</span><button class="btn btn-accent" data-book="${esc(p.name)}">Join early access</button></div>` : ''}
          </section>

          ${features.length ? `<section id="features" class="pa-sec"><h2>Key features</h2>
            <div class="pa-feat">${features.map((f, i) => `<div><span class="fi">${FEAT[i % FEAT.length]}</span><span class="ft"><b>${esc(f.t)}</b>${f.d ? `<small>${esc(f.d)}</small>` : ''}</span></div>`).join('')}</div></section>` : ''}

          ${(has(p.whyPoints) || has(p.whatYouCanDo)) ? `<div class="pa-two" id="details">
            ${has(p.whyPoints) ? `<section class="pa-card"><h3>Why ${esc(p.name)}</h3><ul class="incl">${p.whyPoints.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
            ${has(p.whatYouCanDo) ? `<section class="pa-card"><h3>What you can do</h3><ul class="incl">${p.whatYouCanDo.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
          </div>` : ''}

          ${has(p.useCases) ? `<section id="use-cases" class="pa-sec"><h2>Use cases</h2><div class="pa-uc">${p.useCases.map((u, i) => `<div><span>${String(i + 1).padStart(2, '0')}</span>${esc(u)}</div>`).join('')}</div></section>` : ''}
        </main>

        <aside class="pa-side">
          <div class="pa-card pa-demo" id="demo">
            <h3><span class="ic">${I.key}</span>Demo access</h3>
            ${demo ? `<a class="pa-res" href="${esc(demo)}" target="_blank" rel="noopener"><span class="ic">${I.play}</span><span><b>Open demo</b><small>${esc(host(demo))}</small></span><i>↗</i></a>` : ''}
            ${hasCreds ? `${p.demoEmail ? cred('Login', p.demoEmail) : ''}${p.demoPassword ? cred('Password', p.demoPassword) : ''}${p.demoNote ? `<p class="small muted">${esc(p.demoNote)}</p>` : ''}`
              : `<p class="small muted">Demo login credentials are shared on request — usually within one business day.</p>
                 <button class="btn btn-ghost block" data-book="${esc(p.name)}">Request demo credentials</button>`}
          </div>

          ${res.length ? `<div class="pa-card"><h3>Resources</h3>${res.map(r => `
            <a class="pa-res" href="${esc(r.href)}" target="_blank" rel="noopener"><span class="ic">${r.icon}</span><span><b>${esc(r.t)}</b><small>${esc(r.s)}</small></span><i>${r.ext ? '↗' : '↓'}</i></a>`).join('')}</div>` : ''}

          ${p.investUrl ? `<div class="pa-invest" id="invest"><span class="ic">${I.chart}</span><b>Own a share of ${esc(p.name)}</b><span>On-chain shares on INFRA Network via ReSystem Business Opportunity.</span>
            <a class="btn btn-white block" href="${esc(p.investUrl)}" target="_blank" rel="noopener">View opportunity ↗</a></div>` : ''}

          <div class="pa-card pa-qr">
            <img src="/qr/${esc(p.slug)}.svg" alt="QR code for this page" width="60" height="60">
            <div><b>Share this product</b><span>Scan to open on another device</span>
              <div><a href="/qr/${esc(p.slug)}.png" download="${esc(p.slug)}-qr.png">Download QR</a> · <button class="link" data-copy="${esc(pageUrl)}">Copy link</button></div></div>
          </div>
        </aside>
      </div>

      ${related.length ? `<section class="pa-sec"><h2>Related products</h2><div class="pa-rel">${related.map(r => `
        <a href="/product/${esc(r.slug)}">${r.image ? `<span class="ri"><img src="${esc(r.image)}" alt="" loading="lazy"></span>` : RM.mark(r)}<span class="rt"><b>${esc(r.name)}</b><small>${esc(r.tagline || r.category)}</small></span><i>→</i></a>`).join('')}</div></section>` : ''}
    </div>
    <div class="pa-mbar"><button class="btn btn-accent grow" data-book="${esc(p.name)}">${bookLbl}</button>${demo ? `<a class="btn btn-ghost" href="#demo">Try demo</a>` : ''}</div>`;

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
