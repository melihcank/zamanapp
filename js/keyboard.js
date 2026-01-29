// ===== KEYBOARD SHORTCUTS =====

import { $ } from './utils.js';
import { S, curScreen } from './state.js';
import { startT, pauseT, resumeT } from './timer.js';
import { recordLap, delLap } from './laps.js';
import { openNote } from './panels.js';
import { closePanels, pushPanel } from './nav.js';

// Initialize keyboard shortcuts
export function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (curScreen !== 'measure') return;

    // Don't capture when typing in input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key.toLowerCase();

    if (key === ' ' || key === 'space') {
      e.preventDefault();
      if (!S.started) startT();
      else if (!S.paused) recordLap();
    }
    else if (key === 'p') {
      e.preventDefault();
      if (!S.started) return;
      S.paused ? resumeT() : pauseT();
    }
    else if (key === '1' || key === '2' || key === '3' || key === '4') {
      e.preventDefault();
      const i = +key - 1;
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
    else if (key === 'n') {
      e.preventDefault();
      openNote();
    }
    else if (key === 'q') {
      e.preventDefault();
      $('finModal').classList.add('open');
      pushPanel();
    }
    else if (key === 'escape') {
      e.preventDefault();
      closePanels();
    }
    else if (key === 'delete' || key === 'backspace') {
      e.preventDefault();
      if (S.laps.length) {
        const last = S.laps[S.laps.length - 1];
        const card = $('lapList').querySelector(`[data-id="${last.id}"]`);
        if (card) delLap(last, card);
      }
    }
  });
}
