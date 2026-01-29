// ===== TAG EDITOR =====

import { $, toast, esc, dimColor, tagIcon } from './utils.js';
import { PALETTE, SVG_ICONS, ICON_KEYS, STEP_COLORS } from './config.js';
import { tags, setTags, measurementMode } from './state.js';
import { saveTags } from './storage.js';
import { showScreen } from './nav.js';

// Render tag editor
export function renderTagEditor() {
  const list = $('teList');
  list.innerHTML = '';

  tags.forEach((tag, i) => {
    const card = document.createElement('div');
    card.className = 'te-card';
    card.innerHTML = `<div class="te-row"><div class="te-color-preview" data-idx="${i}" style="background:${tag.color}">${tagIcon(tag)}</div><input class="te-input" data-idx="${i}" value="${esc(tag.name)}" maxlength="20"></div><div class="te-label">Renk</div><div class="te-colors" data-idx="${i}">${PALETTE.map(c => `<div class="te-swatch${c === tag.color ? ' active' : ''}" data-color="${c}" style="background:${c}"></div>`).join('')}</div><div class="te-label">İkon</div><div class="te-icons" data-idx="${i}">${ICON_KEYS.map(k => `<div class="te-icon${k === tag.icon ? ' active' : ''}" data-icon="${k}">${SVG_ICONS[k]}</div>`).join('')}</div>`;
    list.appendChild(card);
  });

  list.querySelectorAll('.te-swatch').forEach(sw => {
    sw.onclick = () => {
      const idx = sw.closest('.te-colors').dataset.idx;
      sw.closest('.te-colors').querySelectorAll('.te-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      tags[idx].color = sw.dataset.color;
      const prev = list.querySelector(`.te-color-preview[data-idx="${idx}"]`);
      prev.style.background = sw.dataset.color;
    };
  });

  list.querySelectorAll('.te-icon').forEach(ic => {
    ic.onclick = () => {
      const idx = ic.closest('.te-icons').dataset.idx;
      ic.closest('.te-icons').querySelectorAll('.te-icon').forEach(s => s.classList.remove('active'));
      ic.classList.add('active');
      tags[idx].icon = ic.dataset.icon;
      const prev = list.querySelector(`.te-color-preview[data-idx="${idx}"]`);
      prev.innerHTML = SVG_ICONS[ic.dataset.icon];
    };
  });
}

// Save tags
export function saveTagsFromEditor() {
  document.querySelectorAll('.te-input').forEach(inp => {
    tags[inp.dataset.idx].name = inp.value.trim() || tags[inp.dataset.idx].name;
  });
  saveTags(tags);
  toast('Etiketler kaydedildi', 't-ok');
  showScreen('menu');
}

// Build tag strip for measurement screen
export function buildTagStrip() {
  const strip = $('tagStrip');
  strip.innerHTML = '';
  const stepInd = $('stepIndicator');

  if (measurementMode === 'sequence') {
    // Sequence mode: show step indicator, show smaller tag strip for anomalies
    stepInd.classList.add('visible');
    // Tags shown as small anomaly buttons
    strip.style.display = 'grid';
    strip.style.gridTemplateColumns = 'repeat(4,1fr)';
    tags.forEach((tag, i) => {
      const btn = document.createElement('button');
      btn.className = 'tag-btn';
      btn.dataset.idx = i;
      btn.style.background = tag.color;
      btn.style.padding = '8px 4px';
      btn.style.fontSize = 'clamp(10px,2.8vw,12px)';
      btn.style.minHeight = '36px';
      btn.innerHTML = `${tagIcon(tag)}`;
      btn.title = tag.name + ' (anomali)';
      strip.appendChild(btn);
    });
  } else {
    // Repeat mode: show tag strip, hide step indicator
    strip.style.display = 'grid';
    strip.style.gridTemplateColumns = '1fr 1fr';
    stepInd.classList.remove('visible');
    tags.forEach((tag, i) => {
      const btn = document.createElement('button');
      btn.className = 'tag-btn';
      btn.dataset.idx = i;
      btn.style.background = tag.color;
      btn.style.padding = '';
      btn.style.fontSize = '';
      btn.style.minHeight = '';
      btn.innerHTML = `${tagIcon(tag)} ${esc(tag.name)}`;
      strip.appendChild(btn);
    });
  }
}

// Initialize tag editor events
export function initTagEditorEvents() {
  $('teSave').onclick = saveTagsFromEditor;
}
