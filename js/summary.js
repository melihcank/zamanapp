// ===== SUMMARY MODULE =====

import { $, toast, vib, ffull, esc, dimColor, tagIcon } from './utils.js';
import { SVG_ICONS, STEP_COLORS } from './config.js';
import { calcStats, tagAnalysis, detectOutliers } from './stats.js';
import { loadHistory, saveHistory, loadTags } from './storage.js';
import {
  S, tags, setTags, measurementMode, sequenceSteps,
  historyViewIdx, setHistoryViewIdx,
  sumFilterTags, setSumFilterTags,
  sumIncludeOutliers, setSumIncludeOutliers,
  sumDateStr, setSumDateStr,
  sumTimeStr, setSumTimeStr,
  sumDelTarget, setSumDelTarget,
  tpTarget, setTpTarget,
  setCurrentStep, setSequenceCycle
} from './state.js';
import { screens, showScreen, pushPanel } from './nav.js';
import { recalcLaps, refreshList } from './laps.js';
import { updDisp, tick } from './timer.js';
import { buildTagStrip } from './tags.js';
import { initSequenceMode, renderStepIndicator } from './steps.js';
import { getNow } from './utils.js';
import { updateHistoryLaps, renderHistory } from './history.js';
import { exportExcel } from './export.js';
import { openTempoEdit, closeTP } from './panels.js';
import { resetAllState } from './state.js';

// Show summary screen (after measurement)
export function showSummary() {
  setHistoryViewIdx(null); // live measurement, not from history
  setSumDateStr(new Date().toLocaleDateString('tr-TR'));
  setSumTimeStr(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
  setSumFilterTags(new Set([0, 1, 2, 3, 'none']));
  setSumIncludeOutliers(true);
  rebuildSummary();
  showScreen('summary');
}

// Rebuild summary HTML
export function rebuildSummary() {
  const scrollY = screens.summary.scrollTop;
  const laps = S.laps;
  const isSeqMode = measurementMode === 'sequence';

  // Filter laps for stats: by tag
  const tagFiltered = laps.filter(l => {
    if (l.tag === null) return sumFilterTags.has('none');
    return sumFilterTags.has(l.tag);
  });

  // Detect outliers on tag-filtered times
  const tfTimes = tagFiltered.map(l => l.t);
  const outlierSet = detectOutliers(tfTimes);

  // Build set of excluded lap ids (outliers)
  const outlierIds = new Set();
  if (!sumIncludeOutliers) {
    tagFiltered.forEach((l, i) => { if (outlierSet.has(i)) outlierIds.add(l.id || i); });
  }

  // Final filtered times for stats (observed and normal)
  const finalTimes = [], finalNT = [];
  tagFiltered.forEach((l, i) => {
    if (sumIncludeOutliers || !outlierSet.has(i)) {
      finalTimes.push(l.t);
      finalNT.push(l.nt || l.t);
    }
  });

  const st = calcStats(finalTimes);
  const stNT = calcStats(finalNT);
  const tot = finalTimes.reduce((a, b) => a + b, 0);
  const totNT = finalNT.reduce((a, b) => a + b, 0);

  // Build set of all excluded lap nums for visual dimming
  const excludedNums = new Set();
  laps.forEach(l => {
    const tagKey = l.tag === null ? 'none' : l.tag;
    if (!sumFilterTags.has(tagKey)) { excludedNums.add(l.num); return; }
    if (!sumIncludeOutliers && outlierIds.has(l.id)) excludedNums.add(l.num);
  });
  const outlierCount = outlierSet.size;

  // Mode badge
  const modeBadge = isSeqMode
    ? '<span style="display:inline-block;padding:2px 8px;background:var(--inf-d);color:var(--inf);border-radius:var(--r-pill);font-size:clamp(8px,2.2vw,10px);font-weight:700;margin-left:6px">ARDIŞIK</span>'
    : '<span style="display:inline-block;padding:2px 8px;background:var(--acc-d);color:var(--acc);border-radius:var(--r-pill);font-size:clamp(8px,2.2vw,10px);font-weight:700;margin-left:6px">TEKRARLI</span>';

  const backBtnText = historyViewIdx !== null ? 'Geri' : 'Menü';
  const actionBtns = `<div class="sum-action-bar">
    <button class="sum-action-btn sab-excel" id="btnExcel"${laps.length ? '' : ' disabled'}><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>Excel</button>
    ${laps.length ? '<button class="sum-action-btn sab-resume" id="btnResume"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Devam Et</button>' : ''}
    <button class="sum-action-btn sab-back" id="btnNew"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>${backBtnText}</button>
  </div>`;
  let h = `<div class="sum-hdr"><h2>Ölçüm Tamamlandı${modeBadge}</h2><p>${esc(S.job)} — ${esc(S.op)}</p><p style="font-size:clamp(9px,2.5vw,12px);color:var(--tx3);margin-top:clamp(2px,.6vw,4px)">${sumDateStr} ${sumTimeStr}</p>${actionBtns}</div>`;

  if (isSeqMode) {
    // SEQUENCE MODE SUMMARY
    const stepCount = sequenceSteps.length || 4;
    const completeCycles = Math.floor(laps.length / stepCount);
    const partialSteps = laps.length % stepCount;

    // Calculate cycle times (sum of all steps in each cycle)
    const cycleTimes = [];
    for (let c = 0; c < completeCycles; c++) {
      let cycleTime = 0;
      for (let s = 0; s < stepCount; s++) {
        const lapIdx = c * stepCount + s;
        if (laps[lapIdx]) cycleTime += laps[lapIdx].t;
      }
      cycleTimes.push(cycleTime);
    }
    const cycleStats = calcStats(cycleTimes);

    // Step analysis - use step index from laps
    // For backwards compatibility, if laps don't have step property,
    // infer step from lap position (lap index % stepCount)
    const stepAnalysis = [];
    for (let i = 0; i < stepCount; i++) {
      // Try to filter by step property first, fallback to position-based inference
      let stepLaps = laps.filter(l => l.step === i);

      // If no laps have step property, infer from position
      if (stepLaps.length === 0 && laps.length > 0 && laps[0].step === undefined) {
        stepLaps = laps.filter((l, idx) => (idx % stepCount) === i);
      }

      const times = stepLaps.map(l => l.t);
      const normalTimes = stepLaps.map(l => l.nt || l.t);
      const stats = calcStats(times);
      const ntStats = calcStats(normalTimes);
      const stepDef = sequenceSteps[i] || { name: 'Adım ' + (i + 1), color: STEP_COLORS[i % STEP_COLORS.length] };

      // Safely spread stats (handle null case)
      const safeStats = stats || { n: 0, sum: 0, mean: 0, median: 0, stdDev: 0, cv: 0, min: 0, max: 0, range: 0 };

      stepAnalysis.push({
        name: stepDef.name,
        color: stepDef.color,
        idx: i,
        count: stepLaps.length,
        ...safeStats,
        ntMean: ntStats?.mean || 0,
        ntSum: ntStats?.sum || 0
      });
    }

    // Anomaly analysis
    const anomalyLaps = laps.filter(l => l.tag !== null && l.tag !== undefined);
    const anomalyCount = anomalyLaps.length;

    h += `<div class="sum-section-title">Çevrim Bilgisi</div>
    <div class="sum-stats s2"><div class="stat-c"><div class="stat-v">${stepCount}</div><div class="stat-l">Adım Sayısı</div></div><div class="stat-c"><div class="stat-v">${laps.length}</div><div class="stat-l">Toplam Kayıt</div></div></div>`;

    // Check if any tempo differs from 100 for sequence mode
    const seqHasTempoVariation = laps.some(l => (l.tempo || 100) !== 100);

    if (cycleStats && cycleStats.n > 0) {
      // Calculate normal cycle time from step normal times
      const normalCycleTime = stepAnalysis.reduce((sum, sa) => sum + (sa.ntMean || 0), 0);
      const seqObsPerHour = cycleStats.mean > 0 ? (3600000 / cycleStats.mean).toFixed(1) : '—';
      const seqNormPerHour = normalCycleTime > 0 ? (3600000 / normalCycleTime).toFixed(1) : '—';

      h += `<div class="sum-compare">`;
      h += `<div class="sum-compare-header">
        <span class="sch-n">${cycleStats.n}</span>
        <span class="sch-label">Tam Çevrim</span>
      </div>`;

      if (seqHasTempoVariation) {
        h += `<table class="sum-compare-table"><thead><tr><th></th><th>Gözlem</th><th>Normal</th></tr></thead><tbody>`;
        h += `<tr><td>Ort. Çevrim</td><td>${ffull(cycleStats.mean)}</td><td>${ffull(normalCycleTime)}</td></tr>`;
        h += `<tr><td>Min</td><td>${ffull(cycleStats.min)}</td><td>—</td></tr>`;
        h += `<tr><td>Max</td><td>${ffull(cycleStats.max)}</td><td>—</td></tr>`;
        h += `<tr><td>Std Sapma</td><td>${ffull(cycleStats.stdDev)}</td><td>—</td></tr>`;
        h += `<tr><td>CV%</td><td>${cycleStats.cv.toFixed(1)}%</td><td>—</td></tr>`;
        h += `<tr class="sct-section sct-highlight"><td>Saatlik Üretim</td><td>${seqObsPerHour}</td><td>${seqNormPerHour}</td></tr>`;
        h += `</tbody></table>`;
      } else {
        h += `<table class="sum-compare-table"><thead><tr><th></th><th>Değer</th></tr></thead><tbody>`;
        h += `<tr><td>Ort. Çevrim</td><td>${ffull(cycleStats.mean)}</td></tr>`;
        h += `<tr><td>Min</td><td>${ffull(cycleStats.min)}</td></tr>`;
        h += `<tr><td>Max</td><td>${ffull(cycleStats.max)}</td></tr>`;
        h += `<tr><td>Std Sapma</td><td>${ffull(cycleStats.stdDev)}</td></tr>`;
        h += `<tr><td>CV%</td><td>${cycleStats.cv.toFixed(1)}%</td></tr>`;
        h += `<tr class="sct-section sct-highlight"><td>Saatlik Üretim</td><td>${seqObsPerHour}</td></tr>`;
        h += `</tbody></table>`;
      }
      h += `</div>`;
    }

    h += `<div class="sum-section-title">Adım Bazlı Analiz</div>`;
    h += `<div class="sum-step-table-wrap">`;
    if (seqHasTempoVariation) {
      h += `<table class="sum-tag-table"><thead><tr><th>Adım</th><th>Adet</th><th>Ort.</th><th>Normal</th><th>Min</th><th>Max</th></tr></thead><tbody>`;
      if (stepAnalysis.length === 0) {
        h += `<tr><td colspan="6" style="text-align:center;color:var(--tx3)">Adım verisi bulunamadı</td></tr>`;
      } else {
        stepAnalysis.forEach(sa => {
          h += `<tr><td style="color:${sa.color};font-weight:700">${esc(sa.name)}</td><td>${sa.count}</td><td>${sa.mean ? ffull(sa.mean) : '—'}</td><td>${sa.ntMean ? ffull(sa.ntMean) : '—'}</td><td>${sa.min ? ffull(sa.min) : '—'}</td><td>${sa.max ? ffull(sa.max) : '—'}</td></tr>`;
        });
      }
    } else {
      h += `<table class="sum-tag-table"><thead><tr><th>Adım</th><th>Adet</th><th>Ort.</th><th>Min</th><th>Max</th></tr></thead><tbody>`;
      if (stepAnalysis.length === 0) {
        h += `<tr><td colspan="5" style="text-align:center;color:var(--tx3)">Adım verisi bulunamadı</td></tr>`;
      } else {
        stepAnalysis.forEach(sa => {
          h += `<tr><td style="color:${sa.color};font-weight:700">${esc(sa.name)}</td><td>${sa.count}</td><td>${sa.mean ? ffull(sa.mean) : '—'}</td><td>${sa.min ? ffull(sa.min) : '—'}</td><td>${sa.max ? ffull(sa.max) : '—'}</td></tr>`;
        });
      }
    }
    h += `</tbody></table></div>`;

    // Anomaly summary if any
    if (anomalyCount > 0) {
      h += `<div class="sum-section-title">Anomaliler (${anomalyCount})</div>`;
      const anomalyCounts = tags.map((t, i) => ({ name: t.name, color: t.color, count: laps.filter(l => l.tag === i).length })).filter(a => a.count > 0);
      h += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">`;
      anomalyCounts.forEach(a => {
        h += `<span style="padding:4px 10px;background:${dimColor(a.color)};color:${a.color};border-radius:var(--r-pill);font-size:clamp(10px,2.8vw,12px);font-weight:600">${esc(a.name)}: ${a.count}</span>`;
      });
      h += `</div>`;
    }

  } else if (st) {
    // REPEAT MODE SUMMARY
    // Check if any tempo differs from 100
    const hasTempoVariation = laps.some(l => (l.tempo || 100) !== 100);
    const obsPerHour = st.mean > 0 ? (3600000 / st.mean).toFixed(1) : '—';
    const normPerHour = stNT.mean > 0 ? (3600000 / stNT.mean).toFixed(1) : '—';
    const reqOk = st.n >= st.nReq;
    const reqNTOk = stNT && st.n >= stNT.nReq;

    h += `<div class="sum-compare">`;
    // Header with observation count
    h += `<div class="sum-compare-header">
      <span class="sch-n">${st.n}</span>
      <span class="sch-label">Gözlem</span>
      <span class="sch-req ${reqOk ? 'ok' : 'warn'}">Gerekli: ${st.nReq} ${reqOk ? '✓' : '✗'}</span>
    </div>`;

    if (hasTempoVariation) {
      // Two column table: Gözlem vs Normal
      h += `<table class="sum-compare-table"><thead><tr><th></th><th>Gözlem</th><th>Normal</th></tr></thead><tbody>`;
      h += `<tr><td>Toplam</td><td>${ffull(tot)}</td><td>${ffull(totNT)}</td></tr>`;
      h += `<tr><td>Ortalama</td><td>${ffull(st.mean)}</td><td>${ffull(stNT.mean)}</td></tr>`;
      h += `<tr><td>Medyan</td><td>${ffull(st.median)}</td><td>${ffull(stNT.median)}</td></tr>`;
      h += `<tr><td>Min</td><td>${ffull(st.min)}</td><td>${ffull(stNT.min)}</td></tr>`;
      h += `<tr><td>Max</td><td>${ffull(st.max)}</td><td>${ffull(stNT.max)}</td></tr>`;
      h += `<tr><td>Std Sapma</td><td>${ffull(st.stdDev)}</td><td>${ffull(stNT.stdDev)}</td></tr>`;
      h += `<tr><td>CV%</td><td>${st.cv.toFixed(1)}%</td><td>${stNT.cv.toFixed(1)}%</td></tr>`;
      h += `<tr><td>%95 Güven Aralığı</td><td class="sct-ci">${ffull(st.ci95Low)} — ${ffull(st.ci95High)}</td><td class="sct-ci">${ffull(stNT.ci95Low)} — ${ffull(stNT.ci95High)}</td></tr>`;
      h += `<tr class="sct-section sct-highlight"><td>Saatlik Üretim</td><td>${obsPerHour}</td><td>${normPerHour}</td></tr>`;
      h += `</tbody></table>`;
    } else {
      // Single column table: Only Gözlem (all tempos are 100)
      h += `<table class="sum-compare-table"><thead><tr><th></th><th>Değer</th></tr></thead><tbody>`;
      h += `<tr><td>Toplam</td><td>${ffull(tot)}</td></tr>`;
      h += `<tr><td>Ortalama</td><td>${ffull(st.mean)}</td></tr>`;
      h += `<tr><td>Medyan</td><td>${ffull(st.median)}</td></tr>`;
      h += `<tr><td>Min</td><td>${ffull(st.min)}</td></tr>`;
      h += `<tr><td>Max</td><td>${ffull(st.max)}</td></tr>`;
      h += `<tr><td>Std Sapma</td><td>${ffull(st.stdDev)}</td></tr>`;
      h += `<tr><td>CV%</td><td>${st.cv.toFixed(1)}%</td></tr>`;
      h += `<tr><td>%95 Güven Aralığı</td><td class="sct-ci">${ffull(st.ci95Low)} — ${ffull(st.ci95High)}</td></tr>`;
      h += `<tr class="sct-section sct-highlight"><td>Saatlik Üretim</td><td>${obsPerHour}</td></tr>`;
      h += `</tbody></table>`;
    }
    h += `</div>`;
  } else if (!laps.length) {
    h += `<div class="sum-section-title" style="text-align:center;margin:24px 0;color:var(--tx3)">Tüm turlar silindi</div>`;
  } else {
    h += `<div class="sum-section-title" style="text-align:center;margin:16px 0;color:var(--tx3)">Filtre sonucu veri yok</div>`;
  }

  // Filter section (for repeat mode)
  if (laps.length && !isSeqMode) {
    h += `<div class="sum-filters"><div class="sum-filters-title">Analiz Filtresi</div>`;
    tags.forEach((tag, i) => {
      h += `<label class="sf-row"><input type="checkbox" data-sf-tag="${i}" ${sumFilterTags.has(i) ? 'checked' : ''}><span class="sf-dot" style="background:${tag.color}"></span>${esc(tag.name)}</label>`;
    });
    h += `<label class="sf-row"><input type="checkbox" data-sf-tag="none" ${sumFilterTags.has('none') ? 'checked' : ''}><span class="sf-dot" style="background:#666"></span>Etiketsiz</label>`;
    h += `<label class="sf-row" style="width:100%;margin-top:clamp(2px,.5vw,4px)"><input type="checkbox" id="sfOutlier" ${sumIncludeOutliers ? 'checked' : ''}>Aykırı veriler dahil mi?${outlierCount ? ' (' + outlierCount + ')' : ''}</label>`;
    h += `</div>`;
  }

  const listTitle = isSeqMode ? 'Kayıt Listesi' : 'Tur Listesi';
  h += `<div class="sum-section-title">${listTitle}</div><div class="sum-laps" id="sumLapList">`;
  laps.forEach(l => { h += sumRowHTML(l, excludedNums.has(l.num)); });
  if (!laps.length) h += `<div style="text-align:center;padding:16px;color:var(--tx3);font-size:clamp(10px,3vw,13px)">Kayıt bulunmuyor</div>`;
  h += `</div>`;

  screens.summary.innerHTML = h;
  screens.summary.scrollTop = scrollY;
  bindSumActions();
  if (!isSeqMode) bindSumFilters();

  $('btnExcel').onclick = () => {
    const sess = {
      op: S.op, job: S.job, date: sumDateStr,
      tags: JSON.parse(JSON.stringify(tags)),
      steps: measurementMode === 'sequence' ? JSON.parse(JSON.stringify(sequenceSteps)) : null,
      laps: S.laps.map(l => ({
        t: l.t, cum: l.cum, tag: l.tag, note: l.note, tempo: l.tempo || 100, nt: l.nt || l.t,
        step: l.step, stepName: l.stepName, cycle: l.cycle
      })),
      mode: measurementMode
    };
    const fn = 'zaman_etudu_' + S.job.replace(/[^a-zA-Z0-9\u00e7\u011f\u0131\u00f6\u015f\u00fc\u00c7\u011e\u0130\u00d6\u015e\u00dc]/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    exportExcel(sess, fn);
  };

  $('btnNew').onclick = () => {
    if (historyViewIdx !== null) {
      setTags(loadTags());
      setHistoryViewIdx(null);
      renderHistory();
      showScreen('history');
    } else {
      resetAll();
      showScreen('menu');
    }
  };

  // Resume measurement button
  const btnResume = $('btnResume');
  if (btnResume) {
    btnResume.onclick = () => resumeMeasurement();
  }
}

// Summary row HTML
function sumRowHTML(l, excluded) {
  const tg = l.tag !== null && l.tag !== undefined ? tags[l.tag] : null;
  const tempo = l.tempo || 100;
  const tempoClass = tempo < 100 ? 'st-slow' : (tempo > 100 ? 'st-fast' : '');

  // For sequence mode, show step name; for repeat mode, show tag
  let labelHtml = '';
  if (l.mode === 'sequence' && l.stepName) {
    const stepColor = STEP_COLORS[(l.step || 0) % STEP_COLORS.length];
    labelHtml = `<span class="stg" style="color:${stepColor}">${esc(l.stepName)}</span>`;
    // Add anomaly indicator if present
    if (tg) {
      labelHtml += `<span style="margin-left:4px;color:${tg.color}">${tagIcon(tg)}</span>`;
    }
  } else {
    labelHtml = `<span class="stg" style="color:${tg ? tg.color : 'var(--tx3)'}">${tg ? esc(tg.name) : '—'}</span>`;
  }

  return `<div class="sum-row${excluded ? ' sf-excluded' : ''}" data-num="${l.num}"><span class="sn">#${l.num}</span><span class="st">${ffull(l.t)}</span><span class="s-tempo ${tempoClass}" data-num="${l.num}">${tempo}</span>${labelHtml}<span class="sum-acts"><button class="sum-act sa-tag" data-num="${l.num}" title="Anomali Etiketle">${SVG_ICONS.tag}</button><button class="sum-act sa-del" data-num="${l.num}" title="Sil">${SVG_ICONS.del}</button></span></div>`;
}

// Bind summary action buttons
function bindSumActions() {
  screens.summary.querySelectorAll('.sa-tag').forEach(btn => {
    btn.onclick = () => {
      const num = +btn.dataset.num;
      const lap = S.laps.find(l => l.num === num);
      if (!lap) return;
      openSumTP(lap);
    };
  });

  screens.summary.querySelectorAll('.sa-del').forEach(btn => {
    btn.onclick = () => {
      const num = +btn.dataset.num;
      setSumDelTarget(num);
      $('sumDelModal').classList.add('open');
    };
  });

  // Tempo edit
  screens.summary.querySelectorAll('.s-tempo').forEach(el => {
    el.onclick = () => {
      const num = +el.dataset.num;
      const lap = S.laps.find(l => l.num === num);
      if (!lap) return;
      openTempoEdit(lap);
    };
  });
}

// Bind filter checkboxes
function bindSumFilters() {
  screens.summary.querySelectorAll('[data-sf-tag]').forEach(cb => {
    cb.onchange = () => {
      const v = cb.dataset.sfTag;
      const key = v === 'none' ? 'none' : +v;
      const newSet = new Set(sumFilterTags);
      if (cb.checked) newSet.add(key); else newSet.delete(key);
      setSumFilterTags(newSet);
      rebuildSummary();
    };
  });
  const oCb = $('sfOutlier');
  if (oCb) oCb.onchange = () => { setSumIncludeOutliers(oCb.checked); rebuildSummary(); };
}

// Open tag picker for summary
function openSumTP(lap) {
  setTpTarget({ lap, card: null });
  $('tpTitle').textContent = 'Etiket Seç — Tur #' + lap.num;
  const tpGrid = $('tpGrid');
  tpGrid.innerHTML = '';

  tags.forEach((tag, i) => {
    const btn = document.createElement('button');
    btn.className = 'tp-btn' + (lap.tag === i ? ' sel' : '');
    btn.dataset.idx = i;
    btn.style.background = tag.color;
    btn.innerHTML = `${tagIcon(tag)} ${esc(tag.name)}`;
    btn.onclick = () => {
      lap.tag = i;
      toast('Etiket: ' + tag.name, 't-ok');
      vib(15);
      closeTP();
      updateHistoryLaps();
      rebuildSummary();
    };
    tpGrid.appendChild(btn);
  });

  const rem = document.createElement('button');
  rem.className = 'tp-remove';
  rem.textContent = 'Etiketi Kaldır';
  rem.onclick = () => {
    lap.tag = null;
    toast('Etiket kaldırıldı', 't-wrn');
    vib(15);
    closeTP();
    updateHistoryLaps();
    rebuildSummary();
  };
  tpGrid.appendChild(rem);

  $('tpOv').classList.add('open');
  $('tpPanel').classList.add('open');
  $('tpPanel').style.transform = 'translateX(-50%) translateY(0)';
  pushPanel();
}

// Confirm delete from summary
export function confirmSumDel() {
  if (sumDelTarget === null) return;
  const idx = S.laps.findIndex(l => l.num === sumDelTarget);
  if (idx > -1) {
    S.laps.splice(idx, 1);
    recalcLaps();
    updateHistoryLaps();
    toast('Tur silindi', 't-dng');
    vib([10, 30, 10]);
  }
  setSumDelTarget(null);
  $('sumDelModal').classList.remove('open');
  rebuildSummary();
}

// Reset all state and UI
export function resetAll() {
  resetAllState();
  $('tTime').textContent = '00:00';
  $('tMs').textContent = '.00';
  $('tState').textContent = 'Başlamak için dokun';
  $('tapHint').textContent = 'Ekrana dokun = Tur kaydet';
  $('lapList').innerHTML = '';
  $('lapCtr').style.display = 'none';
  $('lapN').textContent = '0';
  $('ringProg').style.strokeDashoffset = '565.48';
  $('timerArea').classList.remove('running', 'paused', 'pulse');
  $('inpOp').value = '';
  $('inpJob').value = '';
  $('stepIndicator').classList.remove('visible');
  $('tagStrip').style.display = 'grid';

  // Reset tempo
  import('./tempo.js').then(m => m.setTempo(100));
}

// Resume measurement from current laps
export function resumeMeasurement() {
  if (!S.laps.length) return;

  // Calculate cumulative time from all laps
  const cumTime = S.laps.reduce((sum, l) => sum + l.t, 0);

  // Set timer state to "started but paused" so pause button shows
  S.started = true;
  S.running = false;
  S.paused = true;
  S.resumeFromTime = cumTime;  // This tells startFromTime() where to continue from
  S.lastLapTime = cumTime;
  S.pausedAt = Date.now();
  S.base = S.pausedAt - cumTime;

  // Update display elements
  $('dJob').textContent = S.job;
  $('dOp').textContent = S.op;
  $('tState').textContent = 'DURAKLATILDI';
  $('tapHint').textContent = 'Devam etmek için butona dokun';
  $('timerArea').classList.remove('running');
  $('timerArea').classList.add('paused');
  $('lapCtr').style.display = 'flex';
  $('lapN').textContent = S.laps.length;

  // Manually update timer display to show cumulative time
  const mins = Math.floor(cumTime / 60000);
  const secs = Math.floor((cumTime % 60000) / 1000);
  const ms = Math.floor((cumTime % 1000) / 10);
  $('tTime').textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  $('tMs').textContent = '.' + String(ms).padStart(2, '0');
  const p = (cumTime / 60000) % 1;
  $('ringProg').style.strokeDashoffset = 565.48 * (1 - p);

  // Build tag strip
  buildTagStrip();

  // Refresh lap list
  refreshList();

  // If sequence mode, restore step/cycle state and show indicator
  if (measurementMode === 'sequence') {
    // Find the last lap to get current step and cycle
    const lastLap = S.laps[S.laps.length - 1];
    if (lastLap && lastLap.step !== undefined) {
      // Calculate next step (the one after the last recorded)
      let nextStep = (lastLap.step + 1) % sequenceSteps.length;
      let nextCycle = lastLap.cycle || 1;
      if (nextStep === 0) nextCycle++;
      setCurrentStep(nextStep);
      setSequenceCycle(nextCycle);
      renderStepIndicator();
    } else {
      initSequenceMode();
    }
    $('stepIndicator').classList.add('visible');
    $('tagStrip').style.display = 'none';
  } else {
    $('stepIndicator').classList.remove('visible');
    $('tagStrip').style.display = 'grid';
  }

  // Clear history view index since we're continuing the measurement
  setHistoryViewIdx(null);

  // Show measure screen
  showScreen('measure');

  // Update pause button to show "Devam Et"
  if (window.updatePauseIcon) window.updatePauseIcon();

  toast('Ölçüm duraklatıldı. Devam Et butonuna basın.', 't-warn');
  vib(30);
}

// Initialize summary events
export function initSummaryEvents() {
  $('sdCancel').onclick = () => { setSumDelTarget(null); $('sumDelModal').classList.remove('open'); };
  $('sdConfirm').onclick = confirmSumDel;
}
