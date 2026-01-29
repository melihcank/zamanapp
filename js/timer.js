// ===== TIMER MODULE =====

import { $, fmt, fms, vib, getNow } from './utils.js';
import { S, measurementMode } from './state.js';

// Get elapsed time
export function getEl() {
  if (!S.started) return 0;
  if (S.paused) return S.pauseStart - S.startTime - S.totalPaused;
  return getNow() - S.startTime - S.totalPaused;
}

// Update display
export function updDisp() {
  const e = getEl();
  $('tTime').textContent = fmt(e);
  $('tMs').textContent = fms(e);
  const p = (e / 60000) % 1;
  $('ringProg').style.strokeDashoffset = 565.48 * (1 - p);
}

// Animation frame tick
export function tick() {
  updDisp();
  S.raf = requestAnimationFrame(tick);
}

// Double-tap feedback
export function dtFb(paused) {
  const dtOv = $('dtOv');
  const dtIco = $('dtIco');
  dtIco.className = 'dt-ico' + (paused ? ' pau' : '');
  dtIco.innerHTML = paused
    ? '<svg viewBox="0 0 24 24" width="32" height="32" fill="var(--wrn)"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
    : '<svg viewBox="0 0 24 24" width="32" height="32" fill="var(--acc)"><path d="M8 5v14l11-7z"/></svg>';
  dtOv.classList.add('show');
  setTimeout(() => dtOv.classList.remove('show'), 600);
}

// Start timer
export function startT() {
  S.started = true;
  S.running = true;
  S.paused = false;
  S.startTime = getNow();
  S.totalPaused = 0;
  S.lastLapTime = 0;

  $('tState').textContent = 'Çalışıyor';
  if (measurementMode === 'sequence') {
    $('tapHint').textContent = 'Ekrana dokun = Adım tamamla';
  } else {
    $('tapHint').textContent = 'Ekrana dokun = Tur kaydet';
  }
  $('timerArea').classList.add('running');
  $('timerArea').classList.remove('paused');
  tick();
  vib(30);
}

// Pause timer
export function pauseT() {
  if (!S.running || S.paused) return;
  S.paused = true;
  S.running = false;
  S.pauseStart = getNow();
  cancelAnimationFrame(S.raf);
  $('tState').textContent = 'Duraklatıldı';
  $('timerArea').classList.remove('running');
  $('timerArea').classList.add('paused');
  dtFb(true);
  vib([20, 50, 20]);
}

// Resume timer
export function resumeT() {
  if (!S.paused) return;
  S.totalPaused += getNow() - S.pauseStart;
  S.paused = false;
  S.running = true;
  $('tState').textContent = 'Çalışıyor';
  $('timerArea').classList.add('running');
  $('timerArea').classList.remove('paused');
  tick();
  dtFb(false);
  vib(30);
}

// Stop timer
export function stopT() {
  S.running = false;
  S.paused = false;
  S.started = false;
  cancelAnimationFrame(S.raf);
  $('timerArea').classList.remove('running', 'paused');
}
