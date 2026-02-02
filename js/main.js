// ===== MAIN APPLICATION =====

import { $, toast, vib, esc, dimColor } from './utils.js';
import { STEP_COLORS } from './config.js';
import { S, setMeasurementMode, setSequenceSteps, measurementMode, sequenceSteps, tags, setTags } from './state.js';
import { loadTags, saveHistory, loadHistory } from './storage.js';
import { initScreens, showScreen, initPopState, pushPanel, closePanels } from './nav.js';
import { startT, pauseT, resumeT, stopT, startFromTime } from './timer.js';
import { initTempoPicker, setTempo, isTempoActive } from './tempo.js';
import { initSequenceMode, initStepPanelEvents } from './steps.js';
import { recordLap } from './laps.js';
import { initPanelEvents } from './panels.js';
import { renderTagEditor, buildTagStrip, initTagEditorEvents } from './tags.js';
import { renderHistory, initHistoryEvents, updateHistoryLaps } from './history.js';
import { showSummary, rebuildSummary, initSummaryEvents, resetAll } from './summary.js';
import { initExportEvents } from './export.js';
import { initKeyboard } from './keyboard.js';

// Lock viewport dimensions on first load to prevent resize issues
function lockViewport() {
  // Only lock once on first load
  if (document.documentElement.style.getPropertyValue('--vw')) return;

  // Calculate 1vw and 1vh in pixels and store as CSS custom properties
  const vw = window.innerWidth / 100;
  const vh = window.innerHeight / 100;
  document.documentElement.style.setProperty('--vw', vw + 'px');
  document.documentElement.style.setProperty('--vh', vh + 'px');
}

// Initialize application
function init() {
  // Lock viewport dimensions before anything else
  lockViewport();

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
    // Show choice modal
    $('stepChoiceModal').classList.add('open');
    pushPanel();
  };

  // Step choice modal handlers
  $('stepChoiceNo').onclick = () => {
    $('stepChoiceModal').classList.remove('open');
    goToSequenceSetup();
  };

  $('stepChoiceYes').onclick = () => {
    $('stepChoiceModal').classList.remove('open');
    renderStepSetupList();
    showScreen('stepSetup');
  };

  // Step setup screen handlers
  $('stepSetupBack').onclick = () => showScreen('modeSelect');

  $('stepSetupAdd').onclick = () => {
    const newIdx = sequenceSteps.length;
    const color = STEP_COLORS[newIdx % STEP_COLORS.length];
    setSequenceSteps([...sequenceSteps, { name: 'Adım ' + (newIdx + 1), color }]);
    renderStepSetupList();
    // Focus the new input
    setTimeout(() => {
      const inputs = $('stepSetupList').querySelectorAll('.step-setup-input');
      if (inputs.length) inputs[inputs.length - 1].focus();
    }, 50);
  };

  $('stepSetupDone').onclick = () => {
    // Save step names from inputs
    const inputs = $('stepSetupList').querySelectorAll('.step-setup-input');
    const newSteps = [];
    inputs.forEach((inp, i) => {
      const name = inp.value.trim() || ('Adım ' + (i + 1));
      newSteps.push({ name, color: STEP_COLORS[i % STEP_COLORS.length] });
    });
    if (newSteps.length < 2) {
      toast('En az 2 adım gerekli', 't-wrn');
      return;
    }
    setSequenceSteps(newSteps);
    goToSequenceSetup();
  };

  // Go to setup screen for sequence mode
  function goToSequenceSetup() {
    $('setupTitle').textContent = 'Yeni Ölçüm — Ardışık İşlem';
    $('setupModeHint').innerHTML = 'Adımlar sırasıyla ölçülecek. Her dokunuş mevcut adımı tamamlar.<br><span style="font-size:clamp(9px,2.5vw,11px);color:var(--tx3)">Ölçüm sırasında adım isimleri değiştirilebilir ve yeni adımlar eklenebilir.</span>';
    // Show steps preview
    const preview = $('setupStepsPreview');
    preview.style.display = 'block';
    preview.innerHTML = '<div style="font-size:clamp(9px,2.5vw,11px);color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Tanımlı Adımlar (ölçüm sırasında düzenlenebilir)</div><div style="display:flex;gap:6px;flex-wrap:wrap">' + sequenceSteps.map((s, i) => `<span style="padding:4px 10px;background:${dimColor(s.color)};color:${s.color};border-radius:var(--r-pill);font-size:clamp(10px,2.8vw,12px);font-weight:600">${i + 1}. ${esc(s.name)}</span>`).join('') + '</div>';
    showScreen('setup');
  }

  // Render step setup list
  function renderStepSetupList() {
    const list = $('stepSetupList');
    list.innerHTML = '';
    sequenceSteps.forEach((step, i) => {
      const item = document.createElement('div');
      item.className = 'step-setup-item';
      item.innerHTML = `
        <div class="step-setup-num" style="background:${step.color}">${i + 1}</div>
        <input type="text" class="step-setup-input" value="${esc(step.name)}" placeholder="Adım ${i + 1}" maxlength="30" data-idx="${i}">
        <button class="step-setup-del" data-idx="${i}" ${sequenceSteps.length <= 2 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      `;
      list.appendChild(item);
    });

    // Bind delete buttons
    list.querySelectorAll('.step-setup-del').forEach(btn => {
      btn.onclick = () => {
        if (sequenceSteps.length <= 2) return;
        const idx = +btn.dataset.idx;
        const newSteps = sequenceSteps.filter((_, i) => i !== idx);
        // Renumber colors
        newSteps.forEach((s, i) => s.color = STEP_COLORS[i % STEP_COLORS.length]);
        setSequenceSteps(newSteps);
        renderStepSetupList();
      };
    });

    // Update step names on input change
    list.querySelectorAll('.step-setup-input').forEach(inp => {
      inp.oninput = () => {
        const idx = +inp.dataset.idx;
        if (sequenceSteps[idx]) {
          sequenceSteps[idx].name = inp.value.trim() || ('Adım ' + (idx + 1));
        }
      };
    });
  }

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
    // Skip if tempo picker is being adjusted
    if (isTempoActive()) return;
    if (e.target.closest('.tempo-picker') || e.target.closest('.tempo-wheel')) return;

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
      if (isTempoActive()) return; // Double-check before recording
      if (!S.started) {
        if (S.resumeFromTime > 0) {
          startFromTime(S.resumeFromTime);
        } else {
          startT();
        }
        return;
      }
      if (S.paused) return;
      recordLap();
    }, 300);
  });
  $('timerArea').addEventListener('touchstart', e => {
    // Don't prevent default on tempo picker
    if (e.target.closest('.tempo-picker') || e.target.closest('.tempo-wheel')) return;
    e.preventDefault();
  });

  // PC: click on timer
  $('timerArea').addEventListener('click', e => {
    if (e.target.closest('.lap-cc')) return;
    if (e.target.closest('.tempo-picker') || e.target.closest('.tempo-wheel')) return;
    if (isTempoActive()) return;
    if (!S.started) {
      if (S.resumeFromTime > 0) {
        startFromTime(S.resumeFromTime);
      } else {
        startT();
      }
      return;
    }
    if (S.paused) return;
    recordLap();
  });

  // PC: double-click on timer = pause/resume
  $('timerArea').addEventListener('dblclick', e => {
    if (e.target.closest('.tempo-picker') || e.target.closest('.tempo-wheel')) return;
    if (!S.started) return;
    S.paused ? resumeT() : pauseT();
  });

  // Tag strip click (works in both modes - tags are anomaly markers)
  $('tagStrip').addEventListener('click', e => {
    const btn = e.target.closest('.tag-btn');
    if (!btn) return;
    const i = +btn.dataset.idx;
    if (!S.started) { startT(); return; }
    if (S.paused) return;
    btn.classList.remove('tag-pulse');
    void btn.offsetWidth;
    btn.classList.add('tag-pulse');
    recordLap(i);  // Records lap with anomaly tag (step is recorded automatically in sequence mode)
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
      step: l.step, stepName: l.stepName, cycle: l.cycle, mode: l.mode
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
