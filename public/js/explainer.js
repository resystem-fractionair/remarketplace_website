/* Narrated explainer: one audio track (voice + music) drives eight animated scenes, so picture and voice never drift. */
(function () {
  const vp = document.getElementById('vp'); if (!vp) return;
  const $ = s => vp.querySelector(s);
  const CH = [{ t: 'The problem', s: 0 }, { t: 'The solution', s: 13.27 }, { t: 'Time saving', s: 27.27 }, { t: 'Easy deployment', s: 39.69 },
    { t: 'Every platform', s: 51.26 }, { t: 'Compliant & scalable', s: 65.23 }, { t: 'List your product', s: 81.66 }, { t: 'Launch today', s: 93.63 }];
  const END = 108;
  const au = $('#vpAudio'), scenes = [...vp.querySelectorAll('.vs')];
  let cur = -1;
  const fmt = x => Math.floor(x / 60) + ':' + String(Math.floor(x % 60)).padStart(2, '0');
  $('#vpChaps').innerHTML = CH.map((c, i) => `<button data-ch="${i}"><span>${String(i + 1).padStart(2, '0')}</span>${c.t}</button>`).join('');
  $('#vpProg').insertAdjacentHTML('beforeend', CH.slice(1).map(c => `<b style="left:${c.s / END * 100}%"></b>`).join(''));
  const count = el => {
    const to = +el.dataset.to, dec = +(el.dataset.dec || 0), t0 = performance.now();
    const f = now => { const k = Math.min(1, (now - t0) / 1600), v = to * (1 - Math.pow(1 - k, 3));
      el.textContent = (el.dataset.pre || '') + (el.dataset.sep ? Math.round(v).toLocaleString('en') : v.toFixed(dec)) + (el.dataset.suf || ''); if (k < 1 && el.isConnected) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  };
  const show = i => {
    if (i === cur) return; cur = i;
    scenes.forEach((s, k) => { s.classList.toggle('on', k === i); if (k === i) { s.classList.remove('run'); void s.offsetWidth; s.classList.add('run'); s.querySelectorAll('.cnt').forEach(count); } });
    vp.querySelectorAll('#vpChaps button').forEach((b, k) => b.classList.toggle('on', k === i));
  };
  const idx = t => { let i = 0; CH.forEach((c, k) => { if (t >= c.s - .05) i = k; }); return i; };
  const tick = () => { const t = au.currentTime || 0; $('#vpFill').style.width = Math.min(100, t / END * 100) + '%'; $('#vpTime').textContent = fmt(t) + ' / ' + fmt(END); show(idx(t)); if (!au.paused) requestAnimationFrame(tick); };
  const play = () => { au.play().then(() => { vp.classList.add('playing'); tick(); }).catch(() => {}); };
  const pause = () => { au.pause(); vp.classList.remove('playing'); };
  au.addEventListener('ended', () => { vp.classList.remove('playing'); vp.classList.add('ended'); });
  au.addEventListener('pause', () => vp.classList.remove('playing'));
  au.addEventListener('play', () => { vp.classList.add('playing'); vp.classList.remove('ended'); vp.classList.add('started'); tick(); });
  $('#vpBig').onclick = play;
  $('#vpPlay').onclick = () => au.paused ? play() : pause();
  $('#vpStage').addEventListener('click', e => { if (e.target.closest('button')) return; if (vp.classList.contains('started')) au.paused ? play() : pause(); });
  $('#vpMute').onclick = () => { au.muted = !au.muted; vp.classList.toggle('muted', au.muted); };
  $('#vpFs').onclick = () => { const el = vp; (document.fullscreenElement ? document.exitFullscreen() : (el.requestFullscreen || el.webkitRequestFullscreen).call(el)); };
  $('#vpProg').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); au.currentTime = Math.max(0, Math.min(END - .5, (e.clientX - r.left) / r.width * END)); cur = -1; tick(); });
  $('#vpChaps').addEventListener('click', e => { const b = e.target.closest('[data-ch]'); if (!b) return; au.currentTime = CH[+b.dataset.ch].s; cur = -1; tick(); if (au.paused) play(); });
  /* pause when scrolled away; show first scene as the poster */
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && !au.paused) pause(); }, { threshold: .25 }).observe(vp);
  show(0);
})();
