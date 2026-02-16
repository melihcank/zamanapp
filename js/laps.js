// ===== LAP MANAGEMENT =====

import { $, ffull, vib, esc, dimColor, tagIcon, toast, getNow } from './utils.js';
import { SVG_ICONS, STEP_COLORS } from './config.js';
import {
  S, tags, measurementMode,
  currentStep, sequenceSteps, sequenceCycle,
  currentTempo, nReqConfidence, nReqError
} from './state.js';
import { getEl } from './timer.js';
import { advanceStep } from './steps.js';
import { openTP, openNote } from './panels.js';
import { saveAutoRecovery } from './storage.js';
import { calcStats } from './stats.js';

// Record a lap
export function recordLap(tagIdx = null) {
  if (!S.started || S.paused) return;

  const cum = getEl();
  const lt = cum - S.lastLapTime;
  S.lastLapTime = cum;

  const tempo = currentTempo;
  const nt = lt * (tempo / 100); // normal time

  // Build lap object - step and tag are separate concepts
  const lap = {
    id: Date.now() + Math.random(),
    num: S.laps.length + 1,
    t: lt,
    cum,
    tag: tagIdx, // anomaly tag (null if none)
    note: '',
    tempo,
    nt,
    mode: measurementMode
  };

  // In sequence mode, also record the step
  if (measurementMode === 'sequence') {
    lap.step = currentStep;
    lap.stepName = sequenceSteps[currentStep]?.name || ('Adım ' + (currentStep + 1));
    lap.cycle = sequenceCycle;
  }

  S.laps.push(lap);
  $('timerArea').classList.remove('pulse');
  void $('timerArea').offsetWidth;
  $('timerArea').classList.add('pulse');
  $('lapCtr').style.display = 'flex';
  $('lapN').textContent = S.laps.length;
  renderCard(lap, true);
  vib(15);

  // In sequence mode, advance to next step
  if (measurementMode === 'sequence') {
    advanceStep();
  }

  // Otomatik kaydet - veri kaybını önle
  autoSaveProgress();

  updateLiveNReq();
}

// Ölçüm ilerlemesini otomatik kaydet
export function autoSaveProgress() {
  if (!S.started) return;
  saveAutoRecovery({
    job: S.job,
    op: S.op,
    laps: S.laps,
    elapsed: getEl(),
    lastLapTime: S.lastLapTime,
    timerRunning: S.running,
    timerPaused: S.paused,
    mode: measurementMode,
    steps: measurementMode === 'sequence' ? sequenceSteps : null,
    currentStep: measurementMode === 'sequence' ? currentStep : null,
    cycle: measurementMode === 'sequence' ? sequenceCycle : null,
    nReqConfidence,
    nReqError
  });
}

// Render a lap card
export function renderCard(lap, isNew) {
  const card = document.createElement('div');
  card.className = 'lap-card' + (isNew ? ' new-lap' : '');
  card.dataset.id = lap.id;
  const tag = lap.tag !== null && lap.tag !== undefined ? tags[lap.tag] : null;

  // In sequence mode, step determines the stripe color; tag is for anomalies
  let sc = '#555';
  if (lap.mode === 'sequence' && lap.step !== undefined) {
    sc = STEP_COLORS[lap.step % STEP_COLORS.length];
  } else if (tag) {
    sc = tag.color;
  }

  // Step badge for sequence mode
  const stepBadge = (lap.mode === 'sequence' && lap.stepName)
    ? `<span class="lap-badge" style="background:${dimColor(STEP_COLORS[lap.step % STEP_COLORS.length])};color:${STEP_COLORS[lap.step % STEP_COLORS.length]}">${esc(lap.stepName)}</span>`
    : '';

  // Anomaly tag badge (shown in both modes)
  const tagBadge = tag
    ? `<span class="lap-badge" style="background:${dimColor(tag.color)};color:${tag.color}">${tagIcon(tag)}</span>`
    : '';

  const noteH = lap.note ? `<div class="lap-note">${esc(lap.note)}</div>` : '';
  const tempo = lap.tempo || 100;
  const tempoClass = tempo < 100 ? 'tempo-slow' : (tempo > 100 ? 'tempo-fast' : '');
  const tempoBadge = tempo !== 100 ? `<span class="lap-tempo ${tempoClass}">%${tempo}</span>` : '';

  // Combine badges: step first, then tempo, then anomaly tag
  const allBadges = stepBadge + tempoBadge + tagBadge;

  card.innerHTML = `<div class="swipe-bg sw-r" style="background:rgba(76,175,80,0.2);color:#4CAF50"><svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg> Not Ekle</div><div class="swipe-bg sw-l"><svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg> Sil</div><div class="lap-cc"><div class="lap-stripe" style="background:${sc}"></div><div class="lap-num">#${lap.num}</div><div class="lap-info"><div class="lap-info-top"><span class="lap-tm">${ffull(lap.t)}</span>${allBadges}</div><div class="lap-cum">Toplam: ${ffull(lap.cum)}</div>${noteH}</div></div><div class="lap-actions"><button class="lap-act-btn act-tag" title="Anomali Etiketle">${SVG_ICONS.tag}</button><button class="lap-act-btn act-del" title="Sil">${SVG_ICONS.del}</button></div>`;

  $('lapList').insertBefore(card, $('lapList').firstChild);
  setupSwipe(card, lap);

  // PC: action buttons
  card.querySelector('.act-tag').onclick = (e) => { e.stopPropagation(); openTP(lap, card); };
  card.querySelector('.act-del').onclick = (e) => { e.stopPropagation(); delLap(lap, card); };
  // PC: right-click
  card.addEventListener('contextmenu', e => { e.preventDefault(); openTP(lap, card); });
}

// Update card display
export function updCard(card, lap) {
  const tag = lap.tag !== null ? tags[lap.tag] : null;
  const s = card.querySelector('.lap-stripe');
  if (s) s.style.background = tag ? tag.color : '#555';
  const top = card.querySelector('.lap-info-top');
  const old = top.querySelector('.lap-badge');
  if (old) old.remove();
  if (tag) {
    const b = document.createElement('span');
    b.className = 'lap-badge';
    b.style.background = dimColor(tag.color);
    b.style.color = tag.color;
    b.innerHTML = `${tagIcon(tag)} ${esc(tag.name)}`;
    top.appendChild(b);
  }
  const info = card.querySelector('.lap-info');
  const on = card.querySelector('.lap-note');
  if (on) on.remove();
  if (lap.note) {
    const n = document.createElement('div');
    n.className = 'lap-note';
    n.textContent = lap.note;
    info.appendChild(n);
  }
}

// Refresh entire lap list
export function refreshList() {
  $('lapList').innerHTML = '';
  for (let i = 0; i < S.laps.length; i++) {
    renderCard(S.laps[i], false);
  }
}

// Delete a lap
export function delLap(lap, card) {
  const deletedTime = lap.t;
  card.style.transition = 'transform .25s,opacity .25s';
  card.style.transform = 'translateX(-100%)';
  card.style.opacity = '0';

  setTimeout(() => {
    const i = S.laps.findIndex(l => l.id === lap.id);
    if (i > -1) {
      S.laps.splice(i, 1);
      // Recalc nums and cumulative times
      let cum = 0;
      S.laps.forEach((l, j) => { l.num = j + 1; cum += l.t; l.cum = cum; });
      // Silinen süreyi kaydet - kronometre geri sarsın
      S.deletedTime += deletedTime;
      S.lastLapTime -= deletedTime;
      if (S.lastLapTime < 0) S.lastLapTime = 0;
      // Rewind effect on timer
      const ta = $('timerArea');
      ta.classList.remove('rewind');
      void ta.offsetWidth;
      ta.classList.add('rewind');
      setTimeout(() => ta.classList.remove('rewind'), 500);
    }
    card.remove();
    // Update all lap cards (num + cumulative)
    const cards = $('lapList').querySelectorAll('.lap-card');
    const tot = S.laps.length;
    cards.forEach((c, di) => {
      const li = tot - 1 - di;
      if (S.laps[li]) {
        const n = c.querySelector('.lap-num');
        if (n) n.textContent = '#' + S.laps[li].num;
        const cumEl = c.querySelector('.lap-cum');
        if (cumEl) cumEl.textContent = 'Toplam: ' + ffull(S.laps[li].cum);
      }
    });
    $('lapN').textContent = S.laps.length;
    if (!S.laps.length) $('lapCtr').style.display = 'none';
    toast('Tur silindi', 't-dng');
    updateLiveNReq();
  }, 250);

  vib([10, 30, 10]);
}

// Swipe handling
function setupSwipe(card, lap) {
  const cc = card.querySelector('.lap-cc');
  let sx = 0, sy = 0, cx = 0, drag = false, hz = null;
  const th = 80;

  function onStart(x, y) { sx = x; sy = y; cx = x; drag = true; hz = null; cc.style.transition = 'none'; }
  function onMove(x, y, e) {
    if (!drag) return;
    cx = x;
    const dx = cx - sx, dy = y - sy;
    if (hz === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) hz = Math.abs(dx) > Math.abs(dy);
    if (!hz) return;
    if (e) e.preventDefault(); // prevent vertical scroll during horizontal swipe
    cc.style.transform = `translateX(${Math.max(-120, Math.min(120, dx))}px)`;
  }
  function onEnd() {
    if (!drag) return;
    drag = false;
    cc.style.transition = 'transform .2s';
    if (!hz) { cc.style.transform = 'translateX(0)'; return; }
    const dx = cx - sx;
    if (dx > th) {
      // Sağa kaydır → Not ekle
      cc.style.transform = 'translateX(0)';
      openNote(lap.id);
      vib(15);
    } else if (dx < -th) {
      delLap(lap, card);
    } else {
      cc.style.transform = 'translateX(0)';
    }
  }

  // Touch
  cc.addEventListener('touchstart', e => { onStart(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  cc.addEventListener('touchmove', e => { onMove(e.touches[0].clientX, e.touches[0].clientY, e); }, { passive: false });
  cc.addEventListener('touchend', onEnd);
  // Mouse drag
  cc.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    onStart(e.clientX, e.clientY);
    const mm = ev => onMove(ev.clientX, ev.clientY);
    const mu = () => { onEnd(); document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
  });
}

// Recalculate lap numbers and cumulative times
export function recalcLaps() {
  let cum = 0;
  S.laps.forEach((l, i) => { l.num = i + 1; cum += l.t; l.cum = cum; });
}

// Live nReq indicator on timer area
export function updateLiveNReq() {
  const el = $('nreqLive');
  if (!el) return;

  let times, n, label;

  if (measurementMode === 'sequence') {
    const stepCount = sequenceSteps.length;
    if (stepCount < 1) { el.classList.remove('visible'); return; }
    const completeCycles = Math.floor(S.laps.length / stepCount);
    const cycleTimes = [];
    for (let c = 0; c < completeCycles; c++) {
      let ct = 0;
      for (let s = 0; s < stepCount; s++) ct += S.laps[c * stepCount + s].t;
      cycleTimes.push(ct);
    }
    times = cycleTimes;
    n = times.length;
    label = 'çevrim';
  } else {
    times = S.laps.map(l => l.t);
    n = times.length;
    label = 'gözlem';
  }

  if (n < 2) { el.classList.remove('visible'); return; }

  const stats = calcStats(times, { confidence: nReqConfidence, errorMargin: nReqError });
  if (!stats) { el.classList.remove('visible'); return; }

  const unit = measurementMode === 'sequence' ? 'çevrim' : 'tur';
  const ok = n >= stats.nReq;
  el.classList.add('visible');
  el.classList.toggle('ok', ok);
  el.classList.toggle('warn', !ok);
  el.textContent = ok
    ? `${n} ${unit} ✓ Yeterli`
    : `${n} ${unit} · ${stats.nReq} gerekli`;
}
