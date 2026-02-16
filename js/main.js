// ===== MAIN APPLICATION =====

import { $, toast, vib, esc, dimColor, getNow, goFS } from './utils.js';
import { STEP_COLORS } from './config.js';
import { S, setMeasurementMode, setSequenceSteps, measurementMode, sequenceSteps, tags, setTags, setCurrentStep, setSequenceCycle, nReqConfidence, nReqError, setNReqConfidence, setNReqError } from './state.js';
import { loadTags, saveHistory, loadHistory, loadAutoRecovery, clearAutoRecovery } from './storage.js';
import { initScreens, showScreen, initPopState, pushPanel, closePanels } from './nav.js';
import { startT, pauseT, resumeT, stopT, startFromTime } from './timer.js';
import { initTempoPicker, setTempo, isTempoActive, rebuildTempoValues } from './tempo.js';
import { loadSettings, saveSettings, getInfoText, getDefaults, getSetting } from './settings.js';
import { initSequenceMode, initStepPanelEvents, renderStepIndicator } from './steps.js';
import { recordLap, refreshList, autoSaveProgress } from './laps.js';
import { initPanelEvents } from './panels.js';
import { renderTagEditor, buildTagStrip, initTagEditorEvents } from './tags.js';
import { renderHistory, initHistoryEvents, updateHistoryLaps } from './history.js';
import { showSummary, rebuildSummary, initSummaryEvents, resetAll } from './summary.js';
import { initExportEvents } from './export.js';
import { initKeyboard } from './keyboard.js';
import { initTutorial } from './tutorial.js';

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
  initTutorial();

  // Load settings & apply tempo values
  applySettings();

  // Menu navigation
  $('goMeasure').onclick = () => showScreen('modeSelect');
  $('goTags').onclick = () => { renderTagEditor(); showScreen('tagEditor'); };
  $('goHistory').onclick = () => { renderHistory(); showScreen('history'); };
  $('goSettings').onclick = () => showScreen('settings');
  $('modeBack').onclick = () => showScreen('menu');
  $('teBack').onclick = () => showScreen('menu');
  $('hiBack').onclick = () => showScreen('menu');

  // Settings navigation
  $('settingsBack').onclick = () => showScreen('menu');
  $('settingsMeasureBack').onclick = () => showScreen('settings');
  $('goSettingsMeasure').onclick = () => { loadMeasureSettings(); showScreen('settingsMeasure'); };

  // Settings info buttons
  document.querySelectorAll('.setting-info-btn').forEach(btn => {
    btn.onclick = () => {
      const info = getInfoText(btn.dataset.info);
      $('settingsInfoTitle').textContent = info.title;
      $('settingsInfoText').textContent = info.text;
      $('settingsInfoModal').classList.add('open');
      pushPanel();
    };
  });
  $('settingsInfoClose').onclick = () => $('settingsInfoModal').classList.remove('open');

  // Settings: tempo range → slider/input sınırlarını anlık güncelle
  // Sadece min < max ve ikisi de geçerli sayı olduğunda çalışır
  function syncTempoDefaultLimits() {
    const min = parseInt($('setTempoMin').value);
    const max = parseInt($('setTempoMax').value);
    if (isNaN(min) || isNaN(max) || min < 1 || min >= max) return;
    const slider = $('setTempoDefault');
    const valInput = $('setTempoDefaultVal');
    slider.min = min;
    slider.max = max;
    valInput.min = min;
    valInput.max = max;
    // Browser range input'u min/max'a göre otomatik clamp eder
    // Input'u her zaman slider'ın güncel değerine eşitle
    valInput.value = slider.value;
  }
  $('setTempoMin').oninput = syncTempoDefaultLimits;
  $('setTempoMax').oninput = syncTempoDefaultLimits;

  // Settings: tempo default slider ↔ input sync
  $('setTempoDefault').oninput = () => {
    $('setTempoDefaultVal').value = $('setTempoDefault').value;
  };
  $('setTempoDefaultVal').onchange = () => {
    let v = parseInt($('setTempoDefaultVal').value);
    if (isNaN(v) || v < 1) v = 1;
    const min = parseInt($('setTempoMin').value) || 50;
    const max = parseInt($('setTempoMax').value) || 150;
    if (v < min) v = min;
    if (v > max) v = max;
    $('setTempoDefaultVal').value = v;
    $('setTempoDefault').value = v;
  };
  // Prevent negative values on keypress
  $('setTempoDefaultVal').onkeydown = (e) => {
    if (e.key === '-' || e.key === 'e') e.preventDefault();
  };

  // Settings: auto-save pills
  document.querySelectorAll('#autoSavePills .nreq-pill').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#autoSavePills .nreq-pill').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
    };
  });

  // Settings: save measure settings
  $('settingsMeasureSave').onclick = () => {
    const settings = loadSettings();
    const min = parseInt($('setTempoMin').value) || 50;
    const max = parseInt($('setTempoMax').value) || 150;
    const step = parseInt($('setTempoStep').value) || 5;
    const def = parseInt($('setTempoDefault').value) || 100;
    const autoSavePill = document.querySelector('#autoSavePills .nreq-pill.sel');
    const autoSave = autoSavePill ? parseInt(autoSavePill.dataset.val) : 10000;

    // Validation
    if (min >= max) { toast('Min değer Max değerden küçük olmalı', 't-wrn'); return; }
    if (step < 1 || step > (max - min)) { toast('Adım değeri geçersiz', 't-wrn'); return; }
    if (def < min || def > max) { toast('Varsayılan tempo aralık içinde olmalı', 't-wrn'); return; }

    settings.measure = { tempoMin: min, tempoMax: max, tempoStep: step, tempoDefault: def, autoSaveInterval: autoSave };
    saveSettings(settings);
    applySettings();
    toast('Ölçüm ayarları kaydedildi', 't-ok');
    showScreen('settings');
  };

  // Settings: reset measure settings
  $('settingsMeasureReset').onclick = () => {
    const settings = loadSettings();
    settings.measure = getDefaults('measure');
    saveSettings(settings);
    loadMeasureSettings();
    applySettings();
    toast('Varsayılan ayarlara sıfırlandı', 't-ok');
  };

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

  // nReq parameter pill buttons
  document.querySelectorAll('#nreqConfPills .nreq-pill').forEach(btn => {
    btn.onclick = (e) => { e.preventDefault(); document.querySelectorAll('#nreqConfPills .nreq-pill').forEach(b => b.classList.remove('sel')); btn.classList.add('sel'); };
  });
  document.querySelectorAll('#nreqErrPills .nreq-pill').forEach(btn => {
    btn.onclick = (e) => { e.preventDefault(); document.querySelectorAll('#nreqErrPills .nreq-pill').forEach(b => b.classList.remove('sel')); btn.classList.add('sel'); };
  });

  // Setup form submission
  $('setupForm').onsubmit = e => {
    e.preventDefault();
    const op = $('inpOp').value.trim();
    const job = $('inpJob').value.trim();
    if (!op || !job) return;

    // Yeni ölçüm: önceki ölçümden kalan veriyi temizle
    S.laps = [];
    S.deletedTime = 0;
    S.resumeFromTime = 0;

    S.op = op;
    S.job = job;
    // nReq parametrelerini oku
    const confPill = document.querySelector('#nreqConfPills .nreq-pill.sel');
    const errPill = document.querySelector('#nreqErrPills .nreq-pill.sel');
    if (confPill) setNReqConfidence(+confPill.dataset.val);
    if (errPill) setNReqError(+errPill.dataset.val);
    $('dJob').textContent = job;
    $('dOp').textContent = op;
    // Varsayılan tempo değerini ayarlardan uygula
    setTempo(getSetting('measure', 'tempoDefault'));
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
      autoSaveProgress(); // Duraklatmada kaydet
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
  document.addEventListener('click', goFS);
  document.addEventListener('touchend', goFS);

  // Arka plana giderken otomatik kaydet (ekran kapatma, uygulama değiştirme)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.started) {
      autoSaveProgress();
    }
  });

  // Sayfa kapanırken/yenilenirken son kayıt
  window.addEventListener('beforeunload', () => {
    if (S.started) autoSaveProgress();
  });

  // Periyodik otomatik kayıt - süre ayarlardan okunur
  startAutoSaveInterval();

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

  // Gerçek geçen süreyi hesapla (kayıt anı + aradan geçen zaman)
  const lapCount = recovery.laps.length;
  const savedElapsed = recovery.elapsed || recovery.laps.reduce((sum, l) => sum + l.t, 0);
  const wasRunning = recovery.timerRunning && !recovery.timerPaused;
  const timeSinceSave = recovery.savedAt ? Date.now() - recovery.savedAt : 0;
  const realElapsed = savedElapsed + (wasRunning && timeSinceSave > 0 ? timeSinceSave : 0);

  const mins = Math.floor(realElapsed / 60000);
  const secs = Math.floor((realElapsed % 60000) / 1000);
  const timeStr = mins > 0 ? `${mins} dk ${secs} sn` : `${secs} saniye`;

  const stateStr = wasRunning ? 'çalışıyordu' : 'duraklatılmıştı';

  const info = $('recoveryInfo');
  info.innerHTML = `
    <strong>${recovery.job || 'İsimsiz'}</strong> - ${recovery.op || 'Operasyon'}<br>
    <span style="color:var(--tx2)">${lapCount} tur, kronometre ${timeStr} (${stateStr})</span><br>
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

  // nReq parametrelerini yükle
  if (recovery.nReqConfidence) setNReqConfidence(recovery.nReqConfidence);
  if (recovery.nReqError) setNReqError(recovery.nReqError);

  // Sequence modundaysa adımları yükle
  if (recovery.mode === 'sequence' && recovery.steps) {
    setSequenceSteps(recovery.steps);
  }

  // State'i ayarla
  S.job = recovery.job || '';
  S.op = recovery.op || '';
  S.laps = recovery.laps || [];

  // Kaydedilen elapsed + aradan geçen gerçek süre
  const savedElapsed = recovery.elapsed || S.laps.reduce((sum, l) => sum + l.t, 0);
  const lastLapTime = recovery.lastLapTime || S.laps.reduce((sum, l) => sum + l.t, 0);

  // Kronometre çalışır durumdayken kapandıysa, aradan geçen süreyi ekle
  const wasRunning = recovery.timerRunning && !recovery.timerPaused;
  const timeSinceSave = recovery.savedAt ? Date.now() - recovery.savedAt : 0;
  const cumTime = savedElapsed + (wasRunning && timeSinceSave > 0 ? timeSinceSave : 0);

  // Ölçüm ekranına git
  $('dJob').textContent = S.job;
  $('dOp').textContent = S.op;
  showScreen('measure');

  // Tur kartlarını yükle
  $('lapCtr').style.display = S.laps.length ? 'flex' : 'none';
  $('lapN').textContent = S.laps.length;
  refreshList();

  // Tag strip'i göster
  buildTagStrip();

  // Sequence modunda adım göstergesini ayarla
  if (recovery.mode === 'sequence') {
    if (recovery.currentStep !== null) setCurrentStep(recovery.currentStep);
    if (recovery.cycle !== null) setSequenceCycle(recovery.cycle);
    renderStepIndicator();
  }
  // buildTagStrip() already handles stepIndicator visibility and tagStrip display for both modes

  // Kronometre direkt çalışır durumda devam etsin
  startFromTime(cumTime, lastLapTime);

  toast('Ölçüm kurtarıldı, kronometre devam ediyor', 't-ok');
}

// Save current session to history
function saveSession() {
  if (!S.laps.length) return;

  // cum değerlerini t'lerden yeniden hesapla (veri bütünlüğü)
  let cumAcc = 0;
  S.laps.forEach(l => { cumAcc += l.t; l.cum = cumAcc; });

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
    cycles: measurementMode === 'sequence' ? S.laps.length > 0 ? Math.floor(S.laps.length / sequenceSteps.length) : 0 : null,
    steps: measurementMode === 'sequence' ? JSON.parse(JSON.stringify(sequenceSteps)) : null,
    nReqConfidence,
    nReqError
  });
  saveHistory(hist);

  // Başarılı kayıt sonrası geçici veriyi sil
  clearAutoRecovery();
}

// ===== SETTINGS HELPERS =====

let autoSaveTimer = null;

// Apply loaded settings to app components
function applySettings() {
  const s = loadSettings();
  const m = s.measure;
  // Rebuild tempo values
  rebuildTempoValues(m.tempoMin, m.tempoMax, m.tempoStep);
  // Update slider range to match settings
  const slider = $('setTempoDefault');
  if (slider) {
    slider.min = m.tempoMin;
    slider.max = m.tempoMax;
    slider.step = 1;
  }
  // Restart autoSave interval
  startAutoSaveInterval();
}

// Start (or restart) autoSave periodic timer
function startAutoSaveInterval() {
  if (autoSaveTimer) clearInterval(autoSaveTimer);
  const interval = getSetting('measure', 'autoSaveInterval');
  if (interval > 0) {
    autoSaveTimer = setInterval(() => {
      if (S.started && S.running && !S.paused) {
        autoSaveProgress();
      }
    }, interval);
  }
}

// Load current measure settings into the settings UI
function loadMeasureSettings() {
  const s = loadSettings();
  const m = s.measure;
  $('setTempoMin').value = m.tempoMin;
  $('setTempoMax').value = m.tempoMax;
  $('setTempoStep').value = m.tempoStep;

  // Update slider range before setting value
  const slider = $('setTempoDefault');
  slider.min = m.tempoMin;
  slider.max = m.tempoMax;
  slider.step = 1;
  slider.value = m.tempoDefault;
  const valInput = $('setTempoDefaultVal');
  valInput.value = m.tempoDefault;
  valInput.min = m.tempoMin;
  valInput.max = m.tempoMax;

  // AutoSave pills
  document.querySelectorAll('#autoSavePills .nreq-pill').forEach(b => {
    b.classList.remove('sel');
    if (parseInt(b.dataset.val) === m.autoSaveInterval) b.classList.add('sel');
  });
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
