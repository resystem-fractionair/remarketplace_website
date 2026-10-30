(function () {
  const { $, esc } = RM;
  const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
  const host = u => { try { return new URL(u, location.origin).host.replace(/^www\./, ''); } catch (_) { return u; } };
  const has = a => Array.isArray(a) && a.length > 0;
  const checklist = arr => `<ul class="incl">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;

  function render(p, all) {
    document.title = `${p.name} — reMarketplace`;
    const md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', p.summary || p.tagline || '');
    const pageUrl = location.origin + '/product/' + p.slug;
    const demo = p.demoUrl || p.externalUrl;
    const soon = /soon/i.test(p.status || '');
    const heroImg = p.hero || p.image;
    const related = all.filter(x => x.slug !== p.slug && x.category === p.category)
      .concat(all.filter(x => x.slug !== p.slug && x.category !== p.category && x.group === p.group)).slice(0, 3);

    /* Only facts this product actually has */
    const facts = [
      ['Category', p.category], ['Ecosystem', p.group], ['Go-live', p.deploy],
      ['Pricing', p.price], ['Live site', p.externalUrl ? host(p.externalUrl) : '']
    ].filter(f => f[1]);

    /* Content sections — skipped when empty */
    const sections = [];
    if (has(p.features)) sections.push(`<section class="p-sec"><h2>Key features</h2><div class="feat-grid">${p.features.map((f, i) => `<div class="feat"><span>${String(i + 1).padStart(2, '0')}</span><b>${esc(f)}</b></div>`).join('')}</div></section>`);
    if (p.whatItIs) sections.push(`<section class="p-sec"><h2>What it is</h2><p class="lead">${esc(p.whatItIs)}</p></section>`);
    if (has(p.whyPoints) || has(p.whatYouCanDo)) sections.push(`<section class="p-sec p-cols">
      ${has(p.whyPoints) ? `<div><h2>Why ${esc(p.name)}</h2>${checklist(p.whyPoints)}</div>` : ''}
      ${has(p.whatYouCanDo) ? `<div><h2>What you can do</h2>${checklist(p.whatYouCanDo)}</div>` : ''}</section>`);
    if (has(p.highlights)) sections.push(`<section class="p-sec"><h2>Highlights</h2><div class="hl-grid">${p.highlights.map(h => `<div class="hl"><b>${esc(h.title)}</b>${h.text ? `<p>${esc(h.text)}</p>` : ''}</div>`).join('')}</div>
      ${has(p.stats) ? `<div class="p-stats">${p.stats.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}</section>`);
    else if (has(p.stats)) sections.push(`<div class="p-stats">${p.stats.map(s => `<span>${esc(s)}</span>`).join('')}</div>`);
    if (has(p.useCases)) sections.push(`<section class="p-sec"><h2>Potential use cases</h2><div class="uc-tags">${p.useCases.map(u => `<span>${esc(u)}</span>`).join('')}</div></section>`);
    if (p.mobileImage) sections.push(`<section class="p-sec"><h2>On mobile</h2><div class="p-mobile"><img src="${esc(p.mobileImage)}" alt="${esc(p.name)} on mobile" loading="lazy"></div></section>`);
    if (!sections.length) sections.push(`<section class="p-sec soon-box"><h2>${soon ? 'Coming soon' : 'Details on request'}</h2>
      <p class="lead">${soon ? `${esc(p.name)} is being prepared for the ReSystem ecosystem. Book a call to join early access and get the full product walkthrough first.` : 'Book a call and the ReSystem team will walk you through this product.'}</p>
      <button class="btn btn-accent" data-book="${esc(p.name)}">${soon ? 'Join early access' : 'Book a demo call'}</button></section>`);

    $('#pMain').innerHTML = `
      <section class="wrap p-hero${heroImg ? '' : ' no-art'}">
        <div class="p-hero-copy">
          <div class="crumbs"><a href="/">reMarketplace</a> / <a href="/#catalog">Products</a> / <span>${esc(p.name)}</span></div>
          <div class="p-id">${RM.mark(p, 'lg')}<div><span class="cat-tag">${[p.group, p.category].filter(Boolean).map(esc).join(' · ')}</span>
            <h1>${esc(p.name)}${p.status ? ` <span class="badge">${esc(p.status)}</span>` : ''}</h1></div></div>
          ${p.tagline ? `<p class="p-tag">${esc(p.tagline)}</p>` : ''}
          ${p.summary ? `<p class="p-sum">${esc(p.summary)}</p>` : ''}
          <div class="hero-cta">
            ${demo ? `<a class="btn btn-accent" href="${esc(demo)}" target="_blank" rel="noopener">${p.demoUrl ? 'Open live demo' : 'Visit live site'} ↗</a>` : ''}
            <button class="btn ${demo ? 'btn-ghost' : 'btn-accent'}" data-book="${esc(p.name)}">${soon ? 'Join early access' : 'Book a demo call'}</button>
            ${p.investUrl ? `<a class="btn btn-ghost" href="${esc(p.investUrl)}" target="_blank" rel="noopener">Invest ↗</a>` : ''}
          </div>
        </div>
        ${heroImg ? `<div class="p-hero-art"><img src="${esc(heroImg)}" alt="${esc(p.name)} product preview"></div>` : ''}
      </section>

      ${facts.length ? `<section class="wrap"><div class="facts">${facts.map(([l, v]) => `<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div></section>` : ''}

      <div class="wrap p-body">
        <div class="p-main">${sections.join('')}</div>

        <aside class="p-side">
          <div class="side-card">
            <h4>${soon ? 'Get early access' : 'See it in action'}</h4>
            ${demo ? `<a class="side-link" href="${esc(demo)}" target="_blank" rel="noopener"><span>${p.demoUrl ? 'Live demo' : 'Live site'}</span><b>${esc(host(demo))} ↗</b></a>` : ''}
            <p class="muted small">${soon ? 'Be first in line when it launches.' : 'Sandbox access is issued by the ReSystem team after your demo call.'}</p>
            <button class="btn btn-accent block" data-book="${esc(p.name)}">${soon ? 'Join early access' : 'Book a demo'}</button>
          </div>

          ${(p.pdfDesktop || p.pdfMobile) ? `<div class="side-card"><h4>Product brochure</h4>
            ${p.pdfDesktop ? `<a class="side-link" href="${esc(p.pdfDesktop)}" target="_blank" rel="noopener"><span>PDF</span><b>Desktop ↓</b></a>` : ''}
            ${p.pdfMobile && p.pdfMobile !== p.pdfDesktop ? `<a class="side-link" href="${esc(p.pdfMobile)}" target="_blank" rel="noopener"><span>PDF</span><b>Mobile ↓</b></a>` : ''}</div>` : ''}

          ${p.investUrl ? `<div class="side-card invest"><h4>Own a share of ${esc(p.name)}</h4><p class="small">On-chain shares via the ReSystem Business Opportunity programme on INFRA Network.</p>
            <a class="btn btn-white block" href="${esc(p.investUrl)}" target="_blank" rel="noopener">View opportunity ↗</a></div>` : ''}

          <div class="side-card qr-mini">
            <img src="/qr/${esc(p.slug)}.svg" alt="QR code for this page" width="84" height="84">
            <div><b>Share this product</b><span class="muted small">Scan to open on mobile</span>
              <div class="qr-acts"><a href="/qr/${esc(p.slug)}.png" download="${esc(p.slug)}-qr.png">Download QR</a><button class="link" data-copy="${esc(pageUrl)}">Copy link</button><button class="link" id="shareBtn" hidden>Share</button></div>
            </div>
          </div>
        </aside>
      </div>

      ${related.length ? `<section class="wrap related"><h2>Related products</h2><div class="grid">${related.map(r => `
        <a class="card pcard" href="/product/${esc(r.slug)}">
          <div class="card-top">${RM.mark(r)}<span class="cat-tag">${esc(r.category)}</span>${r.status ? `<span class="badge">${esc(r.status)}</span>` : ''}</div>
          <h3>${esc(r.name)}</h3><p>${esc(r.tagline || r.summary)}</p>
          <div class="card-foot"><span>${esc(r.group || '')}</span><span class="view">View product →</span></div></a>`).join('')}</div></section>` : ''}

      <section class="wrap cta-band"><div><h2>${soon ? `Be first to launch ${esc(p.name)}.` : `Launch ${esc(p.name)} under your brand.`}</h2><p>Talk to the ReSystem team about licensing, white-labelling or listing your own master label.</p></div>
        <button class="btn btn-white" data-book="${esc(p.name)}">${soon ? 'Join early access' : 'Book a demo call'}</button></section>`;

    const sb = $('#shareBtn');
    if (navigator.share) { sb.hidden = false; sb.onclick = () => navigator.share({ title: p.name + ' — reMarketplace', text: p.tagline || '', url: pageUrl }).catch(() => {}); }
  }

  RM.loadProducts().then(all => {
    const p = all.find(x => x.slug === slug);
    if (!p) { location.replace('/404'); return; }
    render(p, all);
  });
})();
