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
    monitor: svg('<rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M8 20.5h8M12 16.5v4"/>'),
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

  let L = {};
  function render(p, all, featuredRow) {
    document.title = `${p.name} — reMarketplace`;
    const md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', p.summary || p.tagline || '');
    const pageUrl = location.origin + '/product/' + p.slug;
    const live = p.externalUrl;
    const demo = p.demoUrl || p.externalUrl;
    const soon = /soon/i.test(p.status || '');
    const banner = p.image || p.hero;
    const buy = p.buy && p.buy.enabled ? p.buy : null; CUR = p;
    const bookLbl = soon ? 'Join early access' : (L.bookCta || 'Book a demo');
    const related = all.filter(x => x.slug !== p.slug && x.category === p.category)
      .concat(all.filter(x => x.slug !== p.slug && x.category !== p.category && x.group === p.group)).slice(0, 4);
    const featured = (featuredRow || []).filter(x => x.slug !== p.slug);
    const bottom = featured.concat(related.filter(r => !featured.some(f => f.slug === r.slug))).slice(0, 4);
    const hlBy = new Map((p.highlights || []).map(h => [h.title.toLowerCase(), h.text]));
    const features = (p.features || []).map((f, i) => ({ t: f, d: hlBy.get(f.toLowerCase()) || '', icon: (p.featureIcons || [])[i] || '' }))
      .concat((p.highlights || []).filter(h => !(p.features || []).some(f => f.toLowerCase() === h.title.toLowerCase())).map(h => ({ t: h.title, d: h.text })));
    const pdfMobile = p.pdfMobile && p.pdfMobile !== p.pdfDesktop ? p.pdfMobile : '';
    const hasCreds = (p.demoCreds || []).length > 0;

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
          <div class="pa-meta">${p.deploy ? `<span>Live in <b>${esc(p.deploy)}</b></span>` : ''}${live ? `<span>Live site <b>${esc(host(live))}</b></span>` : ''}${L.model ? `<span>Model <b>${esc(L.model)}</b></span>` : ''}</div>
        </div>
        <div class="pa-actions">
          ${buy ? `<button class="btn btn-reid" data-buy><span class="reid-dot">re</span>Buy with reID${buy.label || buy.amount ? ` · ${esc(buy.label || (buy.amount + ' ' + (buy.symbol || '')).trim())}` : ''}</button>` : ''}
          <button class="btn ${buy ? 'btn-ghost' : 'btn-accent'}" data-book="${esc(p.name)}">${bookLbl}</button>
          <button class="btn btn-ghost" data-demo>${I.play} ${hasCreds || demo ? esc(L.demoCta || 'Try demo') : 'Request demo'}</button>
          ${p.investUrl ? `<a class="btn btn-ghost" href="${esc(p.investUrl)}" target="_blank" rel="noopener">Invest ↗</a>` : ''}
        </div>
      </section>

      ${banner ? `<section class="pa-hero"><div class="pa-banner" style="--bg:url('${esc(banner)}')"><img src="${esc(banner)}" alt="${esc(p.name)} product preview"></div></section>` : ''}

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
            <div class="pa-feat">${features.map((f, i) => `<div><span class="fi">${(window.RMI && RMI.render(f.icon, 20)) || FEAT[i % FEAT.length]}</span><span class="ft"><b>${esc(f.t)}</b>${f.d ? `<small>${esc(f.d)}</small>` : ''}</span></div>`).join('')}</div></section>` : ''}

          ${(has(p.whyPoints) || has(p.whatYouCanDo)) ? `<div class="pa-two" id="details">
            ${has(p.whyPoints) ? `<section class="pa-card"><h3>Why ${esc(p.name)}</h3><ul class="incl">${p.whyPoints.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
            ${has(p.whatYouCanDo) ? `<section class="pa-card"><h3>What you can do</h3><ul class="incl">${p.whatYouCanDo.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
          </div>` : ''}

          ${has(p.useCases) ? `<section id="use-cases" class="pa-sec"><h2>Use cases</h2><div class="pa-uc">${p.useCases.map((u, i) => `<div><span>${String(i + 1).padStart(2, '0')}</span>${esc(u)}</div>`).join('')}</div></section>` : ''}

        </main>

        <aside class="pa-side">
          <div class="pa-card pa-demo" id="demo">
            <h3><span class="ic">${I.key}</span>${esc(L.credsTitle || 'Sandbox credentials')} <em class="pa-badge">Test data</em></h3>
            <div class="pa-creds">
              ${demo ? `<div class="pa-cred"><span>Demo URL</span><a href="${esc(demo)}" target="_blank" rel="noopener">${esc(demo.replace(/^https?:\/\//, ''))}</a><button class="copy" data-copy="${esc(demo)}">Copy</button></div>` : ''}
              ${(p.demoCreds || []).map(c => cred(esc(c.label), c.value)).join('')}
            </div>
            ${hasCreds ? `<p class="small muted">${esc(p.demoNote || L.credsNote || '')}</p>`
              : `<p class="small muted">${esc(p.demoNote || L.credsRequest || '')}</p>
                 <button class="btn btn-ghost block" data-demo>Request demo credentials</button>`}
            ${demo ? `<a class="btn btn-accent block" href="${esc(demo)}" target="_blank" rel="noopener">Open demo ↗</a>` : ''}
          </div>



          ${(p.pdfDesktop || pdfMobile || live) ? `<div class="pa-card pa-dl"><h3>${esc(L.brochureTitle || 'Brochure & links')}</h3>
            <div class="pa-dlg">
              ${p.pdfDesktop ? `<a href="${esc(p.pdfDesktop)}" target="_blank" rel="noopener" class="pa-dlt"><span class="pa-dli">${I.monitor}<em>PDF</em></span><b>Desktop</b><small>Full-size brochure</small></a>` : ''}
              ${pdfMobile ? `<a href="${esc(pdfMobile)}" target="_blank" rel="noopener" class="pa-dlt"><span class="pa-dli">${I.phone}<em>PDF</em></span><b>Mobile</b><small>Phone-friendly</small></a>` : ''}
            </div>
            ${live ? `<a class="pa-res" href="${esc(live)}" target="_blank" rel="noopener"><span class="ic">${I.globe}</span><span><b>Live website</b><small>${esc(host(live))}</small></span><i>↗</i></a>` : ''}
          </div>` : ''}

          ${p.investUrl ? `<div class="pa-invest" id="invest"><span class="ic">${I.chart}</span><b>${esc(L.investTitle || 'Own a share of')} ${esc(p.name)}</b><span>${esc(L.investText || '')}</span>
            <a class="btn btn-white block" href="${esc(p.investUrl)}" target="_blank" rel="noopener">${esc(L.investCta || 'View opportunity')} ↗</a></div>` : ''}

          <div class="pa-card pa-qr">
            <img src="/qr/${esc(p.slug)}.svg" alt="QR code for this page" width="60" height="60">
            <div><b>Share this product</b><span>Scan to open on another device</span>
              <div><a href="/qr/${esc(p.slug)}.png" download="${esc(p.slug)}-qr.png">Download QR</a> · <button class="link" data-copy="${esc(pageUrl)}">Copy link</button></div></div>
          </div>

        </aside>
      </div>

      ${bottom.length ? `<section class="pa-sec"><h2>${featured.length ? esc(L.featuredTitle || 'Featured products') : 'Related products'}</h2><div class="pa-fgrid">${bottom.map(r => `
        <a class="card pcard" href="/product/${esc(r.slug)}">${r.image ? `<div class="pc-img"><img src="${esc(r.image)}" alt="" loading="lazy"></div>` : `<div class="pc-img pc-ph">${RM.mark(r)}</div>`}
          <div class="card-top">${RM.mark(r)}<span class="cat-tag">${esc(r.category)}</span>${r.status ? `<span class="badge">${esc(r.status)}</span>` : ''}</div>
          <h3>${esc(r.name)}</h3><p>${esc(r.tagline || r.summary)}</p>
          <div class="card-foot"><span>${esc(r.group || '')}</span><span class="view">View product →</span></div></a>`).join('')}</div></section>` : ''}
    </div>
    <div class="pa-mbar">${buy ? `<button class="btn btn-reid grow" data-buy>Buy with reID</button>` : `<button class="btn btn-accent grow" data-book="${esc(p.name)}">${bookLbl}</button>`}<button class="btn btn-ghost" data-demo>Try demo</button></div>`;
    openDrawer = () => drawer(p, features, demo, hasCreds, banner);

    const links = [...document.querySelectorAll('#paTabs a')];
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(a => { const s = document.querySelector(a.getAttribute('href')); if (s) io.observe(s); });
  }

  let openDrawer = null;
  function drawer(p, features, demo, hasCreds, banner) {
    let ov = document.getElementById('demoOv');
    if (!ov) {
      ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'demoOv'; ov.hidden = true;
      ov.innerHTML = '<aside class="drawer dd" role="dialog" aria-modal="true" aria-labelledby="ddName"><button class="x" data-close aria-label="Close">×</button><div id="ddBody"></div></aside>';
      document.body.appendChild(ov);
    }
    const row = (l, v) => `<div class="cred"><div><span>${esc(l)}</span><code>${esc(v)}</code></div><button class="copy" data-copy="${esc(v)}">Copy</button></div>`;
    $('#ddBody').innerHTML = `
      <div class="d-head">${RM.mark(p)}<div><h3 id="ddName">${esc(p.name)}</h3><span class="cat-tag">${[p.category, p.group].filter(Boolean).map(esc).join(' · ')}</span></div></div>
      <div class="dd-bar"><span>${p.deploy ? 'Live in <b>' + esc(p.deploy) + '</b>' : esc(p.status || 'Master label · White label')}</span><b>${esc(p.price || 'Pricing on request')}</b></div>
      ${banner ? `<div class="dd-img"><img src="${esc(banner)}" alt=""></div>` : ''}
      <p class="d-blurb">${esc(p.tagline ? p.tagline + '. ' : '')}${esc(p.summary || '')}</p>
      <h4 class="dd-h">${esc(L.credsTitle || 'Sandbox credentials')} <em class="pa-badge">Test data</em></h4>
      ${(demo || hasCreds) ? `<div class="creds">${demo ? row('Demo URL', demo) : ''}${(p.demoCreds || []).map(c => row(c.label, c.value)).join('')}</div>
        <p class="muted small">${esc(p.demoNote || 'Sandbox data resets nightly. No real funds, KYC records, or on-chain transactions are created.')}</p>
        ${demo ? `<a class="btn btn-accent block" href="${esc(demo)}" target="_blank" rel="noopener">Open demo ↗</a>` : ''}`
        : `<p class="muted small">Sandbox credentials for ${esc(p.name)} are issued on request — book a call and the team will send them, usually within one business day.</p>`}
      ${features.length ? `<h4 class="dd-h">What ships with it</h4><ul class="dd-list">${features.slice(0, 8).map(f => `<li>${esc(f.t)}</li>`).join('')}</ul>` : ''}
      <button class="btn btn-ghost block dd-book" data-book="${esc(p.name)}">Book a demo call</button>`;
    RM.openOv('#demoOv');
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-demo]') && openDrawer) { e.preventDefault(); openDrawer(); } });

  /* ---------- Buy with reID: sign in (required only to buy) → payment request → approve in reID app ---------- */
  let CUR = null, payTimer = null;
  async function startBuy() {
    const p = CUR; if (!p || !p.buy || !p.buy.enabled) return;
    await RM.ready;
    if (!RM.me) return RM.signIn(location.pathname + '#buy', `Sign in to buy ${p.name}. Browsing stays open to everyone — reID is only needed to pay.`);
    let ov = document.getElementById('buyOv');
    if (!ov) { ov = document.createElement('div'); ov.id = 'buyOv'; ov.className = 'overlay center'; ov.hidden = true; document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-byx]')) { clearTimeout(payTimer); RM.closeOv('#buyOv'); } }); }
    const price = p.buy.label || `${p.buy.amount} ${p.buy.symbol || ''}`.trim();
    const set = (st, body) => { ov.innerHTML = `<div class="rq" role="dialog" aria-modal="true"><button class="x" data-byx aria-label="Close">✕</button><span class="reid-dot big">re</span><h3>Buy ${esc(p.name)}</h3><p class="rq-price">${esc(price)}</p>${body}<p class="rq-st muted">${st}</p></div>`; };
    set('Creating your payment request…', '<div class="rq-qr"><span class="rq-spin"></span></div>'); RM.openOv('#buyOv');
    let r; try { r = await fetch('/api/buy/' + encodeURIComponent(p.slug), { method: 'POST' }).then(async x => Object.assign(await x.json(), { http: x.status })); } catch (_) { r = { error: 'network' }; }
    if (r.http === 401) { RM.closeOv('#buyOv'); return RM.signIn(location.pathname + '#buy', 'Your reID session expired. Sign in again to continue.'); }
    if (!r.intentId) return set(r.error === 'wallet_tx_not_granted' ? 'Payments were not allowed when you signed in. Sign out and sign in again, and allow “Transaction requests”.' : 'Could not start the payment. Please try again later.', '');
    const phone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    set('Waiting for your approval in the reID app…', `${phone ? '' : `<div class="rq-qr">${r.qr}</div><p class="muted small">Scan with the reID app, or</p>`}<a class="btn btn-reid" href="${esc(r.approvalUrl)}" target="_blank" rel="noopener">Open reID app to approve</a><p class="muted small">Order ${esc(r.ref)} · requests expire after 15 minutes.</p>`);
    const until = Date.now() + 16 * 60000;
    const poll = () => fetch('/api/buy/status/' + encodeURIComponent(r.intentId)).then(x => x.json()).then(s => {
      if (s.status === 'broadcast') return set(`Payment sent ✓ — confirming on the INFRA chain.<br><span class="small">tx ${esc((s.txHash || '').slice(0, 12))}…${esc((s.txHash || '').slice(-8))}</span>`, '<p>Thank you! Our team will contact you to set up your product.</p>');
      if (s.status === 'denied') return set('You declined the payment in the reID app. Nothing was charged.', '<button class="btn btn-ghost" data-buy>Try again</button>');
      if (s.status === 'failed') return set('The payment could not be sent' + (s.error ? ': ' + esc(s.error) : '') + '. Nothing was charged.', '');
      if (s.status === 'expired' || Date.now() > until) return set('The request expired. Nothing was charged.', '<button class="btn btn-ghost" data-buy>Start again</button>');
      if (!ov.hidden) payTimer = setTimeout(poll, 3000);
    }).catch(() => { if (!ov.hidden) payTimer = setTimeout(poll, 5000); });
    payTimer = setTimeout(poll, 3000);
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-buy]')) { e.preventDefault(); startBuy(); } });
  window.addEventListener('rm:product-ready', () => { if (location.hash === '#buy') { history.replaceState(null, '', location.pathname + location.search); startBuy(); } });
  if (location.hash === '#try-demo') setTimeout(() => openDrawer && openDrawer(), 300);

  fetch('/api/home').then(r => r.json()).then(home => {
    const all = RM.products = home.products;
    L = (home.content && home.content.product) || {};
    const p = all.find(x => x.slug === slug);
    if (!p) { location.replace('/404'); return; }
    render(p, all, home.rows[0] ? home.rows[0].products : []);
    window.dispatchEvent(new Event('rm:product-ready'));
  });
})();
