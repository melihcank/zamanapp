// ===== HISTORY MODULE =====

import { $, toast, ffull, esc, dimColor } from './utils.js';
import { loadHistory, saveHistory, loadTags } from './storage.js';
import {
  S, tags, setTags, setMeasurementMode, setSequenceSteps,
  historyViewIdx, setHistoryViewIdx, hiDelTarget, setHiDelTarget,
  setSumFilterTags, setSumIncludeOutliers, setSumDateStr, setSumTimeStr,
  setNReqConfidence, setNReqError
} from './state.js';
import { showScreen, pushPanel } from './nav.js';
import { exportExcel, exportAllJSON, triggerImportJSON } from './export.js';

// Render history list
export function renderHistory() {
  const list = $('hiList');
  list.innerHTML = '';
  const hist = loadHistory();

  // Toolbar
  const tb = document.createElement('div');
  tb.className = 'hi-toolbar';
  tb.innerHTML = `<button class="btn-export btn-jn" id="hiExpJSON"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>JSON Yedekle</button><button class="btn-export btn-jn-outline" id="hiImpJSON"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>JSON İçe Aktar</button>`;
  list.appendChild(tb);
  $('hiExpJSON').onclick = exportAllJSON;
  $('hiImpJSON').onclick = triggerImportJSON;

  if (!hist.length) {
    const e = document.createElement('div');
    e.className = 'hi-empty';
    e.textContent = 'Henüz kayıtlı ölçüm yok.';
    list.appendChild(e);
    return;
  }

  hist.slice().reverse().forEach((h, ri) => {
    const idx = hist.length - 1 - ri;
    const card = document.createElement('div');
    card.className = 'hi-card';
    card.dataset.idx = idx;
    card.style.cursor = 'pointer';
    const avg = h.laps.length ? h.laps.reduce((a, l) => a + l.t, 0) / h.laps.length : 0;
    const modeBadge = h.mode === 'sequence' ? '<span style="display:inline-block;padding:1px 5px;background:var(--inf-d);color:var(--inf);border-radius:var(--r-pill);font-size:clamp(7px,2vw,9px);font-weight:700;margin-left:4px">ARDIŞIK</span>' : '';
    card.innerHTML = `<div class="hi-card-top"><span class="hi-job">${esc(h.job)}${modeBadge}</span><div class="hi-card-acts"><span class="hi-date">${h.date}</span><button class="hi-xl" data-idx="${idx}" title="Excel İndir"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg></button><button class="hi-del" data-idx="${idx}"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div></div><div class="hi-card-row">${esc(h.op)} &middot; <span>${h.laps.length}</span> ${h.mode === 'sequence' ? 'kayıt' : 'tur'} &middot; Ort: <span>${ffull(avg)}</span></div>`;
    list.appendChild(card);
  });

  // Card click -> open summary
  list.querySelectorAll('.hi-card').forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest('.hi-xl') || e.target.closest('.hi-del')) return;
      const h = loadHistory()[+card.dataset.idx];
      if (!h) return;
      openHistorySummary(h, +card.dataset.idx);
    };
  });

  list.querySelectorAll('.hi-del').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      setHiDelTarget(+btn.dataset.idx);
      $('hiDelModal').classList.add('open');
    };
  });

  list.querySelectorAll('.hi-xl').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const h = loadHistory()[+btn.dataset.idx];
      if (!h) return;
      const fn = 'zaman_etudu_' + h.job.replace(/[^a-zA-Z0-9 \-_\u00e7\u011f\u0131\u00f6\u015f\u00fc\u00c7\u011e\u0130\u00d6\u015e\u00dc]/g, '_') + '_' + (h.dateISO || h.date).slice(0, 10) + '.xlsx';
      exportExcel(h, fn);
    };
  });
}

// Open history record in summary view
export function openHistorySummary(record, idx) {
  setHistoryViewIdx(idx);
  S.op = record.op;
  S.job = record.job;
  // Set measurement mode from record
  setMeasurementMode(record.mode || 'repeat');
  // Load tags from record if available, else use current tags
  if (record.tags && record.tags.length === 4) {
    setTags(JSON.parse(JSON.stringify(record.tags)));
  }
  // Load steps for sequence mode
  if (record.mode === 'sequence' && record.steps) {
    setSequenceSteps(JSON.parse(JSON.stringify(record.steps)));
  }
  // Load laps with id generation for editing - include step info
  S.laps = record.laps.map((l, i) => ({
    id: Date.now() + Math.random() + i,
    num: i + 1,
    t: l.t,
    cum: l.cum,
    tag: l.tag,
    note: l.note || '',
    tempo: l.tempo || 100,
    nt: l.nt || l.t,
    mode: record.mode || 'repeat',
    step: l.step,
    stepName: l.stepName,
    cycle: l.cycle
  }));
  // Parse date
  const d = record.dateISO ? new Date(record.dateISO) : null;
  setSumDateStr(record.date || '');
  setSumTimeStr(d ? d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '');
  setSumFilterTags(new Set([0, 1, 2, 3, 'none']));
  setSumIncludeOutliers(true);
  // nReq parametrelerini kayıttan yükle (yoksa varsayılan)
  setNReqConfidence(record.nReqConfidence || 0.95);
  setNReqError(record.nReqError || 0.05);

  // Import and call rebuildSummary
  import('./summary.js').then(m => {
    m.rebuildSummary();
    showScreen('summary');
  });
}

// Delete history record
export function deleteHistoryRecord() {
  if (hiDelTarget === null) return;
  const h = loadHistory();
  h.splice(hiDelTarget, 1);
  saveHistory(h);
  setHiDelTarget(null);
  $('hiDelModal').classList.remove('open');
  renderHistory();
  toast('Kayıt silindi', 't-dng');
}

// Update history laps after edit
export function updateHistoryLaps() {
  const hist = loadHistory();
  if (!hist.length) return;
  const idx = historyViewIdx !== null ? historyViewIdx : hist.length - 1;
  if (!hist[idx]) return;
  hist[idx].laps = S.laps.map(l => ({
    t: l.t, cum: l.cum, tag: l.tag, note: l.note, tempo: l.tempo || 100, nt: l.nt || l.t,
    step: l.step, stepName: l.stepName, cycle: l.cycle, mode: l.mode
  }));
  hist[idx].tags = JSON.parse(JSON.stringify(tags));
  saveHistory(hist);
}

// Initialize history events
export function initHistoryEvents() {
  $('hdCancel').onclick = () => { setHiDelTarget(null); $('hiDelModal').classList.remove('open'); };
  $('hdConfirm').onclick = deleteHistoryRecord;
}
