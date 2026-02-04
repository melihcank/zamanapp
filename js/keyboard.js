// ===== KEYBOARD SHORTCUTS =====

import { $ } from './utils.js';
import { S, curScreen } from './state.js';
import { startT, pauseT, resumeT } from './timer.js';
import { recordLap, delLap } from './laps.js';
import { closePanels, pushPanel } from './nav.js';
import { changeTempo } from './tempo.js';

// Initialize keyboard shortcuts
export function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (curScreen !== 'measure') return;

    // Don't capture when typing in input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key;
    const keyLower = key.toLowerCase();

    // Tempo controls: + and - keys (works with numpad too)
    if (key === '+' || key === '=' || key === 'ArrowUp') {
      e.preventDefault();
      changeTempo(-1); // -1 to increase tempo (go up in list)
      return;
    }
    else if (key === '-' || key === '_' || key === 'ArrowDown') {
      e.preventDefault();
      changeTempo(1); // +1 to decrease tempo (go down in list)
      return;
    }

    if (keyLower === ' ' || keyLower === 'space') {
      e.preventDefault();
      if (!S.started) startT();
      else if (!S.paused) recordLap();
    }
    else if (keyLower === 'p') {
      e.preventDefault();
      if (!S.started) return;
      S.paused ? resumeT() : pauseT();
    }
    else if (keyLower === '1' || keyLower === '2' || keyLower === '3' || keyLower === '4') {
      e.preventDefault();
      const i = +keyLower - 1;
      if (!S.started) { startT(); return; }
      if (S.paused) return;
      const btn = $('tagStrip').children[i];
      if (btn) {
        btn.classList.remove('tag-pulse');
        void btn.offsetWidth;
        btn.classList.add('tag-pulse');
      }
      recordLap(i);
    }
    else if (keyLower === 'q') {
      e.preventDefault();
      $('finModal').classList.add('open');
      pushPanel();
    }
    else if (keyLower === 'escape') {
      e.preventDefault();
      closePanels();
    }
    else if (keyLower === 'delete' || keyLower === 'backspace') {
      e.preventDefault();
      if (S.laps.length) {
        const last = S.laps[S.laps.length - 1];
        const card = $('lapList').querySelector(`[data-id="${last.id}"]`);
        if (card) delLap(last, card);
      }
    }
  });
}
