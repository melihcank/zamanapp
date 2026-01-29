// ===== TEMPO PICKER MODULE =====

import { $, vib } from './utils.js';
import { TEMPO_VALUES } from './config.js';
import { currentTempo, tempoIdx, setCurrentTempo, setTempoIdx } from './state.js';

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

// Initialize tempo picker
export function initTempoPicker() {
  const wheel = $('tempoWheel');
  if (!wheel) return;

  let startY = 0, startIdx = 0, dragging = false;

  function onStart(y) {
    startY = y;
    startIdx = tempoIdx;
    dragging = true;
  }

  function onMove(y) {
    if (!dragging) return;
    const itemH = wheel.offsetHeight / 5;
    const delta = Math.round((y - startY) / itemH);
    let newIdx = Math.max(0, Math.min(TEMPO_VALUES.length - 1, startIdx - delta));
    if (newIdx !== tempoIdx) {
      setTempoIdx(newIdx);
      setCurrentTempo(TEMPO_VALUES[newIdx]);
      renderTempoWheel();
      vib(5);
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
    const mm = ev => onMove(ev.clientY);
    const mu = () => {
      onEnd();
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mouseup', mu);
    };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
  });

  // Touch events
  wheel.addEventListener('touchstart', e => {
    e.stopPropagation();
    onStart(e.touches[0].clientY);
  }, { passive: true });

  wheel.addEventListener('touchmove', e => {
    e.stopPropagation();
    onMove(e.touches[0].clientY);
  }, { passive: true });

  wheel.addEventListener('touchend', e => {
    e.stopPropagation();
    onEnd();
  });

  wheel.addEventListener('click', e => e.stopPropagation());

  // Initial render
  setTimeout(renderTempoWheel, 50);
}

// Get current tempo value
export function getCurrentTempoValue() {
  return currentTempo;
}
