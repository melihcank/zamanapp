// ===== MAIN APPLICATION =====

import { $, toast, vib, esc, dimColor, getNow, goFS, exitFS } from './utils.js';
import { STEP_COLORS } from './config.js';
import { S, setMeasurementMode, setSequenceSteps, measurementMode, sequenceSteps, tags, setTags, setCurrentStep, setSequenceCycle, nReqConfidence, nReqError, setNReqConfidence, setNReqError } from './state.js';
import { loadTags, saveHistory, loadHistory, loadAutoRecovery, clearAutoRecovery } from './storage.js';
import { initScreens, showScreen, initPopState, pushPanel, closePanels } from './nav.js';
import { startT, pauseT, resumeT, stopT, startFromTime, onPauseChange } from './timer.js';
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

// Fullscreen - module scope for applySettings access
let fsRequested = false;
function reqFS() {
  if (fsRequested) return;
  goFS();
  fsRequested = true;
  removeFsListeners();
}
function addFsListeners() {
  document.addEventListener('click', reqFS);
  document.addEventListener('touchend', reqFS);
}
function removeFsListeners() {
  document.removeEventListener('click', reqFS);
  document.removeEventListener('touchend', reqFS);
}

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
  $('goHistory').onclick = () => { renderHistory(); showScreen('history'); };
  $('goSettings').onclick = () => showScreen('settings');
  $('modeBack').onclick = () => showScreen('menu');
  $('teBack').onclick = () => showScreen('settingsMeasure');
  $('hiBack').onclick = () => showScreen('menu');

  // Settings navigation
  $('settingsBack').onclick = () => showScreen('menu');
  $('settingsMeasureBack').onclick = () => showScreen('settings');
  $('goSettingsMeasure').onclick = () => { loadMeasureSettings(); showScreen('settingsMeasure'); };
  $('settingsStatsBack').onclick = () => showScreen('settings');
  $('goSettingsStats').onclick = () => { loadStatsSettings(); showScreen('settingsStats'); };
  $('settingsExcelBtn')?.addEventListener('click', () => { loadExcelSettings(); showScreen('settingsExcel'); });
  $('settingsExcelBack')?.addEventListener('click', () => showScreen('settings'));
  $('goSettingsUx')?.addEventListener('click', () => { loadUxSettings(); showScreen('settingsUx'); });
  $('settingsUxBack')?.addEventListener('click', () => showScreen('settings'));
  $('goTagEditor').onclick = () => { renderTagEditor(); showScreen('tagEditor'); };

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

  // Settings: tempo range → slider/input sınırlarını anlık güncelle (100-merkezli)
  function syncTempoDefaultLimits() {
    const min = parseInt($('setTempoMin').value);
    const max = parseInt($('setTempoMax').value);
    const step = parseInt($('setTempoStep').value);
    if (isNaN(min) || isNaN(max) || isNaN(step) || min < 1 || min >= max || step < 1) return;
    // 100'den merkezli hizalanmış min/max hesapla
    let alignedMin = 100;
    while (alignedMin - step >= min) alignedMin -= step;
    let alignedMax = 100;
    while (alignedMax + step <= max) alignedMax += step;
    const slider = $('setTempoDefault');
    const valInput = $('setTempoDefaultVal');
    slider.min = alignedMin;
    slider.max = alignedMax;
    slider.step = step;
    valInput.min = alignedMin;
    valInput.max = alignedMax;
    valInput.step = step;
    valInput.value = slider.value;
  }
  $('setTempoMin').oninput = syncTempoDefaultLimits;
  $('setTempoMax').oninput = syncTempoDefaultLimits;
  $('setTempoStep').oninput = syncTempoDefaultLimits;

  // Settings: tempo default slider ↔ input sync
  $('setTempoDefault').oninput = () => {
    $('setTempoDefaultVal').value = $('setTempoDefault').value;
  };
  $('setTempoDefaultVal').onchange = () => {
    let v = parseInt($('setTempoDefaultVal').value);
    if (isNaN(v) || v < 1) v = 100;
    // Slider'a atayınca browser otomatik step'e snap eder
    const slider = $('setTempoDefault');
    slider.value = v;
    $('setTempoDefaultVal').value = slider.value;
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

  // ===== STATS SETTINGS =====

  // Stats: slider ↔ input sync
  $('setIqrMultiplier').oninput = () => $('setIqrMultiplierVal').value = $('setIqrMultiplier').value;
  $('setIqrMultiplierVal').onchange = () => {
    let v = parseFloat($('setIqrMultiplierVal').value);
    if (isNaN(v) || v < 0.5) v = 0.5;
    if (v > 3.0) v = 3.0;
    $('setIqrMultiplier').value = v;
    $('setIqrMultiplierVal').value = v;
    // Update preset pill selection
    document.querySelectorAll('#iqrPresets .nreq-pill').forEach(x => {
      x.classList.toggle('sel', parseFloat(x.dataset.val) === v);
    });
  };

  $('setMovingAvgWindow').oninput = () => $('setMovingAvgWindowVal').value = $('setMovingAvgWindow').value;
  $('setMovingAvgWindowVal').onchange = () => {
    let v = parseInt($('setMovingAvgWindowVal').value);
    if (isNaN(v) || v < 2) v = 2;
    if (v > 10) v = 10;
    $('setMovingAvgWindow').value = v;
    $('setMovingAvgWindowVal').value = v;
  };

  $('setHistogramBins').oninput = () => $('setHistogramBinsVal').value = $('setHistogramBins').value;
  $('setHistogramBinsVal').onchange = () => {
    let v = parseInt($('setHistogramBinsVal').value);
    if (isNaN(v) || v < 5) v = 5;
    if (v > 30) v = 30;
    $('setHistogramBins').value = v;
    $('setHistogramBinsVal').value = v;
  };

  $('setTrendThreshold').oninput = () => $('setTrendThresholdVal').value = $('setTrendThreshold').value;
  $('setTrendThresholdVal').onchange = () => {
    let v = parseFloat($('setTrendThresholdVal').value);
    if (isNaN(v) || v < 0.01) v = 0.01;
    if (v > 0.50) v = 0.50;
    $('setTrendThreshold').value = v;
    $('setTrendThresholdVal').value = v;
  };

  // Stats: IQR preset pills → update slider + input
  document.querySelectorAll('#iqrPresets .nreq-pill').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('#iqrPresets .nreq-pill').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      const v = parseFloat(b.dataset.val);
      $('setIqrMultiplier').value = v;
      $('setIqrMultiplierVal').value = v;
    };
  });

  // Stats: single-select pill groups
  document.querySelectorAll('#modeRoundingPills .nreq-pill').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('#modeRoundingPills .nreq-pill').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
    };
  });
  document.querySelectorAll('#defaultConfPills .nreq-pill').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('#defaultConfPills .nreq-pill').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
    };
  });
  document.querySelectorAll('#defaultErrPills .nreq-pill').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('#defaultErrPills .nreq-pill').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
    };
  });

  // Stats: percentile pills (multi-select toggle)
  document.querySelectorAll('#percentilePills .nreq-pill').forEach(b => {
    b.onclick = () => b.classList.toggle('sel');
  });

  // Stats: save
  $('settingsStatsSave').onclick = () => {
    const settings = loadSettings();
    const iqr = parseFloat($('setIqrMultiplierVal').value) || 1.5;
    const maw = parseInt($('setMovingAvgWindowVal').value) || 5;
    const bins = parseInt($('setHistogramBinsVal').value) || 10;
    const modeRPill = document.querySelector('#modeRoundingPills .nreq-pill.sel');
    const modeR = modeRPill ? parseInt(modeRPill.dataset.val) : 10;
    const percArr = [];
    document.querySelectorAll('#percentilePills .nreq-pill.sel').forEach(b => percArr.push(parseInt(b.dataset.val)));
    percArr.sort((a, b) => a - b);
    const trend = parseFloat($('setTrendThresholdVal').value) || 0.10;
    const confPill = document.querySelector('#defaultConfPills .nreq-pill.sel');
    const conf = confPill ? parseFloat(confPill.dataset.val) : 0.95;
    const errPill = document.querySelector('#defaultErrPills .nreq-pill.sel');
    const errM = errPill ? parseFloat(errPill.dataset.val) : 0.05;

    // Validation
    if (iqr < 0.5 || iqr > 3.0) { toast('IQR çarpanı 0.5 - 3.0 arasında olmalı', 't-wrn'); return; }
    if (maw < 2 || maw > 10) { toast('Hareketli ortalama penceresi 2 - 10 arasında olmalı', 't-wrn'); return; }
    if (bins < 5 || bins > 30) { toast('Histogram bin sayısı 5 - 30 arasında olmalı', 't-wrn'); return; }
    if (percArr.length === 0) { toast('En az bir yüzdelik dilim seçilmeli', 't-wrn'); return; }
    if (trend < 0.01 || trend > 0.50) { toast('Trend eşiği 0.01 - 0.50 arasında olmalı', 't-wrn'); return; }

    settings.stats = {
      iqrMultiplier: iqr,
      movingAvgWindow: maw,
      histogramBins: bins,
      modeRounding: modeR,
      percentiles: percArr,
      trendThreshold: trend,
      defaultConfidence: conf,
      defaultErrorMargin: errM
    };
    saveSettings(settings);
    applySettings();
    toast('İstatistik ayarları kaydedildi', 't-ok');
    showScreen('settings');
  };

  // Stats: reset
  $('settingsStatsReset').onclick = () => {
    const settings = loadSettings();
    settings.stats = getDefaults('stats');
    saveSettings(settings);
    loadStatsSettings();
    applySettings();
    toast('Varsayılan ayarlara sıfırlandı', 't-ok');
  };

  // ===== EXCEL SETTINGS =====

  // Excel: decimal slider ↔ input sync
  $('excelDecimalSlider').oninput = () => $('excelDecimalInput').value = $('excelDecimalSlider').value;
  $('excelDecimalInput').onchange = () => {
    let v = parseInt($('excelDecimalInput').value);
    if (isNaN(v) || v < 1) v = 1;
    if (v > 6) v = 6;
    $('excelDecimalSlider').value = v;
    $('excelDecimalInput').value = v;
  };

  // Excel: date pills (single-select)
  document.querySelectorAll('#excelDatePills .nreq-pill').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('#excelDatePills .nreq-pill').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
    };
  });

  // Excel: sheet pills (multi-select, mandatory excluded via CSS pointer-events:none)
  document.querySelectorAll('#excelSheetPills .nreq-pill:not(.mandatory)').forEach(b => {
    b.onclick = () => b.classList.toggle('sel');
  });
  document.querySelectorAll('#excelSeqSheetPills .nreq-pill').forEach(b => {
    b.onclick = () => b.classList.toggle('sel');
  });

  // ===== UX SETTINGS =====

  // UX: single-select pill groups
  document.querySelectorAll('#uxThemePills .nreq-pill').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('#uxThemePills .nreq-pill').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
    };
  });
  document.querySelectorAll('#uxVibrationPills .nreq-pill').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('#uxVibrationPills .nreq-pill').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
    };
  });
  document.querySelectorAll('#uxToastPills .nreq-pill').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('#uxToastPills .nreq-pill').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
    };
  });
  document.querySelectorAll('#uxFullscreenPills .nreq-pill').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('#uxFullscreenPills .nreq-pill').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      // Açık seçilince anında tam ekrana geç
      if (b.dataset.val === 'true') {
        goFS();
        fsRequested = true;
        addFsListeners();
      }
    };
  });

  // UX: save
  $('settingsUxSave').onclick = () => {
    const settings = loadSettings();
    const themePill = document.querySelector('#uxThemePills .nreq-pill.sel');
    const vibPill = document.querySelector('#uxVibrationPills .nreq-pill.sel');
    const toastPill = document.querySelector('#uxToastPills .nreq-pill.sel');
    const fsPill = document.querySelector('#uxFullscreenPills .nreq-pill.sel');
    settings.ux = {
      theme: themePill ? themePill.dataset.val : 'dark',
      vibration: vibPill ? vibPill.dataset.val === 'true' : true,
      toastDuration: toastPill ? parseInt(toastPill.dataset.val) : 2000,
      fullscreen: fsPill ? fsPill.dataset.val === 'true' : true
    };
    saveSettings(settings);
    applySettings();
    // Kapalı + Kaydet → tam ekrandan çık
    if (!settings.ux.fullscreen) exitFS();
    toast('Görünüm ayarları kaydedildi', 't-ok');
    showScreen('settings');
  };

  // UX: reset
  $('settingsUxReset').onclick = () => {
    const settings = loadSettings();
    settings.ux = getDefaults('ux');
    saveSettings(settings);
    loadUxSettings();
    applySettings();
    // Varsayılan: fullscreen açık → tam ekrana geç
    if (settings.ux.fullscreen) { goFS(); fsRequested = true; addFsListeners(); }
    toast('Varsayılan ayarlara sıfırlandı', 't-ok');
  };

  // Excel: save
  $('settingsExcelSave').onclick = () => {
    const settings = loadSettings();
    const dp = parseInt($('excelDecimalInput').value) || 3;
    const datePill = document.querySelector('#excelDatePills .nreq-pill.sel');
    const dateFormat = datePill ? datePill.dataset.val : 'tr';

    // Validation
    if (dp < 1 || dp > 6) { toast('Ondalık hassasiyet 1-6 arasında olmalı', 't-wrn'); return; }

    // Build includeSheets from pills
    const includeSheets = {};
    document.querySelectorAll('#excelSheetPills .nreq-pill').forEach(b => {
      includeSheets[b.dataset.sheet] = b.classList.contains('sel');
    });
    document.querySelectorAll('#excelSeqSheetPills .nreq-pill').forEach(b => {
      includeSheets[b.dataset.sheet] = b.classList.contains('sel');
    });

    settings.excel = {
      decimalPrecision: dp,
      dateFormat: dateFormat,
      includeSheets: includeSheets
    };
    saveSettings(settings);
    toast('Excel çıktı ayarları kaydedildi', 't-ok');
    showScreen('settings');
  };

  // Excel: reset
  $('settingsExcelReset').onclick = () => {
    const settings = loadSettings();
    settings.excel = getDefaults('excel');
    saveSettings(settings);
    loadExcelSettings();
    toast('Varsayılan ayarlara sıfırlandı', 't-ok');
  };

  // Mode selection
  $('modeRepeat').onclick = () => {
    setMeasurementMode('repeat');
    $('setupTitle').textContent = 'Yeni Ölçüm — Tekrarlı';
    $('setupModeHint').textContent = 'Aynı işlem tekrar tekrar ölçülecek. Etiketler anomalileri işaretlemek için kullanılabilir.';
    $('setupStepsPreview').style.display = 'none';
    applySetupDefaults();
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
      if (inputs.length) inputs[inputs.length - 1].focus({ preventScroll: true });
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
    applySetupDefaults();
    showScreen('setup');
  }

  // Apply stats defaults to setup screen nReq pills
  function applySetupDefaults() {
    const defConf = getSetting('stats', 'defaultConfidence');
    const defErr = getSetting('stats', 'defaultErrorMargin');
    document.querySelectorAll('#nreqConfPills .nreq-pill').forEach(b => {
      b.classList.toggle('sel', parseFloat(b.dataset.val) === defConf);
    });
    document.querySelectorAll('#nreqErrPills .nreq-pill').forEach(b => {
      b.classList.toggle('sel', parseFloat(b.dataset.val) === defErr);
    });
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
  // Register callback for timer state changes
  onPauseChange(updatePauseBtn);

  // Finish modal
  $('bStop').onclick = () => { $('finModal').classList.add('open'); pushPanel(); };
  $('mCancel').onclick = () => $('finModal').classList.remove('open');
  $('mConfirm').onclick = () => {
    $('finModal').classList.remove('open');
    stopT();
    saveSession();
    showSummary();
  };

  // Fullscreen - activate based on settings
  if (getSetting('ux', 'fullscreen') !== false) addFsListeners();

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
  pushPanel();

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
    version: 1,
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

  try {
    saveHistory(hist);
    // Başarılı kayıt sonrası geçici veriyi sil
    clearAutoRecovery();
  } catch (e) {
    toast('Kayıt alanı dolu! Eski verileri silerek yer açın', 't-dng');
    // Recovery data is preserved so user doesn't lose work
  }
}

// ===== SETTINGS HELPERS =====

let autoSaveTimer = null;

// Apply loaded settings to app components
function applySettings() {
  const s = loadSettings();
  const m = s.measure;
  // Rebuild tempo values (100-centered)
  rebuildTempoValues(m.tempoMin, m.tempoMax, m.tempoStep);
  // Update slider range to match aligned settings
  const slider = $('setTempoDefault');
  if (slider) {
    let aMin = 100;
    while (aMin - m.tempoStep >= m.tempoMin) aMin -= m.tempoStep;
    let aMax = 100;
    while (aMax + m.tempoStep <= m.tempoMax) aMax += m.tempoStep;
    slider.min = aMin;
    slider.max = aMax;
    slider.step = m.tempoStep;
  }
  // Restart autoSave interval
  startAutoSaveInterval();
  // Tema
  const theme = (s.ux || {}).theme || 'dark';
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f5f5f5' : '#1a1a1a');

  // Fullscreen listener yönetimi
  if ((s.ux || {}).fullscreen !== false && !fsRequested) addFsListeners();
  else if ((s.ux || {}).fullscreen === false) removeFsListeners();
}

// Start (or restart) autoSave periodic timer
function startAutoSaveInterval() {
  if (autoSaveTimer) clearInterval(autoSaveTimer);
  const interval = getSetting('measure', 'autoSaveInterval');
  // interval=0 means per-lap save, but add 60s fallback for safety between laps
  const effectiveInterval = interval > 0 ? interval : 60000;
  autoSaveTimer = setInterval(() => {
    if (S.started && S.running && !S.paused) {
      autoSaveProgress();
    }
  }, effectiveInterval);
}

// Load current stats settings into the settings UI
function loadStatsSettings() {
  const s = loadSettings();
  const st = s.stats;

  // Sliders + inputs
  $('setIqrMultiplier').value = st.iqrMultiplier;
  $('setIqrMultiplierVal').value = st.iqrMultiplier;
  $('setMovingAvgWindow').value = st.movingAvgWindow;
  $('setMovingAvgWindowVal').value = st.movingAvgWindow;
  $('setHistogramBins').value = st.histogramBins;
  $('setHistogramBinsVal').value = st.histogramBins;
  $('setTrendThreshold').value = st.trendThreshold;
  $('setTrendThresholdVal').value = st.trendThreshold;

  // IQR presets (single-select)
  document.querySelectorAll('#iqrPresets .nreq-pill').forEach(b => {
    b.classList.toggle('sel', parseFloat(b.dataset.val) === st.iqrMultiplier);
  });

  // Mode rounding (single-select)
  document.querySelectorAll('#modeRoundingPills .nreq-pill').forEach(b => {
    b.classList.toggle('sel', parseInt(b.dataset.val) === st.modeRounding);
  });

  // Percentiles (multi-select)
  document.querySelectorAll('#percentilePills .nreq-pill').forEach(b => {
    b.classList.toggle('sel', st.percentiles.includes(parseInt(b.dataset.val)));
  });

  // Default confidence (single-select)
  document.querySelectorAll('#defaultConfPills .nreq-pill').forEach(b => {
    b.classList.toggle('sel', parseFloat(b.dataset.val) === st.defaultConfidence);
  });

  // Default error margin (single-select)
  document.querySelectorAll('#defaultErrPills .nreq-pill').forEach(b => {
    b.classList.toggle('sel', parseFloat(b.dataset.val) === st.defaultErrorMargin);
  });
}

// Load current measure settings into the settings UI
function loadMeasureSettings() {
  const s = loadSettings();
  const m = s.measure;
  $('setTempoMin').value = m.tempoMin;
  $('setTempoMax').value = m.tempoMax;
  $('setTempoStep').value = m.tempoStep;

  // Update slider range (100-centered alignment)
  const step = m.tempoStep;
  let aMin = 100;
  while (aMin - step >= m.tempoMin) aMin -= step;
  let aMax = 100;
  while (aMax + step <= m.tempoMax) aMax += step;
  const slider = $('setTempoDefault');
  slider.min = aMin;
  slider.max = aMax;
  slider.step = step;
  slider.value = m.tempoDefault;
  const valInput = $('setTempoDefaultVal');
  valInput.value = slider.value; // snap to aligned value
  valInput.min = aMin;
  valInput.max = aMax;
  valInput.step = step;

  // AutoSave pills
  document.querySelectorAll('#autoSavePills .nreq-pill').forEach(b => {
    b.classList.remove('sel');
    if (parseInt(b.dataset.val) === m.autoSaveInterval) b.classList.add('sel');
  });
}

// Load current excel settings into the settings UI
function loadExcelSettings() {
  const s = loadSettings();
  const ex = s.excel;

  // Decimal precision
  $('excelDecimalSlider').value = ex.decimalPrecision;
  $('excelDecimalInput').value = ex.decimalPrecision;

  // Date format pills
  document.querySelectorAll('#excelDatePills .nreq-pill').forEach(b => {
    b.classList.toggle('sel', b.dataset.val === ex.dateFormat);
  });

  // Sheet pills
  const sheets = ex.includeSheets || {};
  document.querySelectorAll('#excelSheetPills .nreq-pill').forEach(b => {
    const key = b.dataset.sheet;
    b.classList.toggle('sel', sheets[key] !== false);
  });
  document.querySelectorAll('#excelSeqSheetPills .nreq-pill').forEach(b => {
    const key = b.dataset.sheet;
    b.classList.toggle('sel', sheets[key] !== false);
  });
}

// Load current UX settings into the settings UI
function loadUxSettings() {
  const s = loadSettings();
  const ux = s.ux || {};
  // Theme
  document.querySelectorAll('#uxThemePills .nreq-pill').forEach(b => {
    b.classList.toggle('sel', b.dataset.val === (ux.theme || 'dark'));
  });
  // Vibration
  document.querySelectorAll('#uxVibrationPills .nreq-pill').forEach(b => {
    b.classList.toggle('sel', b.dataset.val === String(ux.vibration !== false));
  });
  // Toast duration
  document.querySelectorAll('#uxToastPills .nreq-pill').forEach(b => {
    b.classList.toggle('sel', parseInt(b.dataset.val) === (ux.toastDuration || 2000));
  });
  // Fullscreen
  document.querySelectorAll('#uxFullscreenPills .nreq-pill').forEach(b => {
    b.classList.toggle('sel', b.dataset.val === String(ux.fullscreen !== false));
  });
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
