// ===== TEMPO PICKER MODULE =====

import { $, vib } from './utils.js';
import { TEMPO_VALUES } from './config.js';
import { currentTempo, tempoIdx, setCurrentTempo, setTempoIdx } from './state.js';

// Track if tempo is being adjusted (to prevent accidental lap recording)
let isAdjustingTempo = false;
let tempoAdjustTimeout = null;

export function isTempoActive() {
  return isAdjustingTempo;
}

function markTempoActive() {
  isAdjustingTempo = true;
  clearTimeout(tempoAdjustTimeout);
  tempoAdjustTimeout = setTimeout(() => { isAdjustingTempo = false; }, 400);
}

// Render tempo wheel
export function renderTempoWheel() {
  const items = $('tempoItems');
  const wheel = $('tempoWheel');
  if (!items || !wheel) return;

  const itemH = wheel.offsetHeight / 5; // show 5 items
  let html = '';

  TEMPO_VALUES.forEach((v, i) => {
    const dist = Math.abs(i - tempoIdx);
    let cls = 'tempo-item';
    if (dist === 0) cls += ' ti-active';
    else if (dist === 1) cls += ' ti-2';
    else if (dist === 2) cls += ' ti-1';
    html += `<div class="${cls}" style="height:${itemH}px;line-height:${itemH}px">${v}</div>`;
  });

  items.innerHTML = html;
  // Center active item
  const offset = (wheel.offsetHeight / 2) - (tempoIdx * itemH) - (itemH / 2);
  items.style.transform = `translateY(${offset}px)`;
}

// Set tempo value
export function setTempo(val) {
  setCurrentTempo(val);
  const idx = TEMPO_VALUES.indexOf(val);
  if (idx < 0) {
    setTempoIdx(10);
    setCurrentTempo(100);
  } else {
    setTempoIdx(idx);
  }
  renderTempoWheel();
}

// Change tempo by delta (for keyboard/wheel)
export function changeTempo(delta) {
  const newIdx = Math.max(0, Math.min(TEMPO_VALUES.length - 1, tempoIdx + delta));
  if (newIdx !== tempoIdx) {
    setTempoIdx(newIdx);
    setCurrentTempo(TEMPO_VALUES[newIdx]);
    renderTempoWheel();
    vib(5);
    markTempoActive();
  }
}

// Initialize tempo picker
export function initTempoPicker() {
  const wheel = $('tempoWheel');
  const picker = $('tempoPicker');
  if (!wheel) return;

  let startY = 0, startIdx = 0, dragging = false;

  function onStart(y) {
    startY = y;
    startIdx = tempoIdx;
    dragging = true;
    markTempoActive();
  }

  function onMove(y) {
    if (!dragging) return;

    // Sensitivity = 130% of row height - requires more movement per step
    const itemH = wheel.offsetHeight / 5;
    const sensitivity = itemH * 1.3;
    const delta = Math.round((y - startY) / sensitivity);
    let newIdx = Math.max(0, Math.min(TEMPO_VALUES.length - 1, startIdx - delta));

    if (newIdx !== tempoIdx) {
      setTempoIdx(newIdx);
      setCurrentTempo(TEMPO_VALUES[newIdx]);
      renderTempoWheel();
      vib(5);
      markTempoActive();
    }
  }

  function onEnd() {
    dragging = false;
  }

  // Mouse events
  wheel.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    onStart(e.clientY);
    const mm = ev => { ev.preventDefault(); onMove(ev.clientY); };
    const mu = () => {
      onEnd();
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mouseup', mu);
    };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
  });

  // Touch events - prevent default to stop lap recording
  wheel.addEventListener('touchstart', e => {
    e.preventDefault();
    e.stopPropagation();
    onStart(e.touches[0].clientY);
  }, { passive: false });

  wheel.addEventListener('touchmove', e => {
    e.preventDefault();
    e.stopPropagation();
    onMove(e.touches[0].clientY);
  }, { passive: false });

  wheel.addEventListener('touchend', e => {
    e.preventDefault();
    e.stopPropagation();
    onEnd();
  }, { passive: false });

  wheel.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });

  // Mouse wheel support for PC
  picker.addEventListener('wheel', e => {
    e.preventDefault();
    e.stopPropagation();
    const direction = e.deltaY > 0 ? 1 : -1;
    changeTempo(direction);
  }, { passive: false });

  wheel.addEventListener('wheel', e => {
    e.preventDefault();
    e.stopPropagation();
    const direction = e.deltaY > 0 ? 1 : -1;
    changeTempo(direction);
  }, { passive: false });

  // Initial render
  setTimeout(renderTempoWheel, 50);
}

// Get current tempo value
export function getCurrentTempoValue() {
  return currentTempo;
}
