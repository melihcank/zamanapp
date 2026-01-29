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
  let lastY = 0, velocity = 0, lastTime = 0;
  let momentumRAF = null;

  function onStart(y) {
    startY = y;
    lastY = y;
    startIdx = tempoIdx;
    dragging = true;
    velocity = 0;
    lastTime = Date.now();
    cancelAnimationFrame(momentumRAF);
    markTempoActive();
  }

  function onMove(y) {
    if (!dragging) return;

    // Calculate velocity for momentum
    const now = Date.now();
    const dt = now - lastTime;
    if (dt > 0) {
      velocity = (y - lastY) / dt;
      lastY = y;
      lastTime = now;
    }

    // Higher sensitivity: divide by smaller value (itemH / 2.5 instead of itemH)
    const itemH = wheel.offsetHeight / 5;
    const sensitivity = itemH / 2.5; // More sensitive scrolling
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
    if (!dragging) return;
    dragging = false;

    // Apply momentum
    if (Math.abs(velocity) > 0.3) {
      applyMomentum();
    }
  }

  // Momentum scrolling
  function applyMomentum() {
    const friction = 0.92;
    const minVelocity = 0.05;

    function tick() {
      velocity *= friction;

      if (Math.abs(velocity) < minVelocity) {
        velocity = 0;
        return;
      }

      // Convert velocity to index change
      const itemH = wheel.offsetHeight / 5;
      const sensitivity = itemH / 2.5;
      const deltaY = velocity * 16; // ~16ms per frame

      if (Math.abs(deltaY) > sensitivity / 3) {
        const direction = velocity > 0 ? 1 : -1;
        const newIdx = Math.max(0, Math.min(TEMPO_VALUES.length - 1, tempoIdx + direction));

        if (newIdx !== tempoIdx) {
          setTempoIdx(newIdx);
          setCurrentTempo(TEMPO_VALUES[newIdx]);
          renderTempoWheel();
          vib(3);
          markTempoActive();
        }
      }

      momentumRAF = requestAnimationFrame(tick);
    }

    momentumRAF = requestAnimationFrame(tick);
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

    // deltaY > 0 = scroll down = decrease tempo
    // deltaY < 0 = scroll up = increase tempo
    const direction = e.deltaY > 0 ? 1 : -1;
    changeTempo(direction);
  }, { passive: false });

  // Also add wheel to the wheel element itself
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
