// ===== STORAGE FUNCTIONS =====

import { DEFAULT_TAGS } from './config.js';

// Tags storage
export function loadTags() {
  try {
    const t = JSON.parse(localStorage.getItem('zt_tags'));
    if (t && t.length === 4) {
      t.forEach((tg, i) => {
        if (!tg.icon) tg.icon = ['clock', 'warn', 'tool', 'gear'][i];
      });
      return t;
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_TAGS));
}

export function saveTags(t) {
  localStorage.setItem('zt_tags', JSON.stringify(t));
}

// History storage
export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem('zt_hist')) || [];
  } catch (e) {
    return [];
  }
}

export function saveHistory(h) {
  localStorage.setItem('zt_hist', JSON.stringify(h));
}
