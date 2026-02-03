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

// Double-tap feedback (disabled - using edge flash instead)
export function dtFb(paused) {
  // Removed - edge flash effect is used instead
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
  // Show pause button
  if (window.updatePauseIcon) window.updatePauseIcon();
}

// Start timer from a specific cumulative time (for resuming)
export function startFromTime(cumTime) {
  S.started = true;
  S.running = true;
  S.paused = false;
  S.startTime = getNow() - cumTime;
  S.totalPaused = 0;
  S.lastLapTime = cumTime;
  S.resumeFromTime = 0;

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
  // Show pause button
  if (window.updatePauseIcon) window.updatePauseIcon();
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
  // Edge flash effect
  const ef = $('edgeFlash');
  ef.classList.remove('flash-pause', 'flash-resume');
  void ef.offsetWidth; // Force reflow
  ef.classList.add('flash-pause');
  dtFb(true);
  vib([20, 50, 20]);
  // Update pause button icon
  if (window.updatePauseIcon) window.updatePauseIcon();
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
  // Edge flash effect
  const ef = $('edgeFlash');
  ef.classList.remove('flash-pause', 'flash-resume');
  void ef.offsetWidth; // Force reflow
  ef.classList.add('flash-resume');
  tick();
  dtFb(false);
  vib(30);
  // Update pause button icon
  if (window.updatePauseIcon) window.updatePauseIcon();
}

// Stop timer
export function stopT() {
  S.running = false;
  S.paused = false;
  S.started = false;
  cancelAnimationFrame(S.raf);
  $('timerArea').classList.remove('running', 'paused');
  // Hide pause button
  if (window.updatePauseIcon) window.updatePauseIcon();
}
