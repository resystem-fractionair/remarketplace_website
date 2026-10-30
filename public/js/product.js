/* Product page — compact tile layout matching the reMarketplace pitch flyer */
(function () {
  const { $, esc } = RM;
  const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
  const host = u => { try { return new URL(u, location.origin).host.replace(/^www\./, ''); } catch (_) { return u; } };
  const has = a => Array.isArray(a) && a.length > 0;
  const pills = arr => `<ol class="pf-pills">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`;
  const tile = (cls, title, body) => `<div class="pf-tile ${cls}">${title ? `<h3>${esc(title)}</h3>` : ''}${body}</div>`;

  function render(p, all) {
    document.title = `${p.name} — reMarketplace`;
    const md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', p.summary || p.tagline || '');
    const pageUrl = location.origin + '/product/' + p.slug;
    const demo = p.demoUrl || p.externalUrl;
    const soon = /soon/i.test(p.status || '');
    const heroImg = p.hero || p.image;
    const bookLbl = soon ? 'Join early access' : 'Book a demo';
    const related = all.filter(x => x.slug !== p.slug && x.category === p.category)
      .concat(all.filter(x => x.slug !== p.slug && x.category !== p.category && x.group === p.group)).slice(0, 4);
    const chips = [p.group, p.category, p.deploy && 'Live in ' + p.deploy, p.price].filter(Boolean);

    /* Two list tiles: features + (what you can do | why) */
    const listA = has(p.features) ? ['Key features', p.features] : has(p.whyPoints) ? ['Why ' + p.name, p.whyPoints] : null;
    const listB = has(p.whatYouCanDo) ? ['What you can do', p.whatYouCanDo] : (listA && listA[1] !== p.whyPoints && has(p.whyPoints)) ? ['Why ' + p.name, p.whyPoints] : null;

    /* Highlight tiles rotate dark / soft / accent like the flyer */
    const tones = ['pf-dark', 'pf-soft', 'pf-accent', 'pf-dark'];
    const hl = has(p.highlights) ? p.highlights.slice(0, 8) : [];

    $('#pMain').innerHTML = `
    <div class="wrap pf">
      <div class="crumbs"><a href="/">reMarketplace</a> / <a href="/#catalog">Products</a> / <span>${esc(p.name)}</span></div>

      <div class="pf-top">
        <section class="pf-hero"${heroImg ? ` style="--bg:url('${esc(heroImg)}')"` : ''}>
          <div class="pf-hero-in">
            <div class="pf-brand">${RM.mark(p)}<span>${esc(p.name)}</span>${p.status ? `<em>${esc(p.status)}</em>` : ''}</div>
            <h1>${esc(p.tagline || p.name)}</h1>
            ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
            <div class="pf-chips">${chips.map(c => `<span>${esc(c)}</span>`).join('')}</div>
            <div class="pf-cta">
              ${demo ? `<a class="btn btn-accent" href="${esc(demo)}" target="_blank" rel="noopener">${p.demoUrl ? 'Live demo' : 'Visit site'} ↗</a>` : ''}
              <button class="btn ${demo ? 'btn-outline-light' : 'btn-accent'}" data-book="${esc(p.name)}">${bookLbl}</button>
              ${p.pdfDesktop ? `<a class="btn btn-outline-light" href="${esc(p.pdfDesktop)}" target="_blank" rel="noopener">Brochure ↓</a>` : ''}
            </div>
          </div>
        </section>
        <aside class="pf-side">
          <div class="pf-qr">
            <img src="/qr/${esc(p.slug)}.svg" alt="QR code for this page" width="120" height="120">
            <b>Scan to explore ${esc(p.name)}</b>
            <div class="pf-qr-a"><a href="/qr/${esc(p.slug)}.png" download="${esc(p.slug)}-qr.png">Download</a><button class="link" data-copy="${esc(pageUrl)}">Copy link</button></div>
          </div>
          ${p.investUrl
            ? `<a class="pf-tile pf-accent pf-cta-tile" href="${esc(p.investUrl)}" target="_blank" rel="noopener"><h3>Own a share of ${esc(p.name)}</h3><p>On-chain shares on INFRA Network via ReSystem Business Opportunity.</p><span>View opportunity ↗</span></a>`
            : `<button class="pf-tile pf-accent pf-cta-tile" data-book="${esc(p.name)}"><h3>${soon ? 'Coming soon' : 'White-label it'}</h3><p>${soon ? 'Get early access before launch.' : 'Launch under your brand in weeks.'}</p><span>${bookLbl} →</span></button>`}
        </aside>
      </div>

      ${(listA || listB) ? `<div class="pf-row${listA && listB ? ' two' : ''}">
        ${listA ? tile('pf-dark', listA[0], pills(listA[1])) : ''}
        ${listB ? tile('pf-dark', listB[0], pills(listB[1])) : ''}
      </div>` : ''}

      ${hl.length ? `<div class="pf-band">Highlights</div><div class="pf-grid">${hl.map((h, i) => tile(tones[i % 4], h.title, h.text ? `<p>${esc(h.text)}</p>` : '')).join('')}</div>` : ''}

      ${(has(p.useCases) || has(p.stats)) ? `<div class="pf-row two">
        ${has(p.useCases) ? tile('pf-dark', 'Use cases & target market', `<div class="pf-tags">${p.useCases.map(u => `<span>${esc(u)}</span>`).join('')}</div>`) : ''}
        ${has(p.stats) ? tile('pf-soft', 'By the numbers', `<div class="pf-stats">${p.stats.map(s => `<span>${esc(s)}</span>`).join('')}</div>`) : (demo || p.pdfMobile) ? tile('pf-soft', 'Resources', `<div class="pf-links">
            ${demo ? `<a href="${esc(demo)}" target="_blank" rel="noopener">${esc(host(demo))} ↗</a>` : ''}
            ${p.pdfDesktop ? `<a href="${esc(p.pdfDesktop)}" target="_blank" rel="noopener">Brochure — desktop ↓</a>` : ''}
            ${p.pdfMobile && p.pdfMobile !== p.pdfDesktop ? `<a href="${esc(p.pdfMobile)}" target="_blank" rel="noopener">Brochure — mobile ↓</a>` : ''}</div>`) : ''}
      </div>` : ''}

      ${p.whatItIs ? `<div class="pf-gloss"><span>What it is</span><p>${esc(p.whatItIs)}</p></div>` : ''}

      ${(!listA && !hl.length && !has(p.useCases)) ? `<div class="pf-tile pf-soft pf-empty"><h3>${soon ? `${esc(p.name)} is coming soon` : 'Full details on request'}</h3>
        <p>${soon ? 'Book a call to join early access and get the walkthrough first.' : 'The ReSystem team will walk you through this product on a call.'}</p>
        <button class="btn btn-accent" data-book="${esc(p.name)}">${bookLbl}</button></div>` : ''}

      ${related.length ? `<div class="pf-band">Related products</div><div class="pf-rel">${related.map(r => `
        <a class="pf-relcard" href="/product/${esc(r.slug)}">${RM.mark(r)}<span><b>${esc(r.name)}</b><small>${esc(r.tagline || r.category)}</small></span><i>→</i></a>`).join('')}</div>` : ''}
    </div>`;
  }

  RM.loadProducts().then(all => {
    const p = all.find(x => x.slug === slug);
    if (!p) { location.replace('/404'); return; }
    render(p, all);
  });
})();
