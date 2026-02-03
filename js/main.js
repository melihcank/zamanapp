// ===== MAIN APPLICATION =====

import { $, toast, vib, esc, dimColor, getNow } from './utils.js';
import { STEP_COLORS } from './config.js';
import { S, setMeasurementMode, setSequenceSteps, measurementMode, sequenceSteps, tags, setTags, setCurrentStep, setSequenceCycle } from './state.js';
import { loadTags, saveHistory, loadHistory, loadAutoRecovery, clearAutoRecovery } from './storage.js';
import { initScreens, showScreen, initPopState, pushPanel, closePanels } from './nav.js';
import { startT, pauseT, resumeT, stopT, startFromTime } from './timer.js';
import { initTempoPicker, setTempo, isTempoActive } from './tempo.js';
import { initSequenceMode, initStepPanelEvents, renderStepIndicator } from './steps.js';
import { recordLap, refreshList } from './laps.js';
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

  // Prevent touch+click double-firing
  let touchHandled = false;

  // Timer touch events - instant response, no delay
  $('timerArea').addEventListener('touchend', e => {
    // Skip if tempo picker is being adjusted
    if (isTempoActive()) return;
    if (e.target.closest('.tempo-picker') || e.target.closest('.tempo-wheel')) return;

    e.preventDefault();
    touchHandled = true;
    setTimeout(() => touchHandled = false, 400);  // Block click for 400ms

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
  $('timerArea').addEventListener('touchstart', e => {
    // Don't prevent default on tempo picker
    if (e.target.closest('.tempo-picker') || e.target.closest('.tempo-wheel')) return;
    e.preventDefault();
  });

  // PC: click on timer (mouse only - touch handled above)
  $('timerArea').addEventListener('click', e => {
    if (touchHandled) return;  // Ignore click after touch
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

  // Tag strip - touch handler for mobile
  $('tagStrip').addEventListener('touchend', e => {
    const btn = e.target.closest('.tag-btn');
    if (!btn) return;
    e.preventDefault();
    touchHandled = true;
    setTimeout(() => touchHandled = false, 400);

    const i = +btn.dataset.idx;
    if (!S.started) { startT(); return; }
    if (S.paused) return;
    btn.classList.remove('tag-pulse');
    void btn.offsetWidth;
    btn.classList.add('tag-pulse');
    recordLap(i);
  });

  // Tag strip click (PC - mouse only)
  $('tagStrip').addEventListener('click', e => {
    if (touchHandled) return;  // Ignore click after touch
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

  // Pause/Resume button
  const pauseBtn = $('bPause');
  const pauseIcon = $('pauseIcon');
  const pauseText = $('pauseText');
  const updatePauseBtn = () => {
    // Show/hide based on timer state
    if (S.started) {
      pauseBtn.classList.add('visible');
    } else {
      pauseBtn.classList.remove('visible');
    }
    // Update icon and text based on paused state
    if (S.paused) {
      pauseIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
      pauseText.textContent = 'Devam Et';
      pauseBtn.classList.add('paused');
    } else {
      pauseIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
      pauseText.textContent = 'Duraklat';
      pauseBtn.classList.remove('paused');
    }
  };
  pauseBtn.onclick = (e) => {
    e.stopPropagation(); // Prevent triggering lap record
    if (!S.started) return;
    if (S.paused) {
      resumeT();
    } else {
      pauseT();
    }
    updatePauseBtn();
  };
  // Export for use in timer.js
  window.updatePauseIcon = updatePauseBtn;

  // Finish modal
  $('bStop').onclick = () => { $('finModal').classList.add('open'); pushPanel(); };
  $('mCancel').onclick = () => $('finModal').classList.remove('open');
  $('mConfirm').onclick = () => {
    $('finModal').classList.remove('open');
    stopT();
    saveSession();
    showSummary();
  };

  // Fullscreen - request on every interaction if not already fullscreen
  function goFS() {
    // Skip if already in fullscreen
    if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) return;
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  }
  document.addEventListener('click', goFS);
  document.addEventListener('touchend', goFS);

  // PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Kurtarma kontrolü - yarım kalan ölçüm var mı?
  checkRecovery();
}

// Yarım kalan ölçümü kontrol et ve kullanıcıya sor
function checkRecovery() {
  const recovery = loadAutoRecovery();
  if (!recovery) return;

  // Kayıt bilgilerini göster
  const lapCount = recovery.laps.length;
  const totalTime = recovery.laps.reduce((sum, l) => sum + l.t, 0);
  const mins = Math.floor(totalTime / 60000);
  const secs = Math.floor((totalTime % 60000) / 1000);
  const timeStr = mins > 0 ? `${mins} dk ${secs} sn` : `${secs} saniye`;

  const info = $('recoveryInfo');
  info.innerHTML = `
    <strong>${recovery.job || 'İsimsiz'}</strong> - ${recovery.op || 'Operasyon'}<br>
    <span style="color:var(--tx2)">${lapCount} tur, toplam ${timeStr}</span><br>
    <span style="color:var(--tx3);font-size:12px">Son kayıt: ${new Date(recovery.savedAt).toLocaleString('tr-TR')}</span>
  `;

  // Modalı göster
  $('recoveryModal').classList.add('open');

  // Sil butonu
  $('recDiscard').onclick = () => {
    clearAutoRecovery();
    $('recoveryModal').classList.remove('open');
    toast('Eski ölçüm silindi', 't-warn');
  };

  // Devam et butonu
  $('recRestore').onclick = () => {
    restoreRecovery(recovery);
    $('recoveryModal').classList.remove('open');
  };
}

// Kurtarılan veriyi yükle ve ölçüme devam et
function restoreRecovery(recovery) {
  // Mod ayarla
  setMeasurementMode(recovery.mode || 'repeat');

  // Sequence modundaysa adımları yükle
  if (recovery.mode === 'sequence' && recovery.steps) {
    setSequenceSteps(recovery.steps);
  }

  // State'i ayarla
  S.job = recovery.job || '';
  S.op = recovery.op || '';
  S.laps = recovery.laps || [];

  // Toplam süreyi hesapla
  const cumTime = S.laps.reduce((sum, l) => sum + l.t, 0);

  // Ölçüm ekranına git ve devam et modunda başlat
  $('dJob').textContent = S.job;
  $('dOp').textContent = S.op;
  showScreen('measure');

  // resumeMeasurement benzeri durum ayarla
  const now = getNow();

  S.started = true;
  S.running = false;
  S.paused = true;
  S.resumeFromTime = cumTime;
  S.lastLapTime = cumTime;
  S.startTime = now - cumTime;
  S.pauseStart = now;
  S.totalPaused = 0;

  // Ekranı güncelle
  const mins = Math.floor(cumTime / 60000);
  const secs = Math.floor((cumTime % 60000) / 1000);
  const ms = Math.floor((cumTime % 1000) / 10);
  $('tTime').textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  $('tMs').textContent = '.' + String(ms).padStart(2, '0');
  $('tState').textContent = 'DURAKLATILDI';
  $('tapHint').textContent = 'Devam etmek için butona dokun';
  $('timerArea').classList.add('paused');
  $('lapCtr').style.display = 'flex';
  $('lapN').textContent = S.laps.length;

  // Tur kartlarını yükle
  refreshList();

  // Tag strip'i göster
  buildTagStrip();

  // Sequence modunda adım göstergesini ayarla
  if (recovery.mode === 'sequence') {
    if (recovery.currentStep !== null) {
      setCurrentStep(recovery.currentStep);
    }
    if (recovery.cycle !== null) {
      setSequenceCycle(recovery.cycle);
    }
    renderStepIndicator();
    $('stepIndicator').classList.add('visible');
    $('tagStrip').style.display = 'none';
  } else {
    $('stepIndicator').classList.remove('visible');
    $('tagStrip').style.display = 'grid';
  }

  // Pause butonunu güncelle
  if (window.updatePauseIcon) window.updatePauseIcon();

  toast('Ölçüm kurtarıldı. Devam etmek için butona dokun.', 't-ok');
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

  // Başarılı kayıt sonrası geçici veriyi sil
  clearAutoRecovery();
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
