/* Shared: helpers, product data, reID session, demo-booking wizard. Used by every page. */
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RM = window.RM = { $, esc, products: [], me: null };

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

  /* ---------- Booking wizard ---------- */
  const LANGUAGES = ['English', 'Arabic', 'Hindi', 'Spanish', 'French', 'Mandarin'];
  const SLOTS = ['09:00', '09:30', '10:00', '11:00', '11:30', '13:00', '14:00', '14:30', '15:30', '16:00', '16:30'];
  const LABELS = ['Products', 'Date & time', 'Call language', 'Your details', 'Review'];
  const DAYS = (() => {
    const out = [], d = new Date(); d.setDate(d.getDate() + 1);
    while (out.length < 12) {
      if (d.getDay() % 6 !== 0) out.push({
        key: d.toISOString().slice(0, 10), dow: d.toLocaleDateString('en-GB', { weekday: 'short' }), day: d.getDate(),
        month: d.toLocaleDateString('en-GB', { month: 'short' }),
        full: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      });
      d.setDate(d.getDate() + 1);
    }
    return out;
  })();
  let b;
  const pill = (on, attr, val, label) => `<button class="pill${on ? ' on' : ''}" ${attr}="${esc(val)}">${esc(label)}</button>`;
  const refOf = () => 'RMK-' + (b.date ? b.date.replace(/-/g, '').slice(2) : '000000') + '-' + Math.max(1, b.picked.length) + 'P';
  function valid(s) {
    if (s === 1) return b.picked.length > 0;
    if (s === 2) return !!b.date && !!b.time;
    if (s === 3) return !!b.lang;
    if (s === 4) return b.name.trim().length > 1 && /.+@.+\..+/.test(b.email) && b.company.trim().length > 1;
    return true;
  }
  RM.openBooking = pre => {
    b = { step: pre ? 2 : 1, done: false, picked: pre ? [pre] : [], date: '', time: '', lang: '', name: (RM.me && RM.me.name) || '', email: (RM.me && RM.me.email) || '', company: '', notes: '' };
    document.querySelectorAll('.overlay').forEach(o => { o.hidden = true; });
    RM.openOv('#bookOv'); render();
  };
  function render() {
    const body = $('#bBody'), day = DAYS.find(d => d.key === b.date);
    $('#bCounter').textContent = b.done ? 'Confirmed' : `Step ${b.step} of 5`;
    $('#bTitle').textContent = b.done ? 'You’re booked in' : LABELS[b.step - 1];
    $('#bProg').style.width = (b.done ? 100 : b.step * 20) + '%';
    $('#bFoot').hidden = b.done;
    $('#bBack').hidden = b.step === 1;
    $('#bNext').textContent = b.step === 5 ? 'Confirm booking' : 'Continue';
    $('#bNext').disabled = !valid(b.step);
    if (b.done) {
      body.innerHTML = `<div class="done"><div class="tick">✓</div>
        <p>Our team will send a calendar invite to <b>${esc(b.email)}</b>.</p>
        <div class="summary"><div><span>Reference</span><b>${refOf()}</b></div><div><span>When</span><b>${esc(day.full)}, ${esc(b.time)} GST</b></div>
        <div><span>Products</span><b>${b.picked.map(esc).join(', ')}</b></div><div><span>Duration</span><b>${b.picked.length > 2 ? '45' : '30'} minutes</b></div></div>
        <button class="btn btn-dark block" data-close>Done</button></div>`;
      return;
    }
    if (b.step === 1) {
      body.innerHTML = `<p class="muted small">${b.picked.length} product${b.picked.length === 1 ? '' : 's'} selected</p><div class="rows">` +
        RM.products.map(p => { const on = b.picked.includes(p.name); return `
          <button class="row${on ? ' on' : ''}" data-pick="${esc(p.name)}"><span class="box">${on ? '✓' : ''}</span>${RM.mark(p)}
          <span class="row-t"><b>${esc(p.name)}</b><span>${esc(p.category)}</span></span></button>`; }).join('') + '</div>';
    } else if (b.step === 2) {
      body.innerHTML = (b.picked.length ? `<p class="muted small">For: ${b.picked.map(esc).join(', ')}</p>` : '') +
        `<h5>Pick a day</h5><div class="days">` + DAYS.map(d => `
        <button class="day${b.date === d.key ? ' on' : ''}" data-date="${d.key}"><span>${d.dow}</span><b>${d.day}</b><span>${d.month}</span></button>`).join('') +
        `</div><h5>Pick a time (Dubai, GST)</h5><div class="pills">` + SLOTS.map(t => pill(b.time === t, 'data-time', t, t)).join('') + '</div>';
    } else if (b.step === 3) {
      body.innerHTML = `<h5>Which language should the call be in?</h5><div class="pills">` + LANGUAGES.map(l => pill(b.lang === l, 'data-lang', l, l)).join('') + '</div>';
    } else if (b.step === 4) {
      body.innerHTML = `<div class="form">
        <label>Full name<input data-f="name" value="${esc(b.name)}" placeholder="Jane Doe" autocomplete="name"></label>
        <label>Work email<input data-f="email" type="email" value="${esc(b.email)}" placeholder="jane@company.com" autocomplete="email"></label>
        <label>Company<input data-f="company" value="${esc(b.company)}" placeholder="Company name" autocomplete="organization"></label>
        <label>Notes (optional)<textarea data-f="notes" rows="3" placeholder="What would you like to cover?">${esc(b.notes)}</textarea></label></div>`;
    } else {
      body.innerHTML = `<div class="summary">
        <div><span>Products</span><b>${b.picked.map(esc).join(', ')}</b></div>
        <div><span>Date</span><b>${esc(day.full)}</b></div><div><span>Time</span><b>${esc(b.time)} GST</b></div>
        <div><span>Language</span><b>${esc(b.lang)}</b></div>
        <div><span>Name</span><b>${esc(b.name)}</b></div><div><span>Email</span><b>${esc(b.email)}</b></div><div><span>Company</span><b>${esc(b.company)}</b></div>
        <div><span>Notes</span><b>${esc(b.notes || 'No additional notes.')}</b></div></div>`;
    }
  }
  async function submit() {
    const btn = $('#bNext'); btn.disabled = true; btn.textContent = 'Booking…';
    try {
      const r = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: refOf(), products: b.picked, date: b.date, time: b.time + ' GST', lang: b.lang, name: b.name, email: b.email, company: b.company, notes: b.notes }) });
      if (!r.ok) throw new Error();
      b.done = true;
    } catch (_) { RM.toast('Could not save the booking. Please try again.'); }
    render();
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
    if (!b || $('#bookOv').hidden) return;
    if (d.pick) { const i = b.picked.indexOf(d.pick); i > -1 ? b.picked.splice(i, 1) : b.picked.push(d.pick); return render(); }
    if (d.date) { b.date = d.date; return render(); }
    if (d.time) { b.time = d.time; return render(); }
    if (d.lang) { b.lang = d.lang; return render(); }
    if (t.id === 'bBack') { b.step = Math.max(1, b.step - 1); return render(); }
    if (t.id === 'bNext' && valid(b.step)) { if (b.step === 5) return submit(); b.step++; return render(); }
  });
  document.addEventListener('input', e => {
    const f = e.target.dataset && e.target.dataset.f;
    if (f && b) { b[f] = e.target.value; $('#bNext').disabled = !valid(b.step); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.overlay').forEach(o => RM.closeOv('#' + o.id)); });
  document.addEventListener('DOMContentLoaded', () => { const y = $('#yr'); if (y) y.textContent = new Date().getFullYear(); });
})();
