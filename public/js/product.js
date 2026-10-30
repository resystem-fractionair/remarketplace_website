(function () {
  const { $, esc } = RM;
  const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
  const list = (arr, cls) => arr && arr.length ? `<ul class="${cls || 'incl'}">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const sec = (title, html) => html ? `<section class="p-sec"><h2>${esc(title)}</h2>${html}</section>` : '';
  const host = u => { try { return new URL(u).host.replace(/^www\./, ''); } catch (_) { return u; } };

  function render(p, all) {
    document.title = `${p.name} — reMarketplace`;
    const md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', p.summary || p.tagline || '');
    const pageUrl = location.origin + '/product/' + p.slug;
    const demo = p.demoUrl || p.externalUrl;
    const related = all.filter(x => x.slug !== p.slug && (x.category === p.category || x.group === p.group)).slice(0, 3);

    const facts = [
      ['Category', p.category], ['Model', p.model || 'Master label · White label'],
      ['Go-live', p.deploy || 'On request'], ['Pricing', p.price || 'On request']
    ].filter(f => f[1]);

    $('#pMain').innerHTML = `
      <section class="wrap p-hero">
        <div class="p-hero-copy">
          <div class="crumbs"><a href="/">reMarketplace</a> / <a href="/#catalog">Products</a> / <span>${esc(p.name)}</span></div>
          <div class="p-id">${RM.mark(p, 'lg')}<div><span class="cat-tag">${esc(p.group || '')}${p.group && p.category ? ' · ' : ''}${esc(p.category || '')}</span>
            <h1>${esc(p.name)}</h1></div></div>
          ${p.tagline ? `<p class="p-tag">${esc(p.tagline)}</p>` : ''}
          <p class="p-sum">${esc(p.summary || '')}</p>
          <div class="hero-cta">
            ${demo ? `<a class="btn btn-accent" href="${esc(demo)}" target="_blank" rel="noopener">Open live demo ↗</a>` : ''}
            <button class="btn ${demo ? 'btn-ghost' : 'btn-accent'}" data-book="${esc(p.name)}">Book a demo call</button>
            ${p.investUrl ? `<a class="btn btn-ghost" href="${esc(p.investUrl)}" target="_blank" rel="noopener">Investment opportunity ↗</a>` : ''}
          </div>
        </div>
        <div class="p-hero-art">${(p.hero || p.image) ? `<img src="${esc(p.hero || p.image)}" alt="${esc(p.name)} product preview">` : `<div class="p-art-fallback">${RM.mark(p, 'xl')}</div>`}</div>
      </section>

      <section class="wrap"><div class="facts">${facts.map(([l, v]) => `<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div></section>

      <div class="wrap p-body">
        <div class="p-main">
          ${p.features && p.features.length ? `<section class="p-sec"><h2>Key features</h2><div class="feat-grid">${p.features.map((f, i) => `<div class="feat"><span>${String(i + 1).padStart(2, '0')}</span><b>${esc(f)}</b></div>`).join('')}</div></section>` : ''}
          ${sec('What it is', p.whatItIs ? `<p>${esc(p.whatItIs)}</p>` : '')}
          ${sec('Why ' + p.name, list(p.whyPoints))}
          ${sec('What you can do', list(p.whatYouCanDo))}
          ${p.highlights && p.highlights.length ? `<section class="p-sec"><h2>Highlights</h2><div class="hl-grid">${p.highlights.map(h => `<div class="hl"><b>${esc(h.title)}</b><p>${esc(h.text)}</p></div>`).join('')}</div></section>` : ''}
          ${p.stats && p.stats.length ? `<div class="p-stats">${p.stats.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
          ${p.useCases && p.useCases.length ? `<section class="p-sec"><h2>Potential use cases</h2><div class="uc-tags">${p.useCases.map(u => `<span>${esc(u)}</span>`).join('')}</div></section>` : ''}
          ${p.mobileImage ? `<section class="p-sec"><h2>On mobile</h2><div class="p-mobile"><img src="${esc(p.mobileImage)}" alt="${esc(p.name)} on mobile" loading="lazy"></div></section>` : ''}
        </div>

        <aside class="p-side">
          <div class="side-card qr-side">
            <img src="/qr/${esc(p.slug)}.svg" alt="QR code for the ${esc(p.name)} page" width="180" height="180">
            <b>Scan to open on mobile</b>
            <span class="muted small">Share this product page at events, in decks or on print.</span>
            <div class="side-actions">
              <a class="btn btn-ghost" href="/qr/${esc(p.slug)}.png" download="${esc(p.slug)}-qr.png">Download QR</a>
              <button class="btn btn-ghost" data-copy="${esc(pageUrl)}">Copy link</button>
              <button class="btn btn-ghost" id="shareBtn" hidden>Share</button>
            </div>
          </div>

          <div class="side-card">
            <h4>Try it</h4>
            ${demo ? `<a class="side-link" href="${esc(demo)}" target="_blank" rel="noopener"><span>Live demo</span><b>${esc(host(demo))} ↗</b></a>` : `<p class="muted small">Live demo is shared on the walkthrough call.</p>`}
            <p class="muted small">Sandbox credentials are issued by the ReSystem team after your first demo call.</p>
            <button class="btn btn-accent block" data-book="${esc(p.name)}">Book a demo for ${esc(p.name)}</button>
          </div>

          ${(p.pdfDesktop || p.pdfMobile) ? `<div class="side-card"><h4>Product brochure</h4>
            ${p.pdfDesktop ? `<a class="side-link" href="${esc(p.pdfDesktop)}" target="_blank" rel="noopener"><span>PDF</span><b>Desktop version ↓</b></a>` : ''}
            ${p.pdfMobile ? `<a class="side-link" href="${esc(p.pdfMobile)}" target="_blank" rel="noopener"><span>PDF</span><b>Mobile version ↓</b></a>` : ''}</div>` : ''}

          ${p.investUrl ? `<div class="side-card invest"><h4>Own a share of ${esc(p.name)}</h4><p class="small">Buy on-chain shares through the ReSystem Business Opportunity programme on INFRA Network.</p>
            <a class="btn btn-white block" href="${esc(p.investUrl)}" target="_blank" rel="noopener">View investment opportunity ↗</a></div>` : ''}
        </aside>
      </div>

      ${related.length ? `<section class="wrap related"><h2>Related products</h2><div class="grid">${related.map(r => `
        <a class="card pcard" href="/product/${esc(r.slug)}">
          <div class="card-top">${RM.mark(r)}<span class="cat-tag">${esc(r.category)}</span></div>
          <h3>${esc(r.name)}</h3><p>${esc(r.tagline || r.summary)}</p>
          <div class="card-foot"><span>${esc(r.group || '')}</span><span class="view">View product →</span></div></a>`).join('')}</div></section>` : ''}

      <section class="wrap cta-band"><div><h2>Launch ${esc(p.name)} under your brand.</h2><p>Talk to the ReSystem team about licensing, white-labelling or listing your own master label.</p></div>
        <button class="btn btn-white" data-book="${esc(p.name)}">Book a demo call</button></section>`;

    const sb = $('#shareBtn');
    if (navigator.share) { sb.hidden = false; sb.onclick = () => navigator.share({ title: p.name + ' — reMarketplace', text: p.tagline || '', url: pageUrl }).catch(() => {}); }
  }

  RM.loadProducts().then(all => {
    const p = all.find(x => x.slug === slug);
    if (!p) { location.replace('/404'); return; }
    render(p, all);
  });
})();
