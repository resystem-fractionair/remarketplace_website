/* Shared: helpers, product data, reID session, demo-booking wizard. Used by every page. */
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RM = window.RM = { $, esc, products: [], me: null };

  /* ---------- Header & footer from Admin → Site content ---------- */
  RM.content = fetch('/api/content').then(r => r.json()).catch(() => null);
  RM.content.then(c => {
    if (!c) return;
    const go = () => {
      const hd = c.header, nav = document.querySelector('.nav-links');
      if (nav && hd.links.length) nav.innerHTML = hd.links.map(l => `<a href="${esc(l.href)}"${/^https?:/.test(l.href) ? ' target="_blank" rel="noopener"' : ''}>${esc(l.label)}</a>`).join('');
      const cta = document.querySelector('.nav .btn-dark[data-book]'); if (cta && hd.cta) cta.textContent = hd.cta;
      const q = document.getElementById('q'); if (q && hd.search) q.placeholder = hd.search;
      if (hd.announcement && !document.querySelector('.announce')) {
        const a = document.createElement(hd.announcementLink ? 'a' : 'div'); a.className = 'announce';
        if (hd.announcementLink) { a.href = hd.announcementLink; if (/^https?:/.test(hd.announcementLink)) { a.target = '_blank'; a.rel = 'noopener'; } }
        a.innerHTML = `<span>${esc(hd.announcement)}</span>${hd.announcementLink ? '<b>→</b>' : ''}`;
        document.body.prepend(a);
      }
      const f = c.footer;
      const tag = document.querySelector('.foot-grid > div:first-child p'); if (tag) tag.textContent = f.tagline;
      const cols = document.querySelectorAll('.foot-grid > div');
      if (cols[1]) cols[1].innerHTML = `<h5>${esc(f.colTitle)}</h5>` + f.links.map(l => `<a href="${esc(l.href)}"${/^https?:/.test(l.href) ? ' target="_blank" rel="noopener"' : ''}>${esc(l.label)}</a>`).join('');
      if (cols[2]) cols[2].innerHTML = `<h5>Contact</h5><a href="mailto:${esc(f.email)}">${esc(f.email)}</a>${f.linkedin ? `<a href="${esc(f.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>` : ''}${f.x ? `<a href="${esc(f.x)}" target="_blank" rel="noopener">X</a>` : ''}`;
      const fb = document.querySelector('.foot-bottom'); if (fb) fb.innerHTML = `© ${new Date().getFullYear()} ${esc(f.company)}`;
    };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
  });

  RM.loadProducts = () => fetch('/api/products').then(r => r.json()).then(list => (RM.products = list));
  RM.initials = n => String(n).replace(/^re/i, '').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean)
    .map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'RE';
  RM.mark = (p, cls) => p.logo
    ? `<span class="mark img ${cls || ''}"><img src="${esc(p.logo)}" alt="" loading="lazy"></span>`
    : `<span class="mark t-${esc(p.tone || 'a')} ${cls || ''}">${esc(RM.initials(p.name))}</span>`;

  /* ---------- Toast ---------- */
  RM.toast = msg => { const t = $('#toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(RM._tt); RM._tt = setTimeout(() => { t.hidden = true; }, 4000); };

  /* ---------- Overlays ---------- */
  RM.openOv = id => { $(id).hidden = false; document.body.classList.add('lock'); };
  RM.closeOv = id => { const el = $(id); if (el) el.hidden = true; if (![...document.querySelectorAll('.overlay')].some(o => !o.hidden)) document.body.classList.remove('lock'); };

  /* ---------- reID session ---------- */
  const ERR = { access_denied: 'Sign-in was cancelled.', not_configured: 'reID sign-in is not configured yet.',
    invalid_or_expired_request: 'Sign-in expired. Please try again.', sign_in_failed: 'reID sign-in failed. Please try again.', reid_error: 'reID returned an error.' };
  async function loadMe() {
    try { RM.me = (await fetch('/api/me').then(r => r.json())).user; } catch (_) { RM.me = null; }
    const si = $('#signin'), u = $('#user');
    if (si) { si.hidden = !!RM.me; si.href = '/api/auth/reid/start?ret=' + encodeURIComponent(location.pathname); }
    if (u) u.hidden = !RM.me;
    if (RM.me) {
      const n = RM.me.name || 'reID user';
      $('#uName').textContent = n;
      $('#uAv').textContent = n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
      u.title = RM.me.wallet ? 'Wallet ' + RM.me.wallet : '';
    }
  }
  const qs = new URLSearchParams(location.search);
  if (qs.get('reidError')) RM.toast(ERR[qs.get('reidError')] || ERR.reid_error);
  if (qs.has('reidError') || qs.has('signedIn')) history.replaceState(null, '', location.pathname + location.hash);
  RM.ready = loadMe().then(() => { if (RM.me && qs.has('signedIn')) RM.toast('Signed in as ' + (RM.me.name || 'reID user') + '.'); });
  document.addEventListener('click', async e => {
    if (e.target.id !== 'signout') return;
    await fetch('/api/auth/logout', { method: 'POST' }); RM.me = null; loadMe(); RM.toast('Signed out.');
  });

  /* ---------- Book a demo: Products → Date & time → Language & specialist → Details → Review ---------- */
  const STEPS = ['Products', 'Date & time', 'Language & specialist', 'Your details', 'Review'];
  const VTZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) { return ''; } })();
  let CFG = null, b = null;
  const loadCfg = () => CFG ? Promise.resolve(CFG) : fetch('/api/booking/config').then(r => r.json()).then(c => (CFG = c));
  const loadProducts = () => RM.products.length ? Promise.resolve(RM.products) : RM.loadProducts();
  const ymd = d => d.toISOString().slice(0, 10);
  /* Wall-clock in CFG.timezone -> Date */
  function zoned(date, time) {
    const g = new Date(`${date}T${time}:00Z`);
    const p = new Intl.DateTimeFormat('en-US', { timeZone: CFG.timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(g).reduce((o, x) => (o[x.type] = x.value, o), {});
    return new Date(g.getTime() - (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - g.getTime()));
  }
  const fmt = (d, o, tz) => new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: tz || CFG.timezone }, o)).format(d);
  const localDiffers = () => VTZ && VTZ !== CFG.timezone && fmt(new Date(), { hour: '2-digit' }, VTZ) !== fmt(new Date(), { hour: '2-digit' });

  function ensureModal() {
    if ($('#bookOv') && $('#bookOv').classList.contains('bk')) return;
    const old = $('#bookOv'); if (old) old.remove();
    const ov = document.createElement('div'); ov.className = 'overlay center bk'; ov.id = 'bookOv'; ov.hidden = true;
    ov.innerHTML = `<div class="bk-modal" role="dialog" aria-modal="true" aria-labelledby="bTitle">
      <aside class="bk-rail"><div class="bk-brand" id="bkRailT">Book a demo</div><ol id="bRail"></ol><p class="bk-rail-foot" id="bkRailN">30-minute walkthrough with a ReSystem specialist in your language.</p></aside>
      <section class="bk-main">
        <header class="bk-head"><div><span class="muted small" id="bCounter"></span><h3 id="bTitle"></h3></div><button class="x" data-close aria-label="Close">×</button></header>
        <div class="progress"><i id="bProg"></i></div>
        <div class="bk-body" id="bBody"></div>
        <footer class="bk-foot" id="bFoot"><span class="bk-sum" id="bSum"></span><button class="btn btn-ghost" id="bBack">Back</button><button class="btn btn-accent" id="bNext">Continue</button></footer>
      </section></div>`;
    document.body.appendChild(ov);
    RM.content.then(c => { if (c && c.booking) { $('#bkRailT').textContent = c.booking.railTitle; $('#bkRailN').textContent = c.booking.railNote; } });
  }

  RM.openBooking = async pre => {
    ensureModal();
    document.querySelectorAll('.overlay').forEach(o => { o.hidden = true; });
    RM.openOv('#bookOv');
    $('#bBody').innerHTML = '<p class="muted">Loading…</p>';
    await Promise.all([loadCfg(), loadProducts()]);
    const preSlug = pre && (RM.products.find(p => p.name === pre || p.slug === pre) || {}).slug;
    b = { step: preSlug ? 2 : 1, done: null, picked: preSlug ? [preSlug] : [], q: '', cat: 'All', month: null, date: '', time: '', taken: [], lang: '', specialist: '',
      name: (RM.me && RM.me.name) || '', email: (RM.me && RM.me.email) || '', company: '', phone: '', role: '', notes: '', consent: false, sending: false, err: '' };
    render();
  };

  /* availability: a slot is open if at least one specialist is free */
  const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  const dowOf = key => new Date(key + 'T12:00:00Z').getUTCDay();
  const works = (s, key, time) => s.days.includes(dowOf(key)) && (!time || (toMin(time) >= toMin(s.start) && toMin(time) + CFG.durationMin <= toMin(s.end)));
  const agentFree = (s, time) => works(s, b.date, time) && !b.taken.includes(`${s.id}|${b.date}|${time}`);
  const freeAgents = (time, lang) => CFG.specialists.filter(s => (!lang || s.langs.includes(lang)) && agentFree(s, time));
  const slotOpen = t => zoned(b.date, t).getTime() > Date.now() + CFG.minNoticeHours * 3600e3 && freeAgents(t).length > 0;
  async function pickDate(d) {
    b.date = d; b.time = ''; b.taken = []; render();
    try { b.taken = (await fetch('/api/booking/availability?date=' + d).then(r => r.json())).taken || []; } catch (_) {}
    render();
  }
  function valid(s) {
    if (s === 1) return b.picked.length > 0;
    if (s === 2) return !!b.date && !!b.time;
    if (s === 3) return !!b.lang && !!b.specialist;
    if (s === 4) return b.name.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email.trim()) && b.company.trim().length > 1 && b.consent;
    return true;
  }
  const pickedProducts = () => b.picked.map(s => RM.products.find(p => p.slug === s)).filter(Boolean);
  const agent = () => CFG.specialists.find(s => s.id === b.specialist);
  const whenLabel = () => b.date && b.time ? fmt(zoned(b.date, b.time), { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + b.time + ' GST' : '';
  const thumb = p => p.image ? `<span class="bk-th"><img src="${esc(p.image)}" alt="" loading="lazy"></span>` : `<span class="bk-th">${RM.mark(p)}</span>`;

  function render() {
    const body = $('#bBody');
    $('#bRail').innerHTML = STEPS.map((l, i) => `<li class="${b.done ? 'ok' : i + 1 < b.step ? 'ok' : i + 1 === b.step ? 'on' : ''}"><span>${(b.done || i + 1 < b.step) ? '✓' : i + 1}</span>${l}</li>`).join('');
    $('#bCounter').textContent = b.done ? 'Confirmed' : `Step ${b.step} of 5`;
    $('#bTitle').textContent = b.done ? 'You’re booked in' : ['Which products should we show you?', 'Pick a date and time', 'Language and specialist', 'Your details', 'Review and confirm'][b.step - 1];
    $('#bProg').style.width = (b.done ? 100 : b.step * 20) + '%';
    $('#bFoot').hidden = !!b.done;
    $('#bBack').hidden = b.step === 1;
    $('#bNext').textContent = b.sending ? 'Booking…' : b.step === 5 ? 'Confirm booking' : 'Continue';
    $('#bNext').disabled = b.sending || !valid(b.step);
    $('#bSum').innerHTML = [b.picked.length ? `${b.picked.length} product${b.picked.length > 1 ? 's' : ''}` : '', whenLabel(), b.lang].filter(Boolean).map(esc).join(' · ');

    if (b.done) {
      const s = new Date(b.done.start), e = new Date(b.done.end), st = s.toISOString().replace(/[-:]|\.\d{3}/g, ''), en = e.toISOString().replace(/[-:]|\.\d{3}/g, '');
      const title = 'reMarketplace demo — ' + pickedProducts().map(p => p.name).join(', ');
      const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${st}/${en}&details=${encodeURIComponent('Reference ' + b.done.ref)}`;
      const icsTxt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//reMarketplace//EN', 'BEGIN:VEVENT', `UID:${b.done.ref}@remarketplace.store`, `DTSTAMP:${st}`, `DTSTART:${st}`, `DTEND:${en}`, `SUMMARY:${title}`, `DESCRIPTION:Reference ${b.done.ref}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      const ics = URL.createObjectURL(new Blob([icsTxt], { type: 'text/calendar' }));
      body.innerHTML = `<div class="bk-done"><div class="tick">✓</div>
        <p>${b.done.emailed ? `A confirmation and calendar invite were sent to <b>${esc(b.email)}</b>.` : `Your booking is saved. The team will confirm by email at <b>${esc(b.email)}</b>.`}</p>
        <div class="summary"><div><span>Reference</span><b>${esc(b.done.ref)}</b></div>
          <div><span>When</span><b>${esc(fmt(s, { weekday: 'long', day: 'numeric', month: 'long' }))}, ${esc(b.time)} GST${localDiffers() ? `<small>Your time: ${esc(fmt(s, { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }, VTZ))}</small>` : ''}</b></div>
          <div><span>With</span><b>${esc(agent().name)}${agent().title ? ' — ' + esc(agent().title) : ''} · ${esc(b.lang)}</b></div>
          <div><span>Products</span><b>${pickedProducts().map(p => esc(p.name)).join(', ')}</b></div></div>
        <div class="bk-cal"><a class="btn btn-accent" href="${gcal}" target="_blank" rel="noopener">Add to Google Calendar</a><a class="btn btn-ghost" href="${ics}" download="remarketplace-demo.ics">Download .ics</a></div>
        <button class="btn btn-dark block" data-close>Done</button></div>`;
      return;
    }

    if (b.step === 1) {
      const cats = ['All', ...new Set(RM.products.map(p => p.category).filter(Boolean))];
      const q = b.q.toLowerCase();
      const list = RM.products.filter(p => (b.cat === 'All' || p.category === b.cat) && (!q || (p.name + ' ' + p.tagline + ' ' + p.category).toLowerCase().includes(q)));
      body.innerHTML = `<div class="bk-tools"><input type="search" data-f="q" value="${esc(b.q)}" placeholder="Search products" aria-label="Search products">
        <div class="chips">${cats.map(c => `<button class="chip${c === b.cat ? ' on' : ''}" data-bcat="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>
        <p class="muted small">Select one or more — we’ll tailor the walkthrough. <b>${b.picked.length} selected</b></p>
        <div class="bk-grid">${list.map(p => { const on = b.picked.includes(p.slug); return `
          <button class="bk-prod${on ? ' on' : ''}" data-pick="${esc(p.slug)}" aria-pressed="${on}">${p.image ? `<span class="bk-img"><img src="${esc(p.image)}" alt="" loading="lazy"></span>` : `<span class="bk-img bk-noimg">${RM.mark(p)}</span>`}
            <span class="bk-check">${on ? '✓' : ''}</span><span class="bk-pt"><b>${esc(p.name)}</b><small>${esc(p.category || '')}</small></span></button>`; }).join('')}</div>`;
    } else if (b.step === 2) {
      const today = new Date(); const first = new Date(today.getFullYear(), today.getMonth(), 1);
      if (!b.month) {
        let d0 = new Date(); for (let i = 0; i <= CFG.daysAhead; i++) { const k = ymd(d0); if (CFG.workDays.includes(d0.getDay()) && CFG.specialists.some(sp => works(sp, k)) && zoned(k, CFG.slots[CFG.slots.length - 1]).getTime() > Date.now() + CFG.minNoticeHours * 3600e3) break; d0 = new Date(d0.getTime() + 864e5); }
        b.month = new Date(d0.getFullYear(), d0.getMonth(), 1);
      }
      const lastDay = new Date(Date.now() + CFG.daysAhead * 864e5);
      const m = b.month, mStart = new Date(m.getFullYear(), m.getMonth(), 1), pad = (mStart.getDay() + 6) % 7, nDays = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < pad; i++) cells.push('<span></span>');
      for (let d = 1; d <= nDays; d++) {
        const dt = new Date(m.getFullYear(), m.getMonth(), d), key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const end = zoned(key, CFG.slots[CFG.slots.length - 1]).getTime();
        const ok = CFG.workDays.includes(dt.getDay()) && CFG.specialists.some(sp => works(sp, key)) && end > Date.now() + CFG.minNoticeHours * 3600e3 && dt <= lastDay;
        cells.push(`<button class="bk-day${key === b.date ? ' on' : ''}${key === ymd(new Date(Date.now() + 0)) ? ' today' : ''}" data-date="${key}"${ok ? '' : ' disabled'}>${d}</button>`);
      }
      const canPrev = m > first, canNext = new Date(m.getFullYear(), m.getMonth() + 1, 1) <= lastDay;
      const slots = b.date ? CFG.slots.map(t => { const open = slotOpen(t); const loc = localDiffers() ? fmt(zoned(b.date, t), { hour: '2-digit', minute: '2-digit' }, VTZ) : '';
        return `<button class="bk-slot${b.time === t ? ' on' : ''}" data-time="${t}"${open ? '' : ' disabled'}><b>${t}</b>${loc ? `<small>${loc} yours</small>` : ''}</button>`; }).join('') : '';
      body.innerHTML = `<div class="bk-dt">
        <div class="bk-cal-box"><div class="bk-mhead"><button class="icon-b" data-mon="-1"${canPrev ? '' : ' disabled'} aria-label="Previous month">‹</button><b>${m.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b><button class="icon-b" data-mon="1"${canNext ? '' : ' disabled'} aria-label="Next month">›</button></div>
          <div class="bk-dow">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(x => `<span>${x}</span>`).join('')}</div><div class="bk-days">${cells.join('')}</div></div>
        <div class="bk-slots-box"><h5>${b.date ? fmt(zoned(b.date, '12:00'), { weekday: 'long', day: 'numeric', month: 'long' }) : 'Choose a day'}</h5>
          <p class="muted small">Times in Dubai (GST)${localDiffers() ? ` · your time zone: ${esc(VTZ)}` : ''} · ${CFG.durationMin} min</p>
          ${b.date ? `<div class="bk-slots">${slots}</div>` : '<p class="muted small">Available days are highlighted on the calendar.</p>'}</div></div>`;
    } else if (b.step === 3) {
      const want = new Set(b.picked);
      const score = sp => sp.products.filter(x => want.has(x)).length;
      const list = b.lang ? CFG.specialists.filter(sp => sp.langs.includes(b.lang)).sort((x, y) => (agentFree(y, b.time) - agentFree(x, b.time)) || (score(y) - score(x))) : [];
      const best = list.find(sp => agentFree(sp, b.time) && score(sp) > 0);
      const pname = slug => (RM.products.find(p => p.slug === slug) || {}).name;
      const langs = [...new Set(CFG.specialists.flatMap(sp => sp.langs))];
      body.innerHTML = `<h5>Which language should the call be in?</h5>
        <div class="pills">${CFG.languages.filter(l => langs.includes(l)).map(l => { const n = CFG.specialists.filter(sp => sp.langs.includes(l) && agentFree(sp, b.time)).length;
          return `<button class="pill${b.lang === l ? ' on' : ''}" data-lang="${esc(l)}"${n ? '' : ' disabled'}>${esc(l)}${n ? '' : ' · none free'}</button>`; }).join('')}</div>
        ${b.lang ? `<h5>Choose who you’d like to speak with</h5><div class="bk-agents">${list.map(sp => { const free = agentFree(sp, b.time); const covers = sp.products.map(pname).filter(Boolean); return `
          <button class="bk-agent${b.specialist === sp.id ? ' on' : ''}" data-agent="${esc(sp.id)}"${free ? '' : ' disabled'}>
            ${sp.photo ? `<span class="bk-photo"><img src="${esc(sp.photo)}" alt=""></span>` : `<span class="bk-photo bk-ini">${esc(sp.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span>`}
            <span class="bk-at"><span class="bk-an"><b>${esc(sp.name)}</b>${best === sp ? '<em class="bk-best">Best match</em>' : ''}</span>${sp.title ? `<small>${esc(sp.title)}</small>` : ''}
              ${sp.bio ? `<span class="bk-bio">${esc(sp.bio)}</span>` : ''}
              <span class="bk-langs">${sp.langs.map(l => `<em${l === b.lang ? ' class="hit"' : ''}>${esc(l)}</em>`).join('')}</span>
              ${covers.length ? `<span class="bk-covers">Covers: ${covers.map(c => `<i${[...want].some(w => pname(w) === c) ? ' class="hit"' : ''}>${esc(c)}</i>`).join('')}</span>` : ''}</span>
            <span class="bk-free${free ? '' : ' off'}">${free ? '● Available ' + esc(b.time) : 'Not available at ' + esc(b.time)}</span></button>`; }).join('') || '<p class="muted small">No one speaks this language yet — please choose another.</p>'}</div>` : '<p class="muted small">Pick a language to see who is available at your time.</p>'}`;
    } else if (b.step === 4) {
      body.innerHTML = `<div class="form bk-form">
        <label>Full name *<input data-f="name" value="${esc(b.name)}" placeholder="Jane Doe" autocomplete="name"></label>
        <label>Work email *<input data-f="email" type="email" value="${esc(b.email)}" placeholder="jane@company.com" autocomplete="email"></label>
        <label>Company *<input data-f="company" value="${esc(b.company)}" placeholder="Company name" autocomplete="organization"></label>
        <label>Phone / WhatsApp<input data-f="phone" type="tel" value="${esc(b.phone)}" placeholder="+971 …" autocomplete="tel"></label>
        <label>Your role<input data-f="role" value="${esc(b.role)}" placeholder="e.g. CEO, Head of Product" autocomplete="organization-title"></label>
        <label class="wide">What would you like to cover?<textarea data-f="notes" rows="3" placeholder="Use case, timeline, questions…">${esc(b.notes)}</textarea></label>
        <label class="bk-consent wide"><input type="checkbox" data-f="consent"${b.consent ? ' checked' : ''}> I agree to be contacted by the ReSystem team about this booking.</label></div>`;
    } else {
      const s = zoned(b.date, b.time);
      body.innerHTML = `<div class="bk-review">
        <div class="bk-rv"><div class="bk-rvh"><b>Products</b><button class="link" data-goto="1">Edit</button></div><div class="bk-rvp">${pickedProducts().map(p => `<span>${thumb(p)}${esc(p.name)}</span>`).join('')}</div></div>
        <div class="bk-rv"><div class="bk-rvh"><b>Date & time</b><button class="link" data-goto="2">Edit</button></div><p>${esc(fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · ${esc(b.time)} GST · ${CFG.durationMin} min${localDiffers() ? `<br><small class="muted">Your time: ${esc(fmt(s, { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }, VTZ))}</small>` : ''}</p></div>
        <div class="bk-rv"><div class="bk-rvh"><b>Language & specialist</b><button class="link" data-goto="3">Edit</button></div><p class="bk-rva">${agent().photo ? `<img src="${esc(agent().photo)}" alt="">` : ''}<span>${esc(agent().name)}${agent().title ? ` <small class="muted">${esc(agent().title)}</small>` : ''}<br>${esc(b.lang)}</span></p></div>
        <div class="bk-rv"><div class="bk-rvh"><b>Your details</b><button class="link" data-goto="4">Edit</button></div><p>${esc(b.name)} · ${esc(b.email)}<br>${esc(b.company)}${b.phone ? ' · ' + esc(b.phone) : ''}</p>${b.notes ? `<p class="muted small">${esc(b.notes)}</p>` : ''}</div>
        ${b.err ? `<p class="bk-err">${esc(b.err)}</p>` : ''}</div>`;
    }
  }

  async function submit() {
    b.sending = true; b.err = ''; render();
    try {
      const r = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: b.picked, date: b.date, time: b.time, lang: b.lang, specialist: b.specialist, name: b.name, email: b.email, company: b.company,
          phone: b.phone, role: b.role, notes: b.notes, consent: b.consent, visitorTz: VTZ }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) { b.err = j.error; b.time = ''; b.step = 2; await pickDate(b.date); }
      else if (!r.ok) b.err = j.error || 'Could not save the booking. Please try again.';
      else b.done = j;
    } catch (_) { b.err = 'Network error — please try again.'; }
    b.sending = false; render();
    if (b.err) RM.toast(b.err);
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('button, a, .overlay');
    if (!t) return;
    const d = t.dataset;
    if (t.classList.contains('overlay') && e.target === t) return RM.closeOv('#' + t.id);
    if ('book' in d) { e.preventDefault(); return RM.openBooking(d.book || null); }
    if ('close' in d) return RM.closeOv('#' + t.closest('.overlay').id);
    if (d.copy) {
      try { navigator.clipboard.writeText(d.copy); } catch (_) {}
      const old = t.textContent; t.textContent = 'Copied'; t.classList.add('ok');
      return setTimeout(() => { t.textContent = old; t.classList.remove('ok'); }, 1400);
    }
    if (!b || !$('#bookOv') || $('#bookOv').hidden || t.disabled) return;
    if (d.pick) { const i = b.picked.indexOf(d.pick); i > -1 ? b.picked.splice(i, 1) : b.picked.push(d.pick); return render(); }
    if (d.bcat) { b.cat = d.bcat; return render(); }
    if (d.mon) { b.month = new Date(b.month.getFullYear(), b.month.getMonth() + +d.mon, 1); return render(); }
    if (d.date) return pickDate(d.date);
    if (d.time) { b.time = d.time; if (b.specialist && b.taken.includes(`${b.specialist}|${b.date}|${b.time}`)) b.specialist = ''; return render(); }
    if (d.lang) { b.lang = d.lang; const free = freeAgents(b.time, b.lang); b.specialist = free.some(s => s.id === b.specialist) ? b.specialist : (free.length === 1 ? free[0].id : ''); return render(); }
    if (d.agent) { b.specialist = d.agent; return render(); }
    if (d.goto) { b.step = +d.goto; return render(); }
    if (t.id === 'bBack') { b.step = Math.max(1, b.step - 1); return render(); }
    if (t.id === 'bNext' && valid(b.step)) { if (b.step === 5) return submit(); b.step++; $('#bBody').scrollTop = 0; return render(); }
  });
  document.addEventListener('input', e => {
    const f = e.target.dataset && e.target.dataset.f;
    if (!f || !b) return;
    b[f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (f === 'q') { const pos = e.target.selectionStart; render(); const el = $('[data-f="q"]'); el.focus(); el.setSelectionRange(pos, pos); return; }
    $('#bNext').disabled = !valid(b.step);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.overlay').forEach(o => RM.closeOv('#' + o.id)); });
  document.addEventListener('DOMContentLoaded', () => {
    const y = $('#yr'); if (y) y.textContent = new Date().getFullYear();
    const fx = document.createElement('div'); fx.className = 'bg-fx'; fx.setAttribute('aria-hidden', 'true'); fx.innerHTML = '<i></i><i></i><i></i>';
    document.body.prepend(fx);
  });
})();
