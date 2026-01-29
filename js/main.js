// ===== MAIN APPLICATION =====

import { $, toast, vib, esc, dimColor } from './utils.js';
import { STEP_COLORS } from './config.js';
import { S, setMeasurementMode, setSequenceSteps, measurementMode, sequenceSteps, tags, setTags } from './state.js';
import { loadTags, saveHistory, loadHistory } from './storage.js';
import { initScreens, showScreen, initPopState, pushPanel, closePanels } from './nav.js';
import { startT, pauseT, resumeT, stopT } from './timer.js';
import { initTempoPicker, setTempo } from './tempo.js';
import { initSequenceMode, initStepPanelEvents } from './steps.js';
import { recordLap } from './laps.js';
import { initPanelEvents } from './panels.js';
import { renderTagEditor, buildTagStrip, initTagEditorEvents } from './tags.js';
import { renderHistory, initHistoryEvents, updateHistoryLaps } from './history.js';
import { showSummary, rebuildSummary, initSummaryEvents, resetAll } from './summary.js';
import { initExportEvents } from './export.js';
import { initKeyboard } from './keyboard.js';

// Initialize application
function init() {
  // Initialize screens
  initScreens();
  initPopState();

  // Initialize components
  initTempoPicker();
  initStepPanelEvents();
  initPanelEvents(updateHistoryLaps, rebuildSummary);
  initTagEditorEvents();
  initHistoryEvents();
  initSummaryEvents();
  initExportEvents();
  initKeyboard();

  // Menu navigation
  $('goMeasure').onclick = () => showScreen('modeSelect');
  $('goTags').onclick = () => { renderTagEditor(); showScreen('tagEditor'); };
  $('goHistory').onclick = () => { renderHistory(); showScreen('history'); };
  $('modeBack').onclick = () => showScreen('menu');
  $('teBack').onclick = () => showScreen('menu');
  $('hiBack').onclick = () => showScreen('menu');

  // Mode selection
  $('modeRepeat').onclick = () => {
    setMeasurementMode('repeat');
    $('setupTitle').textContent = 'Yeni Ölçüm — Tekrarlı';
    $('setupModeHint').textContent = 'Aynı işlem tekrar tekrar ölçülecek. Etiketler anomalileri işaretlemek için kullanılabilir.';
    $('setupStepsPreview').style.display = 'none';
    showScreen('setup');
  };

  $('modeSequence').onclick = () => {
    setMeasurementMode('sequence');
    // Reset sequence steps to defaults
    setSequenceSteps([
      { name: 'Adım 1', color: STEP_COLORS[0] },
      { name: 'Adım 2', color: STEP_COLORS[1] },
      { name: 'Adım 3', color: STEP_COLORS[2] },
      { name: 'Adım 4', color: STEP_COLORS[3] }
    ]);
    $('setupTitle').textContent = 'Yeni Ölçüm — Ardışık İşlem';
    $('setupModeHint').innerHTML = 'Adımlar sırasıyla ölçülecek. Her dokunuş mevcut adımı tamamlar.<br><span style="font-size:clamp(9px,2.5vw,11px);color:var(--tx3)">Ölçüm sırasında adım isimleri değiştirilebilir ve yeni adımlar eklenebilir.</span>';
    // Show steps preview
    const preview = $('setupStepsPreview');
    preview.style.display = 'block';
    preview.innerHTML = '<div style="font-size:clamp(9px,2.5vw,11px);color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Varsayılan Adımlar (ölçüm sırasında düzenlenebilir)</div><div style="display:flex;gap:6px;flex-wrap:wrap">' + sequenceSteps.map((s, i) => `<span style="padding:4px 10px;background:${dimColor(s.color)};color:${s.color};border-radius:var(--r-pill);font-size:clamp(10px,2.8vw,12px);font-weight:600">${i + 1}. ${esc(s.name)}</span>`).join('') + '</div>';
    showScreen('setup');
  };

  $('setupBack').onclick = () => showScreen('modeSelect');

  // Setup form submission
  $('setupForm').onsubmit = e => {
    e.preventDefault();
    const op = $('inpOp').value.trim();
    const job = $('inpJob').value.trim();
    if (!op || !job) return;
    S.op = op;
    S.job = job;
    $('dJob').textContent = job;
    $('dOp').textContent = op;
    buildTagStrip();
    if (measurementMode === 'sequence') {
      initSequenceMode();
    }
    showScreen('measure');
  };

  // Timer touch events
  let tapTO = null, lastTap = 0;
  $('timerArea').addEventListener('touchend', e => {
    e.preventDefault();
    const now = Date.now();
    const d = now - lastTap;
    lastTap = now;
    if (d < 350 && d > 0) {
      clearTimeout(tapTO);
      if (!S.started) return;
      S.paused ? resumeT() : pauseT();
      return;
    }
    tapTO = setTimeout(() => {
      if (!S.started) { startT(); return; }
      if (S.paused) return;
      recordLap();
    }, 300);
  });
  $('timerArea').addEventListener('touchstart', e => e.preventDefault());

  // PC: click on timer
  $('timerArea').addEventListener('click', e => {
    if (e.target.closest('.lap-cc')) return;
    if (!S.started) { startT(); return; }
    if (S.paused) return;
    recordLap();
  });

  // PC: double-click on timer = pause/resume
  $('timerArea').addEventListener('dblclick', e => {
    if (!S.started) return;
    S.paused ? resumeT() : pauseT();
  });

  // Tag strip click (repeat mode)
  $('tagStrip').addEventListener('click', e => {
    if (measurementMode === 'sequence') return;
    const btn = e.target.closest('.tag-btn');
    if (!btn) return;
    const i = +btn.dataset.idx;
    if (!S.started) { startT(); return; }
    if (S.paused) return;
    btn.classList.remove('tag-pulse');
    void btn.offsetWidth;
    btn.classList.add('tag-pulse');
    recordLap(i);
  });

  // Finish modal
  $('bStop').onclick = () => { $('finModal').classList.add('open'); pushPanel(); };
  $('mCancel').onclick = () => $('finModal').classList.remove('open');
  $('mConfirm').onclick = () => {
    $('finModal').classList.remove('open');
    stopT();
    saveSession();
    showSummary();
  };

  // Fullscreen
  let fsDone = false;
  function goFS() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  }
  document.addEventListener('click', () => { if (!fsDone) { fsDone = true; goFS(); } }, { once: true });
  document.addEventListener('touchend', () => { if (!fsDone) { fsDone = true; goFS(); } }, { once: true });

  // PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// Save current session to history
function saveSession() {
  if (!S.laps.length) return;
  const hist = loadHistory();
  hist.push({
    op: S.op,
    job: S.job,
    date: new Date().toLocaleDateString('tr-TR'),
    dateISO: new Date().toISOString(),
    tags: JSON.parse(JSON.stringify(tags)),
    laps: S.laps.map(l => ({
      t: l.t, cum: l.cum, tag: l.tag, note: l.note, tempo: l.tempo || 100, nt: l.nt || l.t,
      step: l.step, stepName: l.stepName, cycle: l.cycle
    })),
    mode: measurementMode,
    cycles: measurementMode === 'sequence' ? S.laps.length > 0 ? Math.ceil(S.laps.length / sequenceSteps.length) : 0 : null,
    steps: measurementMode === 'sequence' ? JSON.parse(JSON.stringify(sequenceSteps)) : null
  });
  saveHistory(hist);
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
