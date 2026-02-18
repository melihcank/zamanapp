// ===== EXPORT MODULE =====
// Kapsamlı Excel & JSON Export Sistemi

import { $, toast, ffull, fmt, fms } from './utils.js';
import { TEMPO_VALUES } from './config.js';
import { calcStats, calcStandardTime, tagAnalysis, detectOutliers, percentile, quartiles, tCritical, freqDist, movingAvg, linearRegression, skewness, kurtosis, findMode } from './stats.js';
import { getSetting } from './settings.js';
import { loadHistory, saveHistory, loadTags, saveTags } from './storage.js';
import { tags, setTags, sequenceSteps } from './state.js';
import { renderHistory } from './history.js';

// Load XLSX library dynamically (local bundle)
function loadXLSX(cb) {
  if (typeof XLSX !== 'undefined') { cb(); return; }
  const s = document.createElement('script');
  s.src = './js/xlsx.bundle.js';
  s.onload = cb;
  s.onerror = () => toast('Excel kütüphanesi yüklenemedi', 't-dng');
  document.head.appendChild(s);
}

// ============ HELPER FUNCTIONS ============

// Convert ms to seconds with precision
function toSec(ms, decimals) {
  if (decimals === undefined) decimals = getSetting('excel', 'decimalPrecision') ?? 3;
  return ms != null ? +(ms / 1000).toFixed(decimals) : null;
}

// Format a number to configured decimal precision
function dp(val, fallback) {
  if (val == null) return null;
  const d = getSetting('excel', 'decimalPrecision') ?? fallback ?? 3;
  return +Number(val).toFixed(d);
}

// Format date according to settings
function formatDate(dateInput) {
  const fmt = getSetting('excel', 'dateFormat') ?? 'tr';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const pad = n => String(n).padStart(2, '0');
  const DD = pad(d.getDate()), MM = pad(d.getMonth() + 1);
  const YYYY = d.getFullYear(), HH = pad(d.getHours()), mm = pad(d.getMinutes());
  if (fmt === 'iso') return `${YYYY}-${MM}-${DD} ${HH}:${mm}`;
  if (fmt === 'eu')  return `${DD}/${MM}/${YYYY} ${HH}:${mm}`;
  return `${DD}.${MM}.${YYYY} ${HH}:${mm}`;
}

// ============ STYLE CONSTANTS ============

function _border() {
  const b = { style: 'thin', color: { rgb: 'B0B0B0' } };
  return { top: b, bottom: b, left: b, right: b };
}

const XL = {
  title: { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14 }, fill: { fgColor: { rgb: '1B2A4A' } }, alignment: { horizontal: 'center', vertical: 'center' } },
  section: { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '2E5090' } }, alignment: { vertical: 'center' } },
  subSection: { font: { bold: true, color: { rgb: '1B2A4A' }, sz: 10 }, fill: { fgColor: { rgb: 'D6E4F0' } }, alignment: { vertical: 'center' } },
  colHeader: { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 }, fill: { fgColor: { rgb: '4472C4' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: _border() },
  label: { font: { color: { rgb: '546E7A' }, sz: 10 } },
  value: { font: { color: { rgb: '212121' }, sz: 10 }, alignment: { horizontal: 'right' } },
  unit: { font: { color: { rgb: '9E9E9E' }, sz: 9 } },
  total: { font: { bold: true, color: { rgb: '1B2A4A' } }, fill: { fgColor: { rgb: 'E2EFDA' } }, border: { bottom: { style: 'double', color: { rgb: '1B2A4A' } } } },
  outlier: { font: { bold: true, color: { rgb: 'C62828' } }, fill: { fgColor: { rgb: 'FCE4EC' } } },
  success: { font: { bold: true, color: { rgb: '2E7D32' } }, fill: { fgColor: { rgb: 'E8F5E9' } }, alignment: { horizontal: 'center' } },
  warning: { font: { bold: true, color: { rgb: 'E65100' } }, fill: { fgColor: { rgb: 'FFF3E0' } }, alignment: { horizontal: 'center' } },
  dataEven: { fill: { fgColor: { rgb: 'F2F2F2' } } },
  dataOdd: { fill: { fgColor: { rgb: 'FFFFFF' } } }
};

// ============ STYLE HELPER FUNCTIONS ============

function _ref(r, c) { return XLSX.utils.encode_cell({ r, c }); }

function _ensure(ws, r, c) {
  const ref = _ref(r, c);
  if (!ws[ref]) ws[ref] = { v: '', t: 's' };
  return ref;
}

function styleCell(ws, r, c, s) {
  const ref = _ensure(ws, r, c);
  ws[ref].s = { ...(ws[ref].s || {}), ...s };
}

function styleRange(ws, sr, sc, er, ec, s) {
  for (let r = sr; r <= er; r++)
    for (let c = sc; c <= ec; c++) styleCell(ws, r, c, s);
}

function styleRow(ws, row, nc, s) {
  for (let c = 0; c < nc; c++) styleCell(ws, row, c, s);
}

function mergeAndStyle(ws, sr, sc, er, ec, s) {
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: sr, c: sc }, e: { r: er, c: ec } });
  styleRange(ws, sr, sc, er, ec, s);
}

function addAutoFilter(ws, sr, sc, er, ec) {
  ws['!autofilter'] = { ref: `${_ref(sr, sc)}:${_ref(er, ec)}` };
}

function addTableBorders(ws, sr, sc, er, ec) {
  const b = _border();
  for (let r = sr; r <= er; r++)
    for (let c = sc; c <= ec; c++) {
      const ref = _ensure(ws, r, c);
      ws[ref].s = { ...(ws[ref].s || {}), border: b };
    }
}

function addZebraStripes(ws, startRow, endRow, nc) {
  for (let r = startRow; r <= endRow; r++) {
    const fill = ((r - startRow) % 2 === 0 ? XL.dataEven : XL.dataOdd).fill;
    for (let c = 0; c < nc; c++) {
      const ref = _ensure(ws, r, c);
      ws[ref].s = { ...(ws[ref].s || {}), fill };
    }
  }
}

function styleReportTitle(ws, row, nc) {
  mergeAndStyle(ws, row, 0, row, nc - 1, XL.title);
}

function styleSectionHeader(ws, row, nc) {
  mergeAndStyle(ws, row, 0, row, nc - 1, XL.section);
}

function styleSubSectionHeader(ws, row, nc) {
  mergeAndStyle(ws, row, 0, row, nc - 1, XL.subSection);
}

function styleColumnHeaders(ws, row, sc, ec) {
  for (let c = sc; c <= ec; c++) styleCell(ws, row, c, XL.colHeader);
}

function styleKVRows(ws, sr, er, nc, hasUnit) {
  for (let r = sr; r <= er; r++) {
    styleCell(ws, r, 0, XL.label);
    const end = nc - (hasUnit ? 1 : 0);
    for (let c = 1; c < end; c++) styleCell(ws, r, c, XL.value);
    if (hasUnit) styleCell(ws, r, nc - 1, XL.unit);
  }
}

function styleTotalRow(ws, row, nc) {
  styleRow(ws, row, nc, XL.total);
}

function styleYesNo(ws, r, c) {
  const ref = _ref(r, c);
  if (ws[ref]) {
    if (ws[ref].v === 'EVET') ws[ref].s = { ...(ws[ref].s || {}), ...XL.success };
    else if (ws[ref].v === 'HAYIR') ws[ref].s = { ...(ws[ref].s || {}), ...XL.warning };
  }
}

function highlightOutlierRows(ws, outlierSet, dataStart, nc) {
  outlierSet.forEach(idx => { styleRow(ws, dataStart + idx, nc, XL.outlier); });
}

function applyStyles(ws, d) {
  if (d.titles) d.titles.forEach(a => styleReportTitle(ws, a[0], a[1]));
  if (d.sections) d.sections.forEach(a => styleSectionHeader(ws, a[0], a[1]));
  if (d.sectionRows) d.sectionRows.forEach(a => styleRow(ws, a[0], a[1], XL.section));
  if (d.subSections) d.subSections.forEach(a => styleSubSectionHeader(ws, a[0], a[1]));
  if (d.colHeaders) d.colHeaders.forEach(a => styleColumnHeaders(ws, a[0], a[1], a[2]));
  if (d.kv) d.kv.forEach(a => styleKVRows(ws, a[0], a[1], a[2], a[3]));
  if (d.zebra) d.zebra.forEach(a => addZebraStripes(ws, a[0], a[1], a[2]));
  if (d.borders) d.borders.forEach(a => addTableBorders(ws, a[0], a[1], a[2], a[3]));
  if (d.totals) d.totals.forEach(a => styleTotalRow(ws, a[0], a[1]));
  if (d.filter) d.filter.forEach(a => addAutoFilter(ws, a[0], a[1], a[2], a[3]));
  if (d.yesNo) d.yesNo.forEach(a => styleYesNo(ws, a[0], a[1]));
  if (d.outliers) d.outliers.forEach(a => highlightOutlierRows(ws, a[0], a[1], a[2]));
}

// ============ STANDARD TIME SHEET ============

function buildStandardTimeSheet(wb, session) {
  const st = session.standardTime;
  if (!st) return;
  const isSeq = session.mode === 'sequence';
  const data = [];
  const sty = { titles: [], sections: [], colHeaders: [], kv: [], zebra: [], borders: [], totals: [] };

  // Title
  data.push(['STANDART ZAMAN HESAPLAMASI']);
  sty.titles.push([0, 4]);
  data.push([]);

  // Measurement info
  data.push(['İş / Parça', session.job]);
  data.push(['Operatör', session.op]);
  data.push(['Tarih', formatDate(session.dateISO || new Date())]);
  data.push(['Mod', isSeq ? 'Ardışık (Sequence)' : 'Tekrarlı (Repeat)']);
  data.push(['Tur/Kayıt Sayısı', session.laps.length]);
  sty.kv.push([2, 6, 2, false]);
  data.push([]);

  // Allowances section
  const secRow = data.length;
  data.push(['PAY KALEMLERİ']);
  sty.sections.push([secRow, 4]);

  const hdrRow = data.length;
  data.push(['Pay Kalemi', 'Oran (%)']);
  sty.colHeaders.push([hdrRow, 0, 1]);

  const alStart = data.length;
  st.allowances.forEach(a => {
    data.push([a.name, dp(a.percent, 1)]);
  });
  const alEnd = data.length - 1;
  if (alEnd >= alStart) {
    sty.zebra.push([alStart, alEnd, 2]);
    sty.borders.push([hdrRow, 0, alEnd, 1]);
  }

  // Total row
  const totRow = data.length;
  data.push(['TOPLAM', dp(st.totalAllowance, 1)]);
  sty.totals.push([totRow, 2]);
  data.push([]);

  // Result section
  const resSecRow = data.length;
  data.push(['SONUÇ']);
  sty.sections.push([resSecRow, 4]);

  if (isSeq && st.resultPerStep) {
    const stHdr = data.length;
    data.push(['Adım', 'NT Ort (sn)', 'SZ (sn)']);
    sty.colHeaders.push([stHdr, 0, 2]);

    const stStart = data.length;
    st.resultPerStep.forEach(s => {
      data.push([s.stepName, toSec(s.ntMean), toSec(s.st)]);
    });
    const stEnd = data.length - 1;
    if (stEnd >= stStart) {
      sty.zebra.push([stStart, stEnd, 3]);
      sty.borders.push([stHdr, 0, stEnd, 2]);
    }

    const cycRow = data.length;
    data.push(['Çevrim Toplamı', '', toSec(st.cycleST)]);
    sty.totals.push([cycRow, 3]);
  } else {
    const normalTimes = session.laps.map(l => l.nt || l.t);
    const stats = calcStats(normalTimes);
    const resStart = data.length;
    data.push(['NT Ortalaması', toSec(stats ? stats.mean : 0), 'sn']);
    data.push(['Toplam Pay', dp(st.totalAllowance, 1), '%']);
    data.push(['Standart Zaman', toSec(st.result), 'sn']);
    data.push(['Standart Zaman', dp(st.result / 60000, 3), 'dk']);
    sty.kv.push([resStart, resStart + 3, 3, true]);
  }

  data.push([]);
  data.push(['Formül: Standart Zaman = NT Ortalaması × (1 + Toplam Pay / 100)']);
  data.push(['Hesaplama Tarihi', st.savedAt ? formatDate(st.savedAt) : '—']);

  // Build worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  applyStyles(ws, sty);
  XLSX.utils.book_append_sheet(wb, ws, 'Standart Süre');
}

// ============ MAIN EXPORT FUNCTION ============

export function exportExcel(session, fn) {
  loadXLSX(() => {
    const sTags = session.tags || tags;
    const sSteps = session.steps || sequenceSteps;
    const isSeqMode = session.mode === 'sequence';
    const wb = XLSX.utils.book_new();

    if (isSeqMode) {
      buildSequenceExcel(wb, session, sTags, sSteps);
    } else {
      buildRepeatExcel(wb, session, sTags);
    }

    // Standard Time sheet
    const stSheets = getSetting('excel', 'includeSheets') || {};
    if (session.standardTime && stSheets.standartSure !== false) {
      buildStandardTimeSheet(wb, session);
    }

    XLSX.writeFile(wb, fn);
    toast('Kapsamlı Excel raporu indirildi', 't-ok');
  });
}

// ============ REPEAT MODE EXCEL ============

function buildRepeatExcel(wb, session, sTags) {
  const nReqOpts = { confidence: session.nReqConfidence || 0.95, errorMargin: session.nReqError || 0.05 };
  const confPct = Math.round((session.nReqConfidence || 0.95) * 100);
  const errPct = Math.round((session.nReqError || 0.05) * 100);
  const times = session.laps.map(l => l.t);
  const normalTimes = session.laps.map(l => l.nt || l.t);
  const st = calcStats(times, nReqOpts);
  const stNT = calcStats(normalTimes, nReqOpts);
  const outliers = detectOutliers(times);
  const outliersNT = detectOutliers(normalTimes);
  const q = quartiles(times);
  const qNT = quartiles(normalTimes);
  const sorted = [...times].sort((a, b) => a - b);
  const sortedNT = [...normalTimes].sort((a, b) => a - b);
  const reg = linearRegression(times);
  const regNT = linearRegression(normalTimes);
  const maWindow = getSetting('stats', 'movingAvgWindow');
  const userPerc = getSetting('stats', 'percentiles');
  const trendTh = getSetting('stats', 'trendThreshold');
  const ma = movingAvg(times, maWindow);
  const maNT = movingAvg(normalTimes, maWindow);
  const sheets = getSetting('excel', 'includeSheets') ?? {};

  // ========== SHEET 1: ÖZET ==========
  const s1Data = [
    ['ZAMAN ETÜDÜ RAPORU - TEKRARLI ÖLÇÜM'],
    ['Oluşturma Tarihi:', formatDate(new Date())],
    [],
    ['ÖLÇÜM BİLGİLERİ'],
    ['İş / Proses Adı', session.job || '-'],
    ['Operatör', session.op || '-'],
    ['Ölçüm Tarihi', session.date || '-'],
    ['Ölçüm Saati', session.time || '-'],
    ['Toplam Gözlem (n)', st?.n || 0],
    [],
    ['TEMEL İSTATİSTİKLER', 'Gözlem', 'Normal', ''],
    ['Toplam', toSec(st?.sum), toSec(stNT?.sum), 'sn'],
    ['Ortalama (x̄)', toSec(st?.mean), toSec(stNT?.mean), 'sn'],
    ['Medyan', toSec(st?.median), toSec(stNT?.median), 'sn'],
    ['Mod (En sık)', toSec(findMode(times)), toSec(findMode(normalTimes)), 'sn'],
    ['Standart Sapma (σ)', toSec(st?.stdDev), toSec(stNT?.stdDev), 'sn'],
    ['Varyans (σ²)', toSec(st?.stdDev ? st.stdDev ** 2 : 0, 6), toSec(stNT?.stdDev ? stNT.stdDev ** 2 : 0, 6), 'sn²'],
    ['Varyasyon Katsayısı (CV)', dp(st?.cv, 2) || 0, dp(stNT?.cv, 2) || 0, '%'],
    ['Minimum', toSec(st?.min), toSec(stNT?.min), 'sn'],
    ['Maksimum', toSec(st?.max), toSec(stNT?.max), 'sn'],
    ['Aralık (Range)', toSec(st?.range), toSec(stNT?.range), 'sn'],
    ['Standart Hata (SE)', toSec(st?.se), toSec(stNT?.se), 'sn'],
    [],
    ['DAĞILIM BİLGİLERİ', 'Gözlem', 'Normal', ''],
    ['Q1 (25. Persentil)', toSec(q.q1), toSec(qNT.q1), 'sn'],
    ['Q2 (Medyan)', toSec(q.q2), toSec(qNT.q2), 'sn'],
    ['Q3 (75. Persentil)', toSec(q.q3), toSec(qNT.q3), 'sn'],
    ['IQR (Çeyrekler Arası)', toSec(q.iqr), toSec(qNT.iqr), 'sn'],
    ...userPerc.map(p => [`${p}. Persentil`, toSec(percentile(sorted, p / 100)), toSec(percentile(sortedNT, p / 100)), 'sn']),
    ['Çarpıklık (Skewness)', st ? dp(skewness(times, st.mean, st.stdDev), 3) : 0, stNT ? dp(skewness(normalTimes, stNT.mean, stNT.stdDev), 3) : 0],
    ['Basıklık (Kurtosis)', st ? dp(kurtosis(times, st.mean, st.stdDev), 3) : 0, stNT ? dp(kurtosis(normalTimes, stNT.mean, stNT.stdDev), 3) : 0],
    [],
    ['GÜVEN ARALIĞI & YETERLİLİK', 'Gözlem', 'Normal', ''],
    [`%${confPct} GA Alt Sınır`, toSec(st?.ci95Low), toSec(stNT?.ci95Low), 'sn'],
    [`%${confPct} GA Üst Sınır`, toSec(st?.ci95High), toSec(stNT?.ci95High), 'sn'],
    ['%99 GA Alt Sınır', toSec(st ? Math.max(0, st.mean - tCritical(st.n, 0.99) * st.se) : 0), toSec(stNT ? Math.max(0, stNT.mean - tCritical(stNT.n, 0.99) * stNT.se) : 0), 'sn'],
    ['%99 GA Üst Sınır', toSec(st ? st.mean + tCritical(st.n, 0.99) * st.se : 0), toSec(stNT ? stNT.mean + tCritical(stNT.n, 0.99) * stNT.se : 0), 'sn'],
    [`Gerekli Gözlem (±%${errPct}, %${confPct})`, st?.nReq || 0, stNT?.nReq || 0],
    ['Yeterli Gözlem?', st && st.n >= st.nReq ? 'EVET' : 'HAYIR', stNT && stNT.n >= stNT.nReq ? 'EVET' : 'HAYIR'],
    [],
    ['TREND ANALİZİ', 'Gözlem', 'Normal', ''],
    ['Eğim (Slope)', dp(reg.slope, 6), dp(regNT.slope, 6), 'ms/tur'],
    ['Kesişim (Intercept)', toSec(reg.intercept), toSec(regNT.intercept), 'sn'],
    ['R² (Belirleyicilik)', dp(reg.r2, 4), dp(regNT.r2, 4)],
    ['Trend Yönü', reg.r2 < trendTh ? 'Belirsiz (R² düşük)' : reg.slope > (st?.stdDev || 10) * 0.1 ? 'Artış ↑' : reg.slope < -(st?.stdDev || 10) * 0.1 ? 'Azalış ↓' : 'Stabil →', regNT.r2 < trendTh ? 'Belirsiz (R² düşük)' : regNT.slope > (stNT?.stdDev || 10) * 0.1 ? 'Artış ↑' : regNT.slope < -(stNT?.stdDev || 10) * 0.1 ? 'Azalış ↓' : 'Stabil →'],
    [],
    ['AYKIRI DEĞERLER', 'Gözlem', 'Normal', ''],
    ['Aykırı Sayısı (IQR)', outliers.size, outliersNT.size],
    ['Aykırı Oranı', dp((outliers.size / (st?.n || 1)) * 100, 1) + '%', dp((outliersNT.size / (stNT?.n || 1)) * 100, 1) + '%']
  ];

  const s1 = XLSX.utils.aoa_to_sheet(s1Data);
  s1['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 8 }];
  const d = userPerc.length - 2; // row offset from dynamic percentile count
  applyStyles(s1, {
    titles: [[0, 4]],
    sections: [[3, 4]],
    sectionRows: [[10, 4], [23, 4], [33 + d, 4], [41 + d, 4], [47 + d, 4]],
    kv: [[1, 1, 4, false], [4, 8, 4, false], [11, 21, 4, true], [24, 31 + d, 4, true], [34 + d, 39 + d, 4, true], [42 + d, 45 + d, 4, false], [48 + d, 49 + d, 4, false]],
    yesNo: [[39 + d, 1], [39 + d, 2]]
  });
  XLSX.utils.book_append_sheet(wb, s1, 'Özet');

  // ========== SHEET 2: HAM VERİ ==========
  const s2Header = [
    'Tur No', 'Süre (sn)', 'Süre (mm:ss.cc)',
    'Tempo (%)', 'Normal (sn)', 'Normal (mm:ss.cc)',
    'Kümülatif (sn)', 'Kümülatif (mm:ss.cc)',
    'Küm. Normal (sn)', 'Küm. Normal (mm:ss.cc)',
    'Etiket Kodu', 'Etiket Adı', 'Not',
    'Aykırı (Gözlem)?', 'Sapma (%)', 'Z-Skor', `Har. Ort. (${maWindow})`, 'Trend Değeri',
    'Aykırı (Normal)?', 'Sapma N (%)', 'Z-Skor N', `Har. Ort. N (${maWindow})`, 'Trend Değeri N'
  ];
  const s2Data = [s2Header];

  let cumRepeat = 0, cumNTRepeat = 0;
  session.laps.forEach((l, i) => {
    cumRepeat += l.t;
    cumNTRepeat += l.nt || l.t;
    const tagName = l.tag !== null && sTags[l.tag] ? sTags[l.tag].name : '';
    const tempo = l.tempo || 100;
    const nt = l.nt || l.t;
    const devMs = l.t - (st?.mean || 0);
    const devPct = st?.mean ? (devMs / st.mean) * 100 : 0;
    const zScore = st?.stdDev ? (l.t - st.mean) / st.stdDev : 0;
    const trendVal = reg.intercept + reg.slope * i;
    const devMsNT = nt - (stNT?.mean || 0);
    const devPctNT = stNT?.mean ? (devMsNT / stNT.mean) * 100 : 0;
    const zScoreNT = stNT?.stdDev ? (nt - stNT.mean) / stNT.stdDev : 0;
    const trendValNT = regNT.intercept + regNT.slope * i;

    s2Data.push([
      i + 1,
      toSec(l.t), ffull(l.t),
      tempo,
      toSec(nt), ffull(nt),
      toSec(cumRepeat), ffull(cumRepeat),
      toSec(cumNTRepeat), ffull(cumNTRepeat),
      l.tag !== null ? l.tag : '', tagName, l.note || '',
      outliers.has(i) ? 'EVET' : 'HAYIR', dp(devPct, 2), dp(zScore, 3), toSec(ma[i]), toSec(trendVal),
      outliersNT.has(i) ? 'EVET' : 'HAYIR', dp(devPctNT, 2), dp(zScoreNT, 3), toSec(maNT[i]), toSec(trendValNT)
    ]);
  });

  const s2 = XLSX.utils.aoa_to_sheet(s2Data);
  s2['!cols'] = [
    { wch: 8 }, { wch: 10 }, { wch: 12 },
    { wch: 8 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 14 },
    { wch: 14 }, { wch: 16 },
    { wch: 10 }, { wch: 15 }, { wch: 30 },
    { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 12 }
  ];
  const NC2 = 23;
  styleColumnHeaders(s2, 0, 0, NC2 - 1);
  addAutoFilter(s2, 0, 0, s2Data.length - 1, NC2 - 1);
  addTableBorders(s2, 0, 0, s2Data.length - 1, NC2 - 1);
  addZebraStripes(s2, 1, s2Data.length - 1, NC2);
  highlightOutlierRows(s2, outliers, 1, NC2);
  for (let i = 1; i < s2Data.length; i++) { styleYesNo(s2, i, 13); styleYesNo(s2, i, 18); }
  XLSX.utils.book_append_sheet(wb, s2, 'Ham Veri');

  // ========== SHEET 3: ETİKET ANALİZİ ==========
  if (sheets.etiketAnalizi !== false) {
  const ta = tagAnalysis(session.laps, sTags, nReqOpts);
  const tagHeader = ['Etiket', 'Adet', 'Oran (%)', 'Toplam (sn)', 'Ortalama (sn)', 'Medyan (sn)',
     'Min (sn)', 'Max (sn)', 'Aralık (sn)', 'Std Sapma (sn)', 'CV (%)',
     'Q1 (sn)', 'Q3 (sn)', 'IQR (sn)', '%95 GA Alt', '%95 GA Üst'];
  const s3Data = [
    ['ETİKET ANALİZİ (Gözlem Süreleri)'],
    [],
    tagHeader
  ];

  ta.forEach(ts => {
    const tLaps = session.laps.filter(l => ts.idx === -1 ? l.tag === null : l.tag === ts.idx);
    const tTimes = tLaps.map(l => l.t);
    const tQ = quartiles(tTimes);

    s3Data.push([
      ts.name,
      ts.count,
      dp((ts.count / (st?.n || 1)) * 100, 1),
      toSec(ts.sum),
      toSec(ts.mean),
      toSec(ts.median),
      toSec(ts.min),
      toSec(ts.max),
      toSec(ts.range),
      toSec(ts.stdDev),
      dp(ts.cv, 2),
      toSec(tQ.q1),
      toSec(tQ.q3),
      toSec(tQ.iqr),
      toSec(ts.ci95Low),
      toSec(ts.ci95High)
    ]);
  });

  s3Data.push(['TOPLAM', st?.n || 0, 100.0, toSec(st?.sum), toSec(st?.mean), toSec(st?.median),
    toSec(st?.min), toSec(st?.max), toSec(st?.range), toSec(st?.stdDev), (dp(st?.cv, 2) || 0),
    toSec(q.q1), toSec(q.q3), toSec(q.iqr), toSec(st?.ci95Low), toSec(st?.ci95High)]);

  // Normal süreler için etiket analizi
  s3Data.push([], ['ETİKET ANALİZİ (Normal Süreler)'], [], tagHeader);

  ta.forEach(ts => {
    const tLaps = session.laps.filter(l => ts.idx === -1 ? l.tag === null : l.tag === ts.idx);
    const tNTimes = tLaps.map(l => l.nt || l.t);
    const tNTStats = calcStats(tNTimes, nReqOpts);
    const tNTQ = quartiles(tNTimes);

    s3Data.push([
      ts.name,
      ts.count,
      dp((ts.count / (st?.n || 1)) * 100, 1),
      toSec(tNTStats?.sum),
      toSec(tNTStats?.mean),
      toSec(tNTStats?.median),
      toSec(tNTStats?.min),
      toSec(tNTStats?.max),
      toSec(tNTStats?.range),
      toSec(tNTStats?.stdDev),
      (dp(tNTStats?.cv, 2) || 0),
      toSec(tNTQ.q1),
      toSec(tNTQ.q3),
      toSec(tNTQ.iqr),
      toSec(tNTStats?.ci95Low),
      toSec(tNTStats?.ci95High)
    ]);
  });

  s3Data.push(['TOPLAM', stNT?.n || 0, 100.0, toSec(stNT?.sum), toSec(stNT?.mean), toSec(stNT?.median),
    toSec(stNT?.min), toSec(stNT?.max), toSec(stNT?.range), toSec(stNT?.stdDev), (dp(stNT?.cv, 2) || 0),
    toSec(qNT.q1), toSec(qNT.q3), toSec(qNT.iqr), toSec(stNT?.ci95Low), toSec(stNT?.ci95High)]);

  const s3 = XLSX.utils.aoa_to_sheet(s3Data);
  s3['!cols'] = Array(16).fill({ wch: 12 });
  s3['!cols'][0] = { wch: 15 };
  const NC3 = 16, tCnt = ta.length;
  // Section 1: Gözlem
  styleReportTitle(s3, 0, NC3);
  styleColumnHeaders(s3, 2, 0, NC3 - 1);
  addTableBorders(s3, 2, 0, 2 + tCnt, NC3 - 1);
  addZebraStripes(s3, 3, 2 + tCnt, NC3);
  styleTotalRow(s3, 3 + tCnt, NC3);
  // Section 2: Normal
  const s3t2 = 5 + tCnt;
  styleReportTitle(s3, s3t2, NC3);
  styleColumnHeaders(s3, s3t2 + 2, 0, NC3 - 1);
  addTableBorders(s3, s3t2 + 2, 0, s3t2 + 2 + tCnt, NC3 - 1);
  addZebraStripes(s3, s3t2 + 3, s3t2 + 2 + tCnt, NC3);
  styleTotalRow(s3, s3t2 + 3 + tCnt, NC3);
  XLSX.utils.book_append_sheet(wb, s3, 'Etiket Analizi');
  }

  // ========== SHEET 4: DAĞILIM ANALİZİ ==========
  if (sheets.dagilimAnalizi !== false) {
  const bins = freqDist(times);
  const freqHeader = ['Aralık Başı (sn)', 'Aralık Sonu (sn)', 'Frekans', 'Oran (%)', 'Kümülatif Frekans', 'Kümülatif (%)'];
  const s4Data = [
    ['FREKANS DAĞILIMI - Gözlem Süreleri'],
    [],
    freqHeader,
  ];

  let cumFreq = 0;
  bins.forEach(b => {
    cumFreq += b.count;
    s4Data.push([
      toSec(b.binStart),
      toSec(b.binEnd),
      b.count,
      dp(b.freq, 2),
      cumFreq,
      dp((cumFreq / (st?.n || 1)) * 100, 2)
    ]);
  });

  // Normal süreler frekans dağılımı
  const binsNT = freqDist(normalTimes);
  s4Data.push([], ['FREKANS DAĞILIMI - Normal Süreler'], [], freqHeader);

  let cumFreqNT = 0;
  binsNT.forEach(b => {
    cumFreqNT += b.count;
    s4Data.push([
      toSec(b.binStart),
      toSec(b.binEnd),
      b.count,
      dp(b.freq, 2),
      cumFreqNT,
      dp((cumFreqNT / (stNT?.n || 1)) * 100, 2)
    ]);
  });

  s4Data.push([], ['PERSENTİL TABLOSU'], []);
  s4Data.push(['Persentil', 'Gözlemlenen (sn)', 'Normal (sn)']);
  userPerc.forEach(p => {
    s4Data.push([
      p + '%',
      toSec(percentile(sorted, p / 100)),
      toSec(percentile(sortedNT, p / 100))
    ]);
  });

  s4Data.push([], ['BOX PLOT VERİLERİ'], []);
  s4Data.push(['Metrik', 'Gözlemlenen (sn)', 'Normal (sn)']);
  s4Data.push(['Minimum', toSec(st?.min), toSec(stNT?.min)]);
  s4Data.push(['Q1', toSec(q.q1), toSec(qNT.q1)]);
  s4Data.push(['Medyan (Q2)', toSec(q.q2), toSec(qNT.q2)]);
  s4Data.push(['Q3', toSec(q.q3), toSec(qNT.q3)]);
  s4Data.push(['Maksimum', toSec(st?.max), toSec(stNT?.max)]);
  s4Data.push(['IQR', toSec(q.iqr), toSec(qNT.iqr)]);
  const iqrK = getSetting('stats', 'iqrMultiplier');
  s4Data.push([`Alt Sınır (Q1-${iqrK}*IQR)`, toSec(q.q1 - iqrK * q.iqr), toSec(qNT.q1 - iqrK * qNT.iqr)]);
  s4Data.push([`Üst Sınır (Q3+${iqrK}*IQR)`, toSec(q.q3 + iqrK * q.iqr), toSec(qNT.q3 + iqrK * qNT.iqr)]);

  const s4 = XLSX.utils.aoa_to_sheet(s4Data);
  s4['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 14 }];
  const bLen = bins.length, bLenNT = binsNT.length, bOff = bLen + bLenNT;
  const pLen = userPerc.length;
  styleReportTitle(s4, 0, 6);
  styleColumnHeaders(s4, 2, 0, 5);
  addTableBorders(s4, 2, 0, 2 + bLen, 5); addZebraStripes(s4, 3, 2 + bLen, 6);
  styleReportTitle(s4, 4 + bLen, 6);
  styleColumnHeaders(s4, 6 + bLen, 0, 5);
  addTableBorders(s4, 6 + bLen, 0, 6 + bLen + bLenNT, 5); addZebraStripes(s4, 7 + bLen, 6 + bLen + bLenNT, 6);
  styleSubSectionHeader(s4, 8 + bOff, 6);
  styleColumnHeaders(s4, 10 + bOff, 0, 2);
  addTableBorders(s4, 10 + bOff, 0, 10 + bOff + pLen, 2); addZebraStripes(s4, 11 + bOff, 10 + bOff + pLen, 3);
  styleSubSectionHeader(s4, 12 + bOff + pLen, 6);
  styleColumnHeaders(s4, 14 + bOff + pLen, 0, 2);
  addTableBorders(s4, 14 + bOff + pLen, 0, 22 + bOff + pLen, 2); addZebraStripes(s4, 15 + bOff + pLen, 22 + bOff + pLen, 3);
  XLSX.utils.book_append_sheet(wb, s4, 'Dağılım Analizi');
  }

  // ========== SHEET 5: TREND ANALİZİ ==========
  if (sheets.trendAnalizi !== false) {
  const s5Data = [
    ['TREND ANALİZİ'],
    [],
    ['REGRESYON ANALİZİ', 'Gözlem', 'Normal'],
    ['Eğim (ms/tur)', dp(reg.slope, 4), dp(regNT.slope, 4)],
    ['Kesişim (sn)', toSec(reg.intercept), toSec(regNT.intercept)],
    ['R²', dp(reg.r2, 4), dp(regNT.r2, 4)],
    ['Trend', reg.r2 < trendTh ? 'Belirsiz' : reg.slope > (st?.stdDev || 10) * 0.1 ? 'Artış' : reg.slope < -(st?.stdDev || 10) * 0.1 ? 'Azalış' : 'Stabil', regNT.r2 < trendTh ? 'Belirsiz' : regNT.slope > (stNT?.stdDev || 10) * 0.1 ? 'Artış' : regNT.slope < -(stNT?.stdDev || 10) * 0.1 ? 'Azalış' : 'Stabil'],
    [],
    ['TUR BAZLI TREND VERİSİ'],
    ['Tur', 'Gözlem (sn)', 'Normal (sn)', 'Har. Ort. Göz. (sn)', 'Har. Ort. Nor. (sn)',
     'Trend Göz. (sn)', 'Göz. - Trend (sn)', 'Trend Nor. (sn)', 'Nor. - Trend (sn)']
  ];

  session.laps.forEach((l, i) => {
    const trendVal = reg.intercept + reg.slope * i;
    const trendValNT = regNT.intercept + regNT.slope * i;
    const nt = l.nt || l.t;
    s5Data.push([
      i + 1,
      toSec(l.t),
      toSec(nt),
      toSec(ma[i]),
      toSec(maNT[i]),
      toSec(trendVal),
      toSec(l.t - trendVal),
      toSec(trendValNT),
      toSec(nt - trendValNT)
    ]);
  });

  const s5 = XLSX.utils.aoa_to_sheet(s5Data);
  s5['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  styleReportTitle(s5, 0, 9);
  styleSubSectionHeader(s5, 2, 9);
  styleKVRows(s5, 3, 6, 3, false);
  styleSubSectionHeader(s5, 8, 9);
  styleColumnHeaders(s5, 9, 0, 8);
  addTableBorders(s5, 9, 0, 9 + session.laps.length, 8);
  addZebraStripes(s5, 10, 9 + session.laps.length, 9);
  addAutoFilter(s5, 9, 0, 9 + session.laps.length, 8);
  XLSX.utils.book_append_sheet(wb, s5, 'Trend Analizi');
  }

  // ========== SHEET 6: AYKIRI DEĞER ANALİZİ ==========
  if (sheets.aykiriDegerler !== false) {
  const outlierListHeader = ['Tur No', 'Süre (sn)', 'Süre (mm:ss.cc)', 'Etiket', 'Sapma Yönü', 'Z-Skor'];
  const s6Data = [
    ['AYKIRI DEĞER ANALİZİ - Gözlem Süreleri (IQR Yöntemi)'],
    [],
    ['SINIRLAR'],
    [`Alt Sınır (Q1 - ${iqrK}*IQR)`, toSec(q.q1 - iqrK * q.iqr), 'sn'],
    [`Üst Sınır (Q3 + ${iqrK}*IQR)`, toSec(q.q3 + iqrK * q.iqr), 'sn'],
    [],
    ['ÖZET'],
    ['Toplam Aykırı Değer', outliers.size],
    ['Aykırı Oranı', dp((outliers.size / (st?.n || 1)) * 100, 1) + '%'],
    [],
    ['AYKIRI DEĞER LİSTESİ'],
    outlierListHeader
  ];

  session.laps.forEach((l, i) => {
    if (outliers.has(i)) {
      const tagName = l.tag !== null && sTags[l.tag] ? sTags[l.tag].name : 'Etiketsiz';
      const zScore = st?.stdDev ? (l.t - st.mean) / st.stdDev : 0;
      const dir = l.t < q.q1 - iqrK * q.iqr ? 'Düşük ↓' : 'Yüksek ↑';
      s6Data.push([i + 1, toSec(l.t), ffull(l.t), tagName, dir, dp(zScore, 2)]);
    }
  });

  if (outliers.size === 0) {
    s6Data.push(['Aykırı değer bulunamadı']);
  }

  // Add stats without outliers
  const cleanTimes = times.filter((_, i) => !outliers.has(i));
  if (cleanTimes.length > 0 && outliers.size > 0) {
    const cleanStats = calcStats(cleanTimes, nReqOpts);
    s6Data.push([], ['AYKIRI DEĞERLER HARİÇ İSTATİSTİKLER']);
    s6Data.push(['Gözlem Sayısı', cleanStats?.n || 0]);
    s6Data.push(['Ortalama', toSec(cleanStats?.mean), 'sn']);
    s6Data.push(['Medyan', toSec(cleanStats?.median), 'sn']);
    s6Data.push(['Std Sapma', toSec(cleanStats?.stdDev), 'sn']);
    s6Data.push(['CV%', dp(cleanStats?.cv, 2) || 0]);
    s6Data.push(['Min', toSec(cleanStats?.min), 'sn']);
    s6Data.push(['Max', toSec(cleanStats?.max), 'sn']);
  }

  // Normal süreler aykırı değer analizi
  const s6NTRow = s6Data.length + 1; // +1 because blank row comes first
  s6Data.push([], ['AYKIRI DEĞER ANALİZİ - Normal Süreler (IQR Yöntemi)'], []);
  s6Data.push(['SINIRLAR']);
  s6Data.push([`Alt Sınır (Q1 - ${iqrK}*IQR)`, toSec(qNT.q1 - iqrK * qNT.iqr), 'sn']);
  s6Data.push([`Üst Sınır (Q3 + ${iqrK}*IQR)`, toSec(qNT.q3 + iqrK * qNT.iqr), 'sn']);
  s6Data.push([]);
  s6Data.push(['ÖZET']);
  s6Data.push(['Toplam Aykırı Değer', outliersNT.size]);
  s6Data.push(['Aykırı Oranı', dp((outliersNT.size / (stNT?.n || 1)) * 100, 1) + '%']);
  s6Data.push([]);
  s6Data.push(['AYKIRI DEĞER LİSTESİ']);
  s6Data.push(outlierListHeader);

  session.laps.forEach((l, i) => {
    if (outliersNT.has(i)) {
      const tagName = l.tag !== null && sTags[l.tag] ? sTags[l.tag].name : 'Etiketsiz';
      const nt = l.nt || l.t;
      const zScore = stNT?.stdDev ? (nt - stNT.mean) / stNT.stdDev : 0;
      const dir = nt < qNT.q1 - iqrK * qNT.iqr ? 'Düşük ↓' : 'Yüksek ↑';
      s6Data.push([i + 1, toSec(nt), ffull(nt), tagName, dir, dp(zScore, 2)]);
    }
  });

  if (outliersNT.size === 0) {
    s6Data.push(['Aykırı değer bulunamadı']);
  }

  const cleanNTimes = normalTimes.filter((_, i) => !outliersNT.has(i));
  if (cleanNTimes.length > 0 && outliersNT.size > 0) {
    const cleanNTStats = calcStats(cleanNTimes, nReqOpts);
    s6Data.push([], ['AYKIRI DEĞERLER HARİÇ İSTATİSTİKLER']);
    s6Data.push(['Gözlem Sayısı', cleanNTStats?.n || 0]);
    s6Data.push(['Ortalama', toSec(cleanNTStats?.mean), 'sn']);
    s6Data.push(['Medyan', toSec(cleanNTStats?.median), 'sn']);
    s6Data.push(['Std Sapma', toSec(cleanNTStats?.stdDev), 'sn']);
    s6Data.push(['CV%', dp(cleanNTStats?.cv, 2) || 0]);
    s6Data.push(['Min', toSec(cleanNTStats?.min), 'sn']);
    s6Data.push(['Max', toSec(cleanNTStats?.max), 'sn']);
  }

  const s6 = XLSX.utils.aoa_to_sheet(s6Data);
  s6['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 12 }, { wch: 10 }];
  // Style Aykırı Değerler - complex multi-section, apply key styles
  styleReportTitle(s6, 0, 6);
  styleSubSectionHeader(s6, 2, 6); // SINIRLAR
  styleKVRows(s6, 3, 4, 3, true);
  styleSubSectionHeader(s6, 6, 6); // ÖZET
  styleKVRows(s6, 7, 8, 3, false);
  styleSubSectionHeader(s6, 10, 6); // AYKIRI DEĞER LİSTESİ
  styleColumnHeaders(s6, 11, 0, 5);
  // Outlier list rows
  const oListEnd = 11 + outliers.size + (outliers.size === 0 ? 1 : 0);
  if (outliers.size > 0) addTableBorders(s6, 11, 0, oListEnd, 5);
  // Style "AYKIRI DEĞERLER HARİÇ" Gözlem section (only when outliers exist)
  if (outliers.size > 0 && cleanTimes.length > 0) {
    styleSubSectionHeader(s6, oListEnd + 2, 6);
    styleKVRows(s6, oListEnd + 3, oListEnd + 9, 3, true);
  }
  // Normal section styling (mirror of Gözlem)
  styleReportTitle(s6, s6NTRow, 6);
  styleSubSectionHeader(s6, s6NTRow + 2, 6); // SINIRLAR
  styleKVRows(s6, s6NTRow + 3, s6NTRow + 4, 3, true);
  styleSubSectionHeader(s6, s6NTRow + 6, 6); // ÖZET
  styleKVRows(s6, s6NTRow + 7, s6NTRow + 8, 3, false);
  styleSubSectionHeader(s6, s6NTRow + 10, 6); // AYKIRI DEĞER LİSTESİ
  styleColumnHeaders(s6, s6NTRow + 11, 0, 5);
  // Style "AYKIRI DEĞERLER HARİÇ" Normal section (only when outliers exist)
  const oNTListEnd = s6NTRow + 11 + outliersNT.size + (outliersNT.size === 0 ? 1 : 0);
  if (outliersNT.size > 0 && cleanNTimes.length > 0) {
    styleSubSectionHeader(s6, oNTListEnd + 2, 6);
    styleKVRows(s6, oNTListEnd + 3, oNTListEnd + 9, 3, true);
  }
  XLSX.utils.book_append_sheet(wb, s6, 'Aykırı Değerler');
  }

  // ========== SHEET 7: TEMPO ANALİZİ ==========
  if (sheets.tempoAnalizi !== false) {
  const tempoGroups = {};
  const tempoGroupsNT = {};
  session.laps.forEach(l => {
    const t = l.tempo || 100;
    if (!tempoGroups[t]) { tempoGroups[t] = []; tempoGroupsNT[t] = []; }
    tempoGroups[t].push(l.t);
    tempoGroupsNT[t].push(l.nt || l.t);
  });

  const tempoHeader = ['Tempo (%)', 'Adet', 'Oran (%)', 'Toplam (sn)', 'Ortalama (sn)', 'Min (sn)', 'Max (sn)', 'Std Sapma (sn)', 'CV (%)'];
  const tempoKeys = Object.keys(tempoGroups).sort((a, b) => +b - +a);
  const s7Data = [
    ['TEMPO ANALİZİ (Gözlem Süreleri)'],
    [],
    tempoHeader
  ];

  tempoKeys.forEach(tempo => {
    const tTimes = tempoGroups[tempo];
    const tStats = calcStats(tTimes, nReqOpts);
    s7Data.push([
      +tempo,
      tStats?.n || 0,
      dp((tStats?.n / (st?.n || 1)) * 100, 1),
      toSec(tStats?.sum),
      toSec(tStats?.mean),
      toSec(tStats?.min),
      toSec(tStats?.max),
      toSec(tStats?.stdDev),
      (dp(tStats?.cv, 2) || 0)
    ]);
  });

  // Normal süreler tempo analizi
  s7Data.push([], ['TEMPO ANALİZİ (Normal Süreler)'], [], tempoHeader);

  tempoKeys.forEach(tempo => {
    const tNTimes = tempoGroupsNT[tempo];
    const tNTStats = calcStats(tNTimes, nReqOpts);
    s7Data.push([
      +tempo,
      tNTStats?.n || 0,
      dp((tNTStats?.n / (stNT?.n || 1)) * 100, 1),
      toSec(tNTStats?.sum),
      toSec(tNTStats?.mean),
      toSec(tNTStats?.min),
      toSec(tNTStats?.max),
      toSec(tNTStats?.stdDev),
      (dp(tNTStats?.cv, 2) || 0)
    ]);
  });

  // Add tempo distribution
  s7Data.push([], ['TEMPO DAĞILIMI (Tur Bazlı)'], []);
  s7Data.push(['Tur', 'Tempo (%)', 'Süre (sn)', 'Normal Süre (sn)', 'Etki (%)']);
  session.laps.forEach((l, i) => {
    const tempo = l.tempo || 100;
    const nt = l.nt || l.t;
    const effect = tempo !== 100 && l.t > 0 ? ((l.t - nt) / l.t) * 100 : 0;
    s7Data.push([i + 1, tempo, toSec(l.t), toSec(nt), dp(effect, 2)]);
  });

  const s7 = XLSX.utils.aoa_to_sheet(s7Data);
  s7['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
  const NC7 = 9, tKeys = tempoKeys.length;
  styleReportTitle(s7, 0, NC7);
  styleColumnHeaders(s7, 2, 0, NC7 - 1);
  addTableBorders(s7, 2, 0, 2 + tKeys, NC7 - 1); addZebraStripes(s7, 3, 2 + tKeys, NC7);
  const s7nt = 4 + tKeys;
  styleReportTitle(s7, s7nt, NC7);
  styleColumnHeaders(s7, s7nt + 2, 0, NC7 - 1);
  addTableBorders(s7, s7nt + 2, 0, s7nt + 2 + tKeys, NC7 - 1); addZebraStripes(s7, s7nt + 3, s7nt + 2 + tKeys, NC7);
  const s7d = s7nt + 4 + tKeys;
  styleReportTitle(s7, s7d, NC7);
  styleColumnHeaders(s7, s7d + 2, 0, 4);
  addTableBorders(s7, s7d + 2, 0, s7d + 2 + session.laps.length, 4);
  addZebraStripes(s7, s7d + 3, s7d + 2 + session.laps.length, 5);
  addAutoFilter(s7, s7d + 2, 0, s7d + 2 + session.laps.length, 4);
  XLSX.utils.book_append_sheet(wb, s7, 'Tempo Analizi');
  }

  // ========== SHEET 8: NOTLAR ==========
  if (sheets.notlar !== false) {
  const notesData = session.laps.filter(l => l.note);
  const s8Data = [
    ['NOTLAR'],
    [],
    ['Tur No', 'Süre (sn)', 'Süre (mm:ss.cc)', 'Etiket', 'Tempo', 'Not']
  ];

  if (notesData.length > 0) {
    session.laps.forEach((l, i) => {
      if (l.note) {
        const tagName = l.tag !== null && sTags[l.tag] ? sTags[l.tag].name : '';
        s8Data.push([i + 1, toSec(l.t), ffull(l.t), tagName, l.tempo || 100, l.note]);
      }
    });
  } else {
    s8Data.push(['Not bulunamadı']);
  }

  const s8 = XLSX.utils.aoa_to_sheet(s8Data);
  s8['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 15 }, { wch: 10 }, { wch: 50 }];
  styleReportTitle(s8, 0, 6);
  styleColumnHeaders(s8, 2, 0, 5);
  if (notesData.length > 0) {
    addTableBorders(s8, 2, 0, 2 + notesData.length, 5);
    addZebraStripes(s8, 3, 2 + notesData.length, 6);
  }
  XLSX.utils.book_append_sheet(wb, s8, 'Notlar');
  }

  // ========== SHEET 9: KONFİGÜRASYON ==========
  if (sheets.konfigurasyon !== false) {
  const s9Data = [
    ['KONFİGÜRASYON'],
    [],
    ['ETİKETLER'],
    ['No', 'İsim', 'İkon'],
  ];
  sTags.forEach((t, i) => {
    s9Data.push([i + 1, t.name, t.icon || 'tag']);
  });

  s9Data.push([], ['ÖLÇÜM MODU'], ['Mod', 'Tekrarlı (repeat)']);
  s9Data.push([], ['NREQ PARAMETRELERİ']);
  s9Data.push(['Güven Düzeyi', `%${confPct}`]);
  s9Data.push(['Hata Payı', `±%${errPct}`]);
  s9Data.push([], ['VERSİYON BİLGİSİ']);
  s9Data.push(['Export Versiyonu', '5.0']);
  s9Data.push(['Uygulama', 'Zaman Etüdü PWA']);

  const s9 = XLSX.utils.aoa_to_sheet(s9Data);
  s9['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 12 }];
  styleReportTitle(s9, 0, 3);
  styleSubSectionHeader(s9, 2, 3); // ETİKETLER
  styleColumnHeaders(s9, 3, 0, 2);
  addTableBorders(s9, 3, 0, 3 + sTags.length, 2);
  addZebraStripes(s9, 4, 3 + sTags.length, 3);
  const s9m = 5 + sTags.length;
  styleSubSectionHeader(s9, s9m, 3); // ÖLÇÜM MODU
  styleKVRows(s9, s9m + 1, s9m + 1, 3, false);
  styleSubSectionHeader(s9, s9m + 3, 3); // NREQ
  styleKVRows(s9, s9m + 4, s9m + 5, 3, false);
  styleSubSectionHeader(s9, s9m + 7, 3); // VERSİYON
  styleKVRows(s9, s9m + 8, s9m + 9, 3, false);
  XLSX.utils.book_append_sheet(wb, s9, 'Konfigürasyon');
  }
  if (sheets.terimlerSozlugu !== false) buildGlossarySheet(wb, 'repeat');
}

// ============ GLOSSARY SHEET (SHARED) ============

function buildGlossarySheet(wb, mode) {
  const isSeq = mode === 'sequence';
  const NC = 4;
  const iqrK = getSetting('stats', 'iqrMultiplier');
  const trend = isSeq ? 'Çevrim Trend' : 'Trend Analizi';
  const etiket = isSeq ? 'Anomali Analizi' : 'Etiket Analizi';

  const data = [
    ['TERİMLER SÖZLÜĞÜ'],
    ['Bu sayfa, rapordaki tüm istatistiksel ve teknik terimlerin açıklamalarını ve hangi sayfalarda geçtiğini listeler.'],
    [],
    ['Kategori', 'Terim', 'Açıklama', 'Bulunduğu Sayfalar'],

    // ── ÖLÇÜM KAVRAMLARI ──
    ['Ölçüm Kavramları', 'Gözlem Süresi',
      'Kronometreyle doğrudan ölçülen ham süre değeri. Tempo düzeltmesi uygulanmamış haldir.',
      'Özet, Ham Veri, ' + etiket + ', Dağılım Analizi, ' + trend + ', Aykırı Değerler, Tempo Analizi'],
    ['Ölçüm Kavramları', 'Normal Süre',
      'Gözlem süresinin tempo ile düzeltilmiş hali. Formül: Normal = Gözlem × (Tempo / 100). Farklı hızlardaki operatörlerin süreleri karşılaştırılabilir hale gelir.',
      'Özet, Ham Veri, ' + etiket + ', Dağılım Analizi, ' + trend + ', Aykırı Değerler, Tempo Analizi'],
    ['Ölçüm Kavramları', 'Tempo (%)',
      'Operatörün çalışma hızının referans (normal) hıza oranı. 100% = normal hız, >100% = hızlı, <100% = yavaş. Zaman etüdünde performans değerlendirmesi için kullanılır.',
      'Özet, Ham Veri, Tempo Analizi, Konfigürasyon'],
    ['Ölçüm Kavramları', isSeq ? 'Kayıt' : 'Tur',
      isSeq ? 'Bir adımın tek bir gözlem kaydı. Her kayıt bir adıma ve bir çevrime aittir.' : 'Her bir tekrarlı ölçüm kaydı. Kronometrenin bir kez başlatılıp durdurulmasıyla oluşur.',
      isSeq ? 'Ham Veri, Notlar' : 'Ham Veri, Etiket Analizi, Aykırı Değerler, Notlar'],
    ['Ölçüm Kavramları', 'Kümülatif Süre',
      'Başlangıçtan itibaren biriken toplam süre. Her yeni ölçümde bir öncekinin üzerine eklenerek hesaplanır.',
      'Ham Veri'],
    ['Ölçüm Kavramları', 'Not',
      'Ölçüm kaydına eklenen serbest metin açıklama. Özel durumları kayıt altına almak için kullanılır.',
      'Ham Veri, Notlar'],
  ];

  if (isSeq) {
    data.push(
      ['Ölçüm Kavramları', 'Çevrim',
        'Tüm adımların bir kez sırasıyla tamamlanmasıyla oluşan iş döngüsü. Çevrim sayısı = toplam kayıt / adım sayısı.',
        'Özet, Ham Veri, Çevrim Analizi, Adım Karşılaştırma, Çevrim Trend, Aykırı Değerler'],
      ['Ölçüm Kavramları', 'Adım',
        'İşlemin alt parçaları. Her çevrimde tanımlı sırayla tekrarlanır. Adım sayısı Konfigürasyon sayfasında listelenir.',
        'Ham Veri, Adım Analizi, Adım Karşılaştırma, Dağılım Analizi, Anomali Analizi, Konfigürasyon'],
      ['Ölçüm Kavramları', 'Çevrim Süresi',
        'Bir çevrimdeki tüm adımların toplam süresi. Çevrim bazlı istatistikler bu değer üzerinden hesaplanır.',
        'Özet, Çevrim Analizi, Çevrim Trend, Aykırı Değerler'],
      ['Ölçüm Kavramları', 'Tam Çevrim',
        'Tüm adımları eksiksiz olarak tamamlanmış çevrim. Eksik (yarım kalmış) çevrimler istatistik analizlerine dahil edilmez.',
        'Özet, Çevrim Analizi'],
      ['Ölçüm Kavramları', 'Anomali Etiketi',
        'Kayıt sırasında meydana gelen normal dışı bir olayı (ör: malzeme düşürme, makine duruşu) işaretlemek için kullanılan etiket.',
        'Ham Veri, Anomali Analizi, Konfigürasyon']
    );
  } else {
    data.push(
      ['Ölçüm Kavramları', 'Etiket',
        'Tura atanan kalite/durum sınıflandırması (ör: "Düşürme", "Bekleme"). İstenmeyen durumları işaretleyip filtrelemeye yarar.',
        'Ham Veri, Etiket Analizi, Aykırı Değerler, Notlar, Konfigürasyon'],
      ['Ölçüm Kavramları', 'Etiket Kodu',
        'Her etiketin sistemdeki sayısal tanımlayıcısı (0, 1, 2…). Etiket adıyla eşleştirilir.',
        'Ham Veri, Etiket Analizi']
    );
  }

  // ── BİRİMLER ──
  data.push(
    ['Birimler', 'ms (milisaniye)',
      'Saniyenin binde biri (1 sn = 1000 ms). Sistemin dahili hesaplama birimidir.',
      'Ham Veri'],
    ['Birimler', 'sn (saniye)',
      'Tüm sayfalarda kullanılan standart zaman birimi. ms değeri 1000\'e bölünerek elde edilir.',
      'Özet, Ham Veri, ' + etiket + ', Dağılım Analizi, ' + trend + ', Aykırı Değerler, Tempo Analizi'],
    ['Birimler', 'mm:ss.cc',
      'Dakika:Saniye.Salisaniye formatı (ör: 01:23.45 = 1 dk 23 sn 45 salise). Uzun sürelerin okunabilir gösterimi.',
      isSeq ? 'Ham Veri, Çevrim Analizi, Aykırı Değerler' : 'Ham Veri, Aykırı Değerler']
  );

  // ── TEMEL İSTATİSTİKLER ──
  data.push(
    ['Temel İstatistikler', 'Ortalama (Mean, x̄)',
      'Tüm değerlerin toplamının gözlem sayısına bölümü. Merkezi eğilimin temel ölçüsüdür.',
      'Özet, ' + etiket + ', ' + (isSeq ? 'Adım Analizi, Adım Karşılaştırma, ' : '') + 'Aykırı Değerler, Tempo Analizi'],
    ['Temel İstatistikler', 'Medyan (Median)',
      'Veriler küçükten büyüğe sıralandığında tam ortaya düşen değer. Aykırı değerlerden etkilenmez, bu yüzden ortalamadan daha güvenilir olabilir.',
      'Özet, ' + etiket + ', ' + (isSeq ? 'Adım Analizi, Adım Karşılaştırma, ' : '') + 'Aykırı Değerler'],
    ['Temel İstatistikler', 'Mod (Mode)',
      'Veri setinde en sık tekrarlanan değer. Sürekli veride anlamlı olması için 10ms yuvarlama ile hesaplanır.',
      'Özet'],
    ['Temel İstatistikler', 'Standart Sapma (σ)',
      'Değerlerin ortalamadan ne kadar saptığını ölçer. Düşük = tutarlı, yüksek = değişken. Örneklem formülü (n-1 serbestlik derecesi) kullanılır.',
      'Özet, ' + etiket + ', ' + (isSeq ? 'Adım Analizi, Adım Karşılaştırma, ' : '') + 'Aykırı Değerler, Tempo Analizi'],
    ['Temel İstatistikler', 'Varyans (σ²)',
      'Standart sapmanın karesi. Matematiksel hesaplamalarda kullanılan değişkenlik ölçüsüdür.',
      'Özet'],
    ['Temel İstatistikler', 'CV% (Varyasyon Katsayısı)',
      'Standart Sapma / Ortalama × 100. Farklı ölçeklerdeki verilerin değişkenliğini karşılaştırır. <%10 iyi, <%20 kabul edilebilir.',
      'Özet, ' + etiket + ', ' + (isSeq ? 'Adım Analizi, ' : '') + 'Aykırı Değerler, Tempo Analizi'],
    ['Temel İstatistikler', 'SE (Standart Hata)',
      'Örneklem ortalamasının standart hatası. Formül: Std Sapma / √n. Güven aralığı hesabında kullanılır.',
      'Özet'],
    ['Temel İstatistikler', 'Min (Minimum)',
      'Veri setindeki en küçük değer.',
      'Özet, ' + etiket + ', ' + (isSeq ? 'Adım Analizi, Adım Karşılaştırma, ' : '') + 'Aykırı Değerler, Tempo Analizi'],
    ['Temel İstatistikler', 'Max (Maksimum)',
      'Veri setindeki en büyük değer.',
      'Özet, ' + etiket + ', ' + (isSeq ? 'Adım Analizi, Adım Karşılaştırma, ' : '') + 'Aykırı Değerler, Tempo Analizi'],
    ['Temel İstatistikler', 'Aralık (Range)',
      'Max − Min farkı. Verinin toplam yayılma genişliğini gösterir.',
      'Özet, ' + etiket + (isSeq ? ', Adım Analizi' : '')],
    ['Temel İstatistikler', 'Toplam (Sum)',
      'Tüm değerlerin toplamı.',
      'Özet, ' + etiket + ', Tempo Analizi'],
    ['Temel İstatistikler', 'n (Gözlem Sayısı)',
      'Analize dahil edilen veri noktası sayısı.',
      'Özet, Aykırı Değerler']
  );

  // ── DAĞILIM ──
  data.push(
    ['Dağılım', 'Q1 (1. Çeyreklik)',
      'Verilerin %25\'inin altında kaldığı değer. Lineer interpolasyon (Excel PERCENTILE.INC uyumlu) yöntemiyle hesaplanır.',
      'Özet, ' + etiket + ', Dağılım Analizi, Aykırı Değerler'],
    ['Dağılım', 'Q2 (2. Çeyreklik / Medyan)',
      'Verilerin %50\'sinin altında kaldığı değer. Medyanla aynıdır.',
      'Özet, Dağılım Analizi'],
    ['Dağılım', 'Q3 (3. Çeyreklik)',
      'Verilerin %75\'inin altında kaldığı değer.',
      'Özet, ' + etiket + ', Dağılım Analizi, Aykırı Değerler'],
    ['Dağılım', 'IQR (Çeyreklikler Arası Aralık)',
      'Q3 − Q1 farkı. Ortadaki %50 verinin yayılma genişliği. Aykırı değer tespitinde sınır hesabı için kullanılır.',
      'Özet, ' + etiket + ', Dağılım Analizi, Aykırı Değerler'],
    ['Dağılım', 'Persentil (Yüzdelik Dilim)',
      'Verilerin belirli bir yüzdesinin altında kaldığı değer. Raporda 5p, 10p, 25p, 50p, 75p, 90p, 95p kullanılır.',
      'Özet, Dağılım Analizi'],
    ['Dağılım', 'Çarpıklık (Skewness)',
      'Dağılımın simetrisini ölçer. 0 = simetrik, >0 = sağa çarpık (uzun sağ kuyruk), <0 = sola çarpık. Örneklem formülü kullanılır.',
      'Özet' + (isSeq ? ', Dağılım Analizi' : '')],
    ['Dağılım', 'Basıklık (Kurtosis)',
      'Dağılımın sivrilik derecesi (excess kurtosis). >0 = sivri/ağır kuyruklu, <0 = basık/hafif kuyruklu, 0 = normal dağılıma yakın.',
      'Özet' + (isSeq ? ', Dağılım Analizi' : '')],
    ['Dağılım', 'Frekans Dağılımı',
      'Veriler eşit genişlikte aralıklara (bin) bölünür ve her aralığa düşen gözlem sayısı gösterilir. Histogram oluşturmak için kullanılır.',
      'Dağılım Analizi'],
    ['Dağılım', 'Frekans',
      'Belirli bir aralığa düşen veri noktası sayısı.',
      'Dağılım Analizi'],
    ['Dağılım', 'Kümülatif Oran (%)',
      'Başlangıçtan itibaren biriken frekans yüzdesi. %50 noktası medyana, %100 toplama karşılık gelir.',
      'Dağılım Analizi'],
    ['Dağılım', 'Box Plot Verileri',
      'Dağılımın 5 sayı özeti: Min, Q1, Medyan, Q3, Max ve IQR bazlı alt/üst sınırlar. Kutu grafiği çizmek için veri sağlar.',
      'Dağılım Analizi']
  );

  // ── GÜVEN ARALIĞI & YETERLİLİK ──
  data.push(
    ['Güven Aralığı', '%95 Güven Aralığı (GA)',
      'Gerçek popülasyon ortalamasının %95 olasılıkla bulunduğu aralık. n≤30 için t-dağılımı, n>30 için z=1.96 kullanılır.',
      'Özet' + (isSeq ? ', Anomali Analizi' : ', Etiket Analizi')],
    ['Güven Aralığı', '%99 Güven Aralığı',
      '%99 olasılıkla gerçek ortalamanın bulunduğu aralık. %95 GA\'dan daha geniş ama daha kesindir.',
      'Özet'],
    ['Güven Aralığı', 'GA Alt / GA Üst',
      'Güven aralığının alt ve üst sınır değerleri. Gerçek ortalama bu iki değer arasındadır.',
      'Özet' + (isSeq ? ', Anomali Analizi' : ', Etiket Analizi')],
    ['Güven Aralığı', 'Gerekli ' + (isSeq ? 'Çevrim' : 'Gözlem') + ' (nReq)',
      'Seçilen güven düzeyi ve hata payı için istatistiksel olarak gereken minimum ölçüm sayısı. Formül: n\' = (z/e × s/x̄)²',
      'Özet, Konfigürasyon'],
    ['Güven Aralığı', 'Güven Düzeyi',
      'nReq hesabında kullanılan olasılık seviyesi. %90 (z=1.645), %95 (z=1.96), %99 (z=2.576) seçenekleri mevcuttur.',
      'Özet, Konfigürasyon'],
    ['Güven Aralığı', 'Hata Payı (±%)',
      'nReq hesabında kabul edilen maksimum sapma oranı. ±%3 (hassas), ±%5 (standart), ±%10 (kaba) seçenekleri mevcuttur.',
      'Özet, Konfigürasyon'],
    ['Güven Aralığı', 'Yeterli mi?',
      'Yapılan ölçüm sayısının gerekli minimum sayıya (nReq) ulaşıp ulaşmadığını gösterir. EVET = yeterli, HAYIR = daha fazla ölçüm gerekli.',
      'Özet']
  );

  // ── TREND & REGRESYON ──
  data.push(
    ['Trend & Regresyon', 'Doğrusal Regresyon',
      'Verilere en uygun doğruyu (y = eğim × x + kesişim) bulan istatistiksel yöntem. Sürelerin zamana göre artıp artmadığını belirler.',
      'Özet, ' + trend],
    ['Trend & Regresyon', 'Eğim (Slope)',
      'Trend doğrusunun yükselme/alçalma oranı. Negatif = süreler azalıyor (iyileşme/öğrenme), pozitif = artıyor (yorulma/kötüleşme).',
      'Özet, ' + trend],
    ['Trend & Regresyon', 'Kesişim (Intercept)',
      'Trend doğrusunun başlangıç noktası (x=0 anındaki tahmini değer). İlk ölçüm için regresyonun öngördüğü süre.',
      'Özet, ' + trend],
    ['Trend & Regresyon', 'R² (Belirleyicilik Katsayısı)',
      'Regresyon modelinin veriyi ne ölçüde açıkladığı. 0 = hiç açıklamıyor, 1 = tam açıklıyor. >0.7 güçlü trend, <0.3 zayıf/yok.',
      'Özet, ' + trend],
    ['Trend & Regresyon', 'Trend Yönü',
      'Eğime göre sürelerin zamanla azaldığını (↓ iyileşme), arttığını (↑ kötüleşme) veya sabit kaldığını (→ stabil) gösteren etiket.',
      'Özet'],
    ['Trend & Regresyon', 'Trend Değeri',
      'Regresyon doğrusunun belirli bir ölçüm noktası (sıra numarası) için tahmin ettiği süre değeri.',
      'Ham Veri, ' + trend],
    ['Trend & Regresyon', 'Hareketli Ortalama (5)',
      'Son 5 ölçümün ortalaması. Anlık dalgalanmaları yumuşatarak kısa vadeli eğilimi gösterir. İlk 4 ölçüm için kısmi ortalama alınır.',
      'Ham Veri, ' + trend],
    ['Trend & Regresyon', 'Sapma (Gerçek − Trend)',
      'Gerçek ölçüm değeri ile trend doğrusunun tahmininin farkı. Sürecin ne kadar tutarlı olduğunu gösterir.',
      'Ham Veri, ' + trend]
  );

  // ── AYKIRI DEĞERLER ──
  data.push(
    ['Aykırı Değerler', 'Aykırı Değer (Outlier)',
      'Normal dağılım aralığından belirgin şekilde sapan ölçüm. Hatalı ölçüm, operatör hatası veya gerçek proses anomalisi göstergesi olabilir.',
      'Özet, Ham Veri, Aykırı Değerler'],
    ['Aykırı Değerler', 'IQR Yöntemi',
      `Q1 − ${iqrK}×IQR altı veya Q3 + ${iqrK}×IQR üstü değerleri aykırı kabul eden yaygın istatistiksel yöntem. Dağılım şeklinden bağımsızdır.`,
      'Aykırı Değerler'],
    ['Aykırı Değerler', 'Alt Sınır',
      `Q1 − ${iqrK}×IQR. Bu değerin altındaki ölçümler anormal derecede düşük kabul edilir.`,
      'Aykırı Değerler'],
    ['Aykırı Değerler', 'Üst Sınır',
      `Q3 + ${iqrK}×IQR. Bu değerin üstündeki ölçümler anormal derecede yüksek kabul edilir.`,
      'Aykırı Değerler'],
    ['Aykırı Değerler', 'Z-Skor (Z-Score)',
      'Bir değerin ortalamadan kaç standart sapma uzaklıkta olduğu. Formül: (x − x̄) / σ. |Z| > 2 genelde dikkat çekici, > 3 güçlü aykırı.',
      'Ham Veri, Aykırı Değerler'],
    ['Aykırı Değerler', 'Sapma Yönü',
      'Aykırı değerin düşük yönde (↓ alt sınırın altı) veya yüksek yönde (↑ üst sınırın üstü) saptığını belirtir.',
      'Aykırı Değerler'],
    ['Aykırı Değerler', 'Temiz İstatistikler',
      'Aykırı değerler veri setinden çıkarıldıktan sonra yeniden hesaplanan ortalama, medyan, std sapma vb. Gerçek süreç performansını daha iyi yansıtır.',
      'Aykırı Değerler'],
    ['Aykırı Değerler', 'Aykırı Oranı (%)',
      'Aykırı değerlerin toplam gözlem (veya çevrim) sayısına oranı. Formül: Aykırı Sayısı / n × 100.',
      'Özet, Aykırı Değerler']
  );

  // ── TEMPO ANALİZİ ──
  data.push(
    ['Tempo Analizi', 'Tempo Gruplaması',
      'Aynı tempo değerine sahip ölçümlerin bir araya getirilerek grup bazlı istatistiklerinin hesaplanması.',
      'Tempo Analizi'],
    ['Tempo Analizi', 'Etki (%)',
      'Tempo düzeltmesinin süre üzerindeki yüzdesel etkisi. Formül: (Gözlem − Normal) / Gözlem × 100. Pozitif = tempo süreyi kısaltmış.',
      'Tempo Analizi']
  );

  // ── HAM VERİ SÜTUNLARI ──
  data.push(
    ['Ham Veri Sütunları', 'Sapma (%)',
      'Bir ölçümün ortalamadan yüzde olarak ne kadar saptığı. Formül: (Ölçüm − Ortalama) / Ortalama × 100.',
      'Ham Veri'],
    ['Ham Veri Sütunları', 'Aykırı (Gözlem)?',
      'Gözlem süreleri üzerinden IQR yöntemiyle yapılan aykırı değer tespiti. EVET = aykırı, HAYIR = normal aralıkta.',
      'Ham Veri'],
    ['Ham Veri Sütunları', 'Aykırı (Normal)?',
      'Normal süreler üzerinden ayrıca yapılan aykırı değer tespiti. Gözlem ve normal aykırıları farklı olabilir.',
      'Ham Veri'],
    ['Ham Veri Sütunları', 'Sapma N (%)',
      'Normal sürenin normal ortalamadan yüzde olarak sapması. "Sapma (%)" sütununun normal süre karşılığıdır.',
      'Ham Veri'],
    ['Ham Veri Sütunları', 'Z-Skor N',
      'Normal sürenin normal ortalamadan kaç standart sapma uzakta olduğu. "Z-Skor" sütununun normal süre karşılığıdır.',
      'Ham Veri'],
    ['Ham Veri Sütunları', 'Har. Ort. N (5)',
      'Normal süreler üzerinden hesaplanan 5 noktalı hareketli ortalama. Gözlem hareketli ortalamasının normal süre karşılığıdır.',
      'Ham Veri'],
    ['Ham Veri Sütunları', 'Trend Değeri N',
      'Normal süreler için regresyon doğrusunun tahmin ettiği değer. Gözlem "Trend Değeri" sütununun normal süre karşılığıdır.',
      'Ham Veri']
  );

  // ── MOD-SPECIFIC SECTIONS ──
  if (isSeq) {
    data.push(
      ['Çevrim & Adım', 'Oran (%)',
        'Bir adımın toplam çevrim süresi içindeki payı. Darboğaz adımlarını belirlemeye yarar.',
        'Adım Analizi'],
      ['Çevrim & Adım', 'Adım Karşılaştırma Matrisi',
        'Çevrim × Adım formatında matris tablo. Her hücrede ilgili adımın o çevrimdeki süresi yer alır. Çevrimler arası tutarlılık kontrolü sağlar.',
        'Adım Karşılaştırma'],
      ['Çevrim & Adım', 'Anomali Özeti',
        'Her anomali etiketinin hangi adımlarda kaç kez görüldüğünü ve etkilenen çevrim sayısını gösteren tablo.',
        'Anomali Analizi'],
      ['Çevrim & Adım', 'Anomali Detayı',
        'Anomali etiketi taşıyan her kaydın çevrim, adım, süre ve not bilgilerini içeren detaylı liste.',
        'Anomali Analizi'],
      ['Çevrim & Adım', 'Adım Bazlı Aykırı Özeti',
        'Her adım için ayrı ayrı hesaplanan aykırı değer sayısı ve oranı (hem gözlem hem normal).',
        'Aykırı Değerler'],
      ['Çevrim & Adım', 'Adım Bazlı Dağılım',
        'Her adım için Q1, Medyan, Q3, IQR, Çarpıklık, Basıklık değerlerini gösteren özet tablo.',
        'Dağılım Analizi'],
      ['Çevrim & Adım', 'Çevrim Toplamı',
        'Adım karşılaştırma matrisinde bir çevrimdeki tüm adım sürelerinin toplamı. Çevrim süresiyle aynı değerdir.',
        'Adım Karşılaştırma'],
      ['Çevrim & Adım', 'Aykırı Çevrim Sayısı',
        'IQR yöntemiyle tespit edilen aykırı çevrim sayısı. Çevrim süreleri üzerinden hesaplanan sınırların dışında kalan çevrimler.',
        'Özet, Aykırı Değerler'],
      ['Çevrim & Adım', 'Anomali Kodu',
        'Anomali etiketinin sistem içindeki sayısal tanımlayıcısı. Repeat modundaki "Etiket Kodu" karşılığıdır.',
        'Ham Veri'],
      ['Çevrim & Adım', 'Anomali Adı',
        'Anomali etiketinin metin olarak görünen adı (ör: "Düşürme", "Bekleme").',
        'Ham Veri, Anomali Analizi'],
      ['Çevrim & Adım', 'Anomali Türü',
        'Anomali detayı tablosundaki sütun. Anomali etiketi adıyla aynı bilgiyi içerir.',
        'Anomali Analizi'],
      ['Çevrim & Adım', 'Trend Eğimi',
        'Her adım için ayrı hesaplanan regresyon eğimi. Adımın çevrimler boyunca hızlanıp yavaşladığını gösterir.',
        'Adım Analizi'],
      ['Çevrim & Adım', 'Eksik Kayıt',
        'Son çevrimde tamamlanamamış kayıt sayısı. Toplam kayıt ÷ adım sayısı bölümünden kalan değerdir.',
        'Özet'],
      ['Çevrim & Adım', 'Toplam Kayıt',
        'Ölçüm oturumunda yapılan tüm kayıtların sayısı. Tam ve eksik çevrimlerdeki tüm adım kayıtlarını içerir.',
        'Özet'],
      ['Çevrim & Adım', 'Adım Sayısı',
        'Ardışık işlemde tanımlanan toplam adım sayısı. Bir çevrim bu kadar adımdan oluşur.',
        'Özet, Konfigürasyon']
    );
  } else {
    data.push(
      ['Etiket Analizi', 'Etiket Bazlı İstatistikler',
        'Her etiket için ayrı ayrı hesaplanan adet, oran, toplam, ortalama, medyan, std sapma, güven aralığı vb. değerler.',
        'Etiket Analizi'],
      ['Etiket Analizi', 'Etiket Oranı (%)',
        'Bir etiketin tüm turlar içinde kullanılma yüzdesi. Hangi durumların ne sıklıkta oluştuğunu gösterir.',
        'Etiket Analizi']
    );
  }

  // ── RAPOR BİLGİLERİ ──
  data.push(
    ['Rapor Bilgileri', 'Oluşturma Tarihi',
      'Excel raporunun oluşturulduğu tarih ve saat. Her export işleminde otomatik olarak güncellenir.',
      'Özet'],
    ['Rapor Bilgileri', 'İş / Proses Adı',
      'Ölçümü yapılan iş veya prosesin tanımlayıcı adı. Ölçüm başlatılırken kullanıcı tarafından girilir.',
      'Özet'],
    ['Rapor Bilgileri', 'Operatör',
      'Ölçümü gerçekleştiren kişinin adı veya tanımlayıcısı.',
      'Özet'],
    ['Rapor Bilgileri', 'Ölçüm Tarihi / Saati',
      'Ölçümün yapıldığı tarih ve saat bilgisi.',
      'Özet'],
    ['Rapor Bilgileri', 'Export Versiyonu',
      'Rapor formatının versiyon numarası. Yapısal değişikliklerde artırılır.',
      'Konfigürasyon']
  );

  // Create sheet and apply styles
  const headerRow = 3;
  const dataEnd = data.length - 1;

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 60 }, { wch: 45 }];
  styleReportTitle(ws, 0, NC);
  mergeAndStyle(ws, 1, 0, 1, NC - 1, { ...XL.label, alignment: { wrapText: true, vertical: 'center' } });
  styleColumnHeaders(ws, headerRow, 0, NC - 1);
  addTableBorders(ws, headerRow, 0, dataEnd, NC - 1);
  addZebraStripes(ws, headerRow + 1, dataEnd, NC);
  addAutoFilter(ws, headerRow, 0, dataEnd, NC - 1);
  // Metin kaydırma: tüm veri hücrelerine wrapText + üstten hizalama
  const wrap = { wrapText: true, vertical: 'top' };
  for (let r = headerRow + 1; r <= dataEnd; r++) {
    for (let c = 0; c < NC; c++) {
      const ref = _ref(r, c);
      if (ws[ref]) ws[ref].s = { ...(ws[ref].s || {}), alignment: wrap };
    }
  }
  XLSX.utils.book_append_sheet(wb, ws, 'Terimler Sözlüğü');
}

// ============ SEQUENCE MODE EXCEL ============

function buildSequenceExcel(wb, session, sTags, sSteps) {
  const nReqOpts = { confidence: session.nReqConfidence || 0.95, errorMargin: session.nReqError || 0.05 };
  const confPct = Math.round((session.nReqConfidence || 0.95) * 100);
  const errPct = Math.round((session.nReqError || 0.05) * 100);
  const stepCount = sSteps.length || 4;

  // Normalize step for legacy data without step field
  session.laps.forEach((l, i) => {
    if (l.step === undefined) {
      l.step = i % stepCount;
      l.stepName = l.stepName || sSteps[l.step]?.name || ('Adım ' + (l.step + 1));
      l.cycle = l.cycle || Math.floor(i / stepCount) + 1;
    }
  });

  const completeCycles = Math.floor(session.laps.length / stepCount);
  const times = session.laps.map(l => l.t);
  const normalTimes = session.laps.map(l => l.nt || l.t);
  const st = calcStats(times, nReqOpts);
  const stNT = calcStats(normalTimes, nReqOpts);
  // Per-step outlier detection (summary.js ile tutarlı)
  const outliers = new Set();
  const outliersNT = new Set();
  for (let si = 0; si < stepCount; si++) {
    const sIdx = [];
    const sT = [];
    const sNT = [];
    session.laps.forEach((l, i) => {
      if (l.step === si) { sIdx.push(i); sT.push(l.t); sNT.push(l.nt || l.t); }
    });
    detectOutliers(sT).forEach(oi => outliers.add(sIdx[oi]));
    detectOutliers(sNT).forEach(oi => outliersNT.add(sIdx[oi]));
  }

  // Calculate cycle times
  const cycleTimes = [];
  const cycleNormalTimes = [];
  for (let c = 0; c < completeCycles; c++) {
    let ct = 0, cnt = 0;
    for (let s = 0; s < stepCount; s++) {
      const idx = c * stepCount + s;
      if (session.laps[idx]) {
        ct += session.laps[idx].t;
        cnt += session.laps[idx].nt || session.laps[idx].t;
      }
    }
    cycleTimes.push(ct);
    cycleNormalTimes.push(cnt);
  }
  const cycleStats = calcStats(cycleTimes, nReqOpts);
  const cycleStatsNT = calcStats(cycleNormalTimes, nReqOpts);
  const cycleQ = quartiles(cycleTimes);
  const cycleQNT = quartiles(cycleNormalTimes);
  const cycleReg = linearRegression(cycleTimes);
  const cycleRegNT = linearRegression(cycleNormalTimes);
  const cycleOutliers = detectOutliers(cycleTimes);
  const cycleOutliersNT = detectOutliers(cycleNormalTimes);
  const cycleSorted = [...cycleTimes].sort((a, b) => a - b);
  const cycleSortedNT = [...cycleNormalTimes].sort((a, b) => a - b);
  const userPerc = getSetting('stats', 'percentiles');
  const trendTh = getSetting('stats', 'trendThreshold');
  const sheets = getSetting('excel', 'includeSheets') ?? {};

  // ========== SHEET 1: ÖZET ==========
  const s1Data = [
    ['ZAMAN ETÜDÜ RAPORU - ARDIŞIK İŞLEM'],
    ['Oluşturma Tarihi:', formatDate(new Date())],
    [],
    ['ÖLÇÜM BİLGİLERİ'],
    ['İş / Proses Adı', session.job || '-'],
    ['Operatör', session.op || '-'],
    ['Ölçüm Tarihi', session.date || '-'],
    ['Ölçüm Saati', session.time || '-'],
    [],
    ['ÇEVRİM BİLGİLERİ'],
    ['Toplam Kayıt', session.laps.length],
    ['Adım Sayısı', stepCount],
    ['Tam Çevrim Sayısı', completeCycles],
    ['Eksik Kayıt', session.laps.length % stepCount],
    [],
    ['TEMEL ÇEVRİM İSTATİSTİKLERİ', 'Gözlem', 'Normal', ''],
    ['Toplam', toSec(cycleStats?.sum), toSec(cycleStatsNT?.sum), 'sn'],
    ['Ortalama (x̄)', toSec(cycleStats?.mean), toSec(cycleStatsNT?.mean), 'sn'],
    ['Medyan', toSec(cycleStats?.median), toSec(cycleStatsNT?.median), 'sn'],
    ['Mod (En sık)', toSec(findMode(cycleTimes)), toSec(findMode(cycleNormalTimes)), 'sn'],
    ['Standart Sapma (σ)', toSec(cycleStats?.stdDev), toSec(cycleStatsNT?.stdDev), 'sn'],
    ['Varyans (σ²)', toSec(cycleStats?.stdDev ? cycleStats.stdDev ** 2 : 0, 6), toSec(cycleStatsNT?.stdDev ? cycleStatsNT.stdDev ** 2 : 0, 6), 'sn²'],
    ['Varyasyon Katsayısı (CV)', dp(cycleStats?.cv, 2) || 0, dp(cycleStatsNT?.cv, 2) || 0, '%'],
    ['Minimum', toSec(cycleStats?.min), toSec(cycleStatsNT?.min), 'sn'],
    ['Maksimum', toSec(cycleStats?.max), toSec(cycleStatsNT?.max), 'sn'],
    ['Aralık (Range)', toSec(cycleStats?.range), toSec(cycleStatsNT?.range), 'sn'],
    ['Standart Hata (SE)', toSec(cycleStats?.se), toSec(cycleStatsNT?.se), 'sn'],
    [],
    ['DAĞILIM BİLGİLERİ', 'Gözlem', 'Normal', ''],
    ['Q1 (25. Persentil)', toSec(cycleQ.q1), toSec(cycleQNT.q1), 'sn'],
    ['Q2 (Medyan)', toSec(cycleQ.q2), toSec(cycleQNT.q2), 'sn'],
    ['Q3 (75. Persentil)', toSec(cycleQ.q3), toSec(cycleQNT.q3), 'sn'],
    ['IQR (Çeyrekler Arası)', toSec(cycleQ.iqr), toSec(cycleQNT.iqr), 'sn'],
    ['Çarpıklık (Skewness)', cycleStats ? dp(skewness(cycleTimes, cycleStats.mean, cycleStats.stdDev), 3) : 0, cycleStatsNT ? dp(skewness(cycleNormalTimes, cycleStatsNT.mean, cycleStatsNT.stdDev), 3) : 0],
    ['Basıklık (Kurtosis)', cycleStats ? dp(kurtosis(cycleTimes, cycleStats.mean, cycleStats.stdDev), 3) : 0, cycleStatsNT ? dp(kurtosis(cycleNormalTimes, cycleStatsNT.mean, cycleStatsNT.stdDev), 3) : 0],
    ...userPerc.map(p => [`${p}. Persentil`, toSec(percentile(cycleSorted, p / 100)), toSec(percentile(cycleSortedNT, p / 100)), 'sn']),
    [],
    ['GÜVEN ARALIĞI & YETERLİLİK', 'Gözlem', 'Normal', ''],
    [`%${confPct} GA Alt Sınır`, toSec(cycleStats?.ci95Low), toSec(cycleStatsNT?.ci95Low), 'sn'],
    [`%${confPct} GA Üst Sınır`, toSec(cycleStats?.ci95High), toSec(cycleStatsNT?.ci95High), 'sn'],
    ['%99 GA Alt Sınır', toSec(cycleStats ? Math.max(0, cycleStats.mean - tCritical(cycleStats.n, 0.99) * cycleStats.se) : 0), toSec(cycleStatsNT ? Math.max(0, cycleStatsNT.mean - tCritical(cycleStatsNT.n, 0.99) * cycleStatsNT.se) : 0), 'sn'],
    ['%99 GA Üst Sınır', toSec(cycleStats ? cycleStats.mean + tCritical(cycleStats.n, 0.99) * cycleStats.se : 0), toSec(cycleStatsNT ? cycleStatsNT.mean + tCritical(cycleStatsNT.n, 0.99) * cycleStatsNT.se : 0), 'sn'],
    [`Gerekli Çevrim (±%${errPct}, %${confPct})`, cycleStats?.nReq || 0, cycleStatsNT?.nReq || 0],
    ['Yeterli Çevrim?', cycleStats && completeCycles >= cycleStats.nReq ? 'EVET' : 'HAYIR', cycleStatsNT && completeCycles >= cycleStatsNT.nReq ? 'EVET' : 'HAYIR'],
    [],
    ['TREND ANALİZİ', 'Gözlem', 'Normal', ''],
    ['Eğim (Slope)', dp(cycleReg.slope, 4), dp(cycleRegNT.slope, 4), 'ms/çevrim'],
    ['Kesişim (Intercept)', toSec(cycleReg.intercept), toSec(cycleRegNT.intercept), 'sn'],
    ['R² (Belirleyicilik)', dp(cycleReg.r2, 4), dp(cycleRegNT.r2, 4)],
    ['Trend Yönü', cycleReg.r2 < trendTh ? 'Belirsiz (R² düşük)' : cycleReg.slope > (cycleStats?.stdDev || 100) * 0.1 ? 'Artış ↑' : cycleReg.slope < -(cycleStats?.stdDev || 100) * 0.1 ? 'Azalış ↓' : 'Stabil →', cycleRegNT.r2 < trendTh ? 'Belirsiz (R² düşük)' : cycleRegNT.slope > (cycleStatsNT?.stdDev || 100) * 0.1 ? 'Artış ↑' : cycleRegNT.slope < -(cycleStatsNT?.stdDev || 100) * 0.1 ? 'Azalış ↓' : 'Stabil →'],
    [],
    ['AYKIRI DEĞERLER', 'Gözlem', 'Normal', ''],
    ['Aykırı Çevrim Sayısı (IQR)', cycleOutliers.size, cycleOutliersNT.size],
    ['Aykırı Oranı', dp((cycleOutliers.size / (cycleStats?.n || 1)) * 100, 1) + '%', dp((cycleOutliersNT.size / (cycleStatsNT?.n || 1)) * 100, 1) + '%']
  ];

  const s1 = XLSX.utils.aoa_to_sheet(s1Data);
  s1['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 8 }];
  const d = userPerc.length - 2; // row offset from dynamic percentile count
  applyStyles(s1, {
    titles: [[0, 4]],
    sections: [[3, 4], [9, 4]],
    sectionRows: [[15, 4], [28, 4], [38 + d, 4], [46 + d, 4], [52 + d, 4]],
    kv: [[1, 1, 4, false], [4, 7, 4, false], [10, 13, 4, false], [16, 26, 4, true], [29, 36 + d, 4, true], [39 + d, 44 + d, 4, true], [47 + d, 50 + d, 4, false], [53 + d, 54 + d, 4, false]],
    yesNo: [[44 + d, 1], [44 + d, 2]]
  });
  XLSX.utils.book_append_sheet(wb, s1, 'Özet');

  // ========== SHEET 2: HAM VERİ ==========
  const seqMaWindow = getSetting('stats', 'movingAvgWindow');
  const lapMA = movingAvg(times, seqMaWindow);
  const lapMANT = movingAvg(normalTimes, seqMaWindow);
  const lapReg = linearRegression(times);
  const lapRegNT = linearRegression(normalTimes);

  const s2Header = [
    'Kayıt No', 'Çevrim', 'Adım No', 'Adım Adı',
    'Süre (sn)', 'Süre (mm:ss.cc)',
    'Tempo (%)', 'Normal (sn)', 'Normal (mm:ss.cc)',
    'Kümülatif (sn)', 'Kümülatif (mm:ss.cc)',
    'Küm. Normal (sn)', 'Küm. Normal (mm:ss.cc)',
    'Anomali Kodu', 'Anomali Adı', 'Not',
    'Aykırı (Gözlem)?', 'Sapma (%)', 'Z-Skor', `Har. Ort. (${seqMaWindow})`, 'Trend Değeri',
    'Aykırı (Normal)?', 'Sapma N (%)', 'Z-Skor N', `Har. Ort. N (${seqMaWindow})`, 'Trend Değeri N'
  ];
  const s2Data = [s2Header];

  let cumSeq = 0, cumNTSeq = 0;
  session.laps.forEach((l, i) => {
    cumSeq += l.t;
    cumNTSeq += l.nt || l.t;
    const stepIdx = l.step;
    const stepName = l.stepName || sSteps[stepIdx]?.name || `Adım ${stepIdx + 1}`;
    const anomaly = l.tag !== null && sTags[l.tag] ? sTags[l.tag].name : '';
    const tempo = l.tempo || 100;
    const nt = l.nt || l.t;
    const cycle = l.cycle || Math.floor(i / stepCount) + 1;
    const devMs = l.t - (st?.mean || 0);
    const devPct = st?.mean ? (devMs / st.mean) * 100 : 0;
    const zScore = st?.stdDev ? (l.t - st.mean) / st.stdDev : 0;
    const trendVal = lapReg.intercept + lapReg.slope * i;
    const devMsNT = nt - (stNT?.mean || 0);
    const devPctNT = stNT?.mean ? (devMsNT / stNT.mean) * 100 : 0;
    const zScoreNT = stNT?.stdDev ? (nt - stNT.mean) / stNT.stdDev : 0;
    const trendValNT = lapRegNT.intercept + lapRegNT.slope * i;

    s2Data.push([
      i + 1, cycle, stepIdx + 1, stepName,
      toSec(l.t), ffull(l.t),
      tempo, toSec(nt), ffull(nt),
      toSec(cumSeq), ffull(cumSeq),
      toSec(cumNTSeq), ffull(cumNTSeq),
      l.tag !== null ? l.tag : '', anomaly, l.note || '',
      outliers.has(i) ? 'EVET' : 'HAYIR', dp(devPct, 2), dp(zScore, 3), toSec(lapMA[i]), toSec(trendVal),
      outliersNT.has(i) ? 'EVET' : 'HAYIR', dp(devPctNT, 2), dp(zScoreNT, 3), toSec(lapMANT[i]), toSec(trendValNT)
    ]);
  });

  const s2 = XLSX.utils.aoa_to_sheet(s2Data);
  s2['!cols'] = [
    { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 20 },
    { wch: 10 }, { wch: 12 },
    { wch: 8 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 14 },
    { wch: 14 }, { wch: 16 },
    { wch: 12 }, { wch: 15 }, { wch: 30 },
    { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 12 }
  ];
  const seqNC2 = 26;
  styleColumnHeaders(s2, 0, 0, seqNC2 - 1);
  addAutoFilter(s2, 0, 0, s2Data.length - 1, seqNC2 - 1);
  addTableBorders(s2, 0, 0, s2Data.length - 1, seqNC2 - 1);
  addZebraStripes(s2, 1, s2Data.length - 1, seqNC2);
  highlightOutlierRows(s2, outliers, 1, seqNC2);
  for (let i = 1; i < s2Data.length; i++) { styleYesNo(s2, i, 16); styleYesNo(s2, i, 21); }
  XLSX.utils.book_append_sheet(wb, s2, 'Ham Veri');

  // ========== SHEET 3: ÇEVRİM ANALİZİ ==========
  if (sheets.cevrimAnalizi !== false) {
  const s3Data = [
    ['ÇEVRİM ANALİZİ'],
    [],
    ['Çevrim No', 'Gözlem (sn)', 'Gözlem (mm:ss.cc)', 'Normal (sn)', 'Normal (mm:ss.cc)',
     'Sapma Göz. (sn)', 'Sapma Göz. (%)', 'Z-Skor Göz.', 'Aykırı Göz.?',
     'Sapma Nor. (sn)', 'Sapma Nor. (%)', 'Z-Skor Nor.', 'Aykırı Nor.?']
  ];

  // Add step columns dynamically
  const stepHeaders = [];
  for (let s = 0; s < stepCount; s++) {
    stepHeaders.push(sSteps[s]?.name || `Adım ${s + 1}`);
  }
  s3Data[2] = [...s3Data[2], ...stepHeaders];

  for (let c = 0; c < completeCycles; c++) {
    const ct = cycleTimes[c];
    const cnt = cycleNormalTimes[c];
    const devMs = ct - (cycleStats?.mean || 0);
    const devPct = cycleStats?.mean ? (devMs / cycleStats.mean) * 100 : 0;
    const zScore = cycleStats?.stdDev ? devMs / cycleStats.stdDev : 0;
    const devMsNT = cnt - (cycleStatsNT?.mean || 0);
    const devPctNT = cycleStatsNT?.mean ? (devMsNT / cycleStatsNT.mean) * 100 : 0;
    const zScoreNT = cycleStatsNT?.stdDev ? devMsNT / cycleStatsNT.stdDev : 0;

    const row = [
      c + 1, toSec(ct), ffull(ct), toSec(cnt), ffull(cnt),
      toSec(devMs), dp(devPct, 2), dp(zScore, 2),
      cycleOutliers.has(c) ? 'EVET' : 'HAYIR',
      toSec(devMsNT), dp(devPctNT, 2), dp(zScoreNT, 2),
      cycleOutliersNT.has(c) ? 'EVET' : 'HAYIR'
    ];

    // Add each step time
    for (let s = 0; s < stepCount; s++) {
      const idx = c * stepCount + s;
      row.push(toSec(session.laps[idx]?.t));
    }

    s3Data.push(row);
  }

  const s3 = XLSX.utils.aoa_to_sheet(s3Data);
  const s3Cols = [
    { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }
  ];
  for (let s = 0; s < stepCount; s++) s3Cols.push({ wch: 12 });
  s3['!cols'] = s3Cols;
  const s3NC = 13 + stepCount;
  styleReportTitle(s3, 0, s3NC);
  styleColumnHeaders(s3, 2, 0, s3NC - 1);
  addTableBorders(s3, 2, 0, 2 + completeCycles, s3NC - 1);
  addZebraStripes(s3, 3, 2 + completeCycles, s3NC);
  addAutoFilter(s3, 2, 0, 2 + completeCycles, s3NC - 1);
  for (let i = 3; i <= 2 + completeCycles; i++) { styleYesNo(s3, i, 8); styleYesNo(s3, i, 12); }
  highlightOutlierRows(s3, cycleOutliers, 3, s3NC);
  XLSX.utils.book_append_sheet(wb, s3, 'Çevrim Analizi');
  }

  // ========== SHEET 4: ADIM ANALİZİ ==========
  if (sheets.adimAnalizi !== false) {
  const stepAnalysisHeader = ['Adım', 'Adet', 'Toplam (sn)', 'Ortalama (sn)',
     'Medyan (sn)', 'Min (sn)', 'Max (sn)', 'Aralık (sn)',
     'Std Sapma (sn)', 'CV (%)', 'Q1 (sn)', 'Q3 (sn)', 'IQR (sn)',
     '%95 GA Alt', '%95 GA Üst', 'Oran (%)', 'Trend Eğimi'];
  const s4Data = [
    ['ADIM ANALİZİ (Gözlem Süreleri)'],
    [],
    stepAnalysisHeader
  ];

  for (let i = 0; i < stepCount; i++) {
    const stepLaps = session.laps.filter(l => l.step === i);
    const stepTimes = stepLaps.map(l => l.t);
    const stats = calcStats(stepTimes, nReqOpts);
    const stepQ = quartiles(stepTimes);
    const stepReg = linearRegression(stepTimes);
    const stepName = sSteps[i]?.name || `Adım ${i + 1}`;
    const ratio = cycleStats?.mean ? ((stats?.mean || 0) / cycleStats.mean) * 100 : 0;

    if (stats) {
      s4Data.push([
        stepName, stats.n, toSec(stats.sum), toSec(stats.mean),
        toSec(stats.median), toSec(stats.min), toSec(stats.max), toSec(stats.range),
        toSec(stats.stdDev), dp(stats.cv, 2), toSec(stepQ.q1), toSec(stepQ.q3), toSec(stepQ.iqr),
        toSec(stats.ci95Low), toSec(stats.ci95High),
        dp(ratio, 1), dp(stepReg.slope, 4)
      ]);
    }
  }

  s4Data.push([]);
  s4Data.push(['TOPLAM', st?.n || 0, toSec(st?.sum), '', '', '', '', '', '', '', '', '', '', '', '', '100%', '']);

  // Normal süreler adım analizi
  s4Data.push([], ['ADIM ANALİZİ (Normal Süreler)'], [], stepAnalysisHeader);

  for (let i = 0; i < stepCount; i++) {
    const stepLaps = session.laps.filter(l => l.step === i);
    const stepNT = stepLaps.map(l => l.nt || l.t);
    const ntStats = calcStats(stepNT, nReqOpts);
    const stepNTQ = quartiles(stepNT);
    const stepNTReg = linearRegression(stepNT);
    const stepName = sSteps[i]?.name || `Adım ${i + 1}`;
    const ratioNT = cycleStatsNT?.mean ? ((ntStats?.mean || 0) / cycleStatsNT.mean) * 100 : 0;

    if (ntStats) {
      s4Data.push([
        stepName, ntStats.n, toSec(ntStats.sum), toSec(ntStats.mean),
        toSec(ntStats.median), toSec(ntStats.min), toSec(ntStats.max), toSec(ntStats.range),
        toSec(ntStats.stdDev), dp(ntStats.cv, 2), toSec(stepNTQ.q1), toSec(stepNTQ.q3), toSec(stepNTQ.iqr),
        toSec(ntStats.ci95Low), toSec(ntStats.ci95High),
        dp(ratioNT, 1), dp(stepNTReg.slope, 4)
      ]);
    }
  }

  s4Data.push([]);
  s4Data.push(['TOPLAM', stNT?.n || 0, toSec(stNT?.sum), '', '', '', '', '', '', '', '', '', '', '', '', '100%', '']);

  const s4 = XLSX.utils.aoa_to_sheet(s4Data);
  s4['!cols'] = Array(17).fill({ wch: 12 });
  s4['!cols'][0] = { wch: 18 };
  const s4NC = 17;
  // Section 1: Gözlem
  styleReportTitle(s4, 0, s4NC);
  styleColumnHeaders(s4, 2, 0, s4NC - 1);
  addTableBorders(s4, 2, 0, 2 + stepCount, s4NC - 1);
  addZebraStripes(s4, 3, 2 + stepCount, s4NC);
  styleTotalRow(s4, 4 + stepCount, s4NC);
  // Section 2: Normal
  const s4nt = 6 + stepCount;
  styleReportTitle(s4, s4nt, s4NC);
  styleColumnHeaders(s4, s4nt + 2, 0, s4NC - 1);
  addTableBorders(s4, s4nt + 2, 0, s4nt + 2 + stepCount, s4NC - 1);
  addZebraStripes(s4, s4nt + 3, s4nt + 2 + stepCount, s4NC);
  styleTotalRow(s4, s4nt + 4 + stepCount, s4NC);
  XLSX.utils.book_append_sheet(wb, s4, 'Adım Analizi');
  }

  // ========== SHEET 5: ADIM KARŞILAŞTIRMA ==========
  if (sheets.adimKarsilastirma !== false) {
  const compHeader = ['Çevrim \\ Adım'];
  for (let s = 0; s < stepCount; s++) {
    compHeader.push(sSteps[s]?.name || `Adım ${s + 1}`);
  }
  compHeader.push('Çevrim Toplamı');

  const s5Data = [
    ['ADIM KARŞILAŞTIRMA MATRİSİ (Gözlem Süreleri)'],
    [],
    [...compHeader]
  ];

  // Observed data rows
  for (let c = 0; c < completeCycles; c++) {
    const row = [`Çevrim ${c + 1}`];
    for (let s = 0; s < stepCount; s++) {
      const idx = c * stepCount + s;
      row.push(toSec(session.laps[idx]?.t));
    }
    row.push(toSec(cycleTimes[c]));
    s5Data.push(row);
  }

  // Observed summary rows
  s5Data.push([]);
  const avgRow = ['Ortalama'];
  const medRow = ['Medyan'];
  const minRow = ['Minimum'];
  const maxRow = ['Maximum'];
  const stdRow = ['Std Sapma'];

  for (let s = 0; s < stepCount; s++) {
    const stepTimes = session.laps.filter(l => l.step === s).map(l => l.t);
    const stepStats = calcStats(stepTimes, nReqOpts);
    avgRow.push(toSec(stepStats?.mean));
    medRow.push(toSec(stepStats?.median));
    minRow.push(toSec(stepStats?.min));
    maxRow.push(toSec(stepStats?.max));
    stdRow.push(toSec(stepStats?.stdDev));
  }
  avgRow.push(toSec(cycleStats?.mean));
  medRow.push(toSec(cycleStats?.median));
  minRow.push(toSec(cycleStats?.min));
  maxRow.push(toSec(cycleStats?.max));
  stdRow.push(toSec(cycleStats?.stdDev));

  s5Data.push(avgRow, medRow, minRow, maxRow, stdRow);

  // Normal süreler karşılaştırma
  s5Data.push([], ['ADIM KARŞILAŞTIRMA MATRİSİ (Normal Süreler)'], [], [...compHeader]);

  for (let c = 0; c < completeCycles; c++) {
    const row = [`Çevrim ${c + 1}`];
    for (let s = 0; s < stepCount; s++) {
      const idx = c * stepCount + s;
      const lap = session.laps[idx];
      row.push(toSec(lap ? (lap.nt || lap.t) : undefined));
    }
    row.push(toSec(cycleNormalTimes[c]));
    s5Data.push(row);
  }

  s5Data.push([]);
  const avgRowNT = ['Ortalama'];
  const medRowNT = ['Medyan'];
  const minRowNT = ['Minimum'];
  const maxRowNT = ['Maximum'];
  const stdRowNT = ['Std Sapma'];

  for (let s = 0; s < stepCount; s++) {
    const stepNT = session.laps.filter(l => l.step === s).map(l => l.nt || l.t);
    const stepNTStats = calcStats(stepNT, nReqOpts);
    avgRowNT.push(toSec(stepNTStats?.mean));
    medRowNT.push(toSec(stepNTStats?.median));
    minRowNT.push(toSec(stepNTStats?.min));
    maxRowNT.push(toSec(stepNTStats?.max));
    stdRowNT.push(toSec(stepNTStats?.stdDev));
  }
  avgRowNT.push(toSec(cycleStatsNT?.mean));
  medRowNT.push(toSec(cycleStatsNT?.median));
  minRowNT.push(toSec(cycleStatsNT?.min));
  maxRowNT.push(toSec(cycleStatsNT?.max));
  stdRowNT.push(toSec(cycleStatsNT?.stdDev));

  s5Data.push(avgRowNT, medRowNT, minRowNT, maxRowNT, stdRowNT);

  const s5 = XLSX.utils.aoa_to_sheet(s5Data);
  const s5Cols = [{ wch: 15 }];
  for (let s = 0; s <= stepCount; s++) s5Cols.push({ wch: 14 });
  s5['!cols'] = s5Cols;
  const s5NC = stepCount + 2;
  // Section 1: Gözlem
  styleReportTitle(s5, 0, s5NC);
  styleColumnHeaders(s5, 2, 0, s5NC - 1);
  addTableBorders(s5, 2, 0, 2 + completeCycles, s5NC - 1);
  addZebraStripes(s5, 3, 2 + completeCycles, s5NC);
  const s5sum = 4 + completeCycles;
  for (let sr = s5sum; sr < s5sum + 5; sr++) styleTotalRow(s5, sr, s5NC);
  // Section 2: Normal
  const s5nt = s5sum + 7;
  styleReportTitle(s5, s5nt, s5NC);
  styleColumnHeaders(s5, s5nt + 2, 0, s5NC - 1);
  addTableBorders(s5, s5nt + 2, 0, s5nt + 2 + completeCycles, s5NC - 1);
  addZebraStripes(s5, s5nt + 3, s5nt + 2 + completeCycles, s5NC);
  const s5sumNT = s5nt + 4 + completeCycles;
  for (let sr = s5sumNT; sr < s5sumNT + 5; sr++) styleTotalRow(s5, sr, s5NC);
  XLSX.utils.book_append_sheet(wb, s5, 'Adım Karşılaştırma');
  }

  // ========== SHEET 6: ANOMALİ ANALİZİ ==========
  if (sheets.anomaliAnalizi !== false) {
  const anomalyLaps = session.laps.filter(l => l.tag !== null && l.tag !== undefined);
  const anomalyHeader = ['Anomali Türü', 'Adet', 'Oran (%)', 'Toplam (sn)', 'Ortalama (sn)', 'Medyan (sn)',
    'Min (sn)', 'Max (sn)', 'Aralık (sn)', 'Std Sapma (sn)', 'CV (%)',
    'Q1 (sn)', 'Q3 (sn)', 'IQR (sn)', '%95 GA Alt', '%95 GA Üst'];
  const s6Data = [
    ['ANOMALİ ANALİZİ (Gözlem Süreleri)'],
    [],
    ['ÖZET'],
    anomalyHeader
  ];

  sTags.forEach((t, i) => {
    const tagLaps = anomalyLaps.filter(l => l.tag === i);
    const tagTimes = tagLaps.map(l => l.t);
    const tagStats = calcStats(tagTimes, nReqOpts);
    const tagQ = quartiles(tagTimes);
    if (tagLaps.length > 0) {
      s6Data.push([
        t.name, tagLaps.length,
        dp((tagLaps.length / session.laps.length) * 100, 1),
        toSec(tagStats?.sum), toSec(tagStats?.mean), toSec(tagStats?.median),
        toSec(tagStats?.min), toSec(tagStats?.max), toSec(tagStats?.range),
        toSec(tagStats?.stdDev), (dp(tagStats?.cv, 2) || 0),
        toSec(tagQ.q1), toSec(tagQ.q3), toSec(tagQ.iqr),
        toSec(tagStats?.ci95Low), toSec(tagStats?.ci95High)
      ]);
    }
  });

  // Normal süreler anomali analizi
  const seq6NTRow = s6Data.length + 1;
  s6Data.push([], ['ANOMALİ ANALİZİ (Normal Süreler)'], [], ['ÖZET'], anomalyHeader);

  sTags.forEach((t, i) => {
    const tagLaps = anomalyLaps.filter(l => l.tag === i);
    const tagNTimes = tagLaps.map(l => l.nt || l.t);
    const tagNTStats = calcStats(tagNTimes, nReqOpts);
    const tagNTQ = quartiles(tagNTimes);
    if (tagLaps.length > 0) {
      s6Data.push([
        t.name, tagLaps.length,
        dp((tagLaps.length / session.laps.length) * 100, 1),
        toSec(tagNTStats?.sum), toSec(tagNTStats?.mean), toSec(tagNTStats?.median),
        toSec(tagNTStats?.min), toSec(tagNTStats?.max), toSec(tagNTStats?.range),
        toSec(tagNTStats?.stdDev), (dp(tagNTStats?.cv, 2) || 0),
        toSec(tagNTQ.q1), toSec(tagNTQ.q3), toSec(tagNTQ.iqr),
        toSec(tagNTStats?.ci95Low), toSec(tagNTStats?.ci95High)
      ]);
    }
  });

  s6Data.push([], ['ANOMALİ DETAYI'], []);
  s6Data.push(['Kayıt No', 'Çevrim', 'Adım', 'Anomali', 'Süre (sn)', 'Normal (sn)', 'Not']);

  session.laps.forEach((l, i) => {
    if (l.tag !== null && l.tag !== undefined && sTags[l.tag]) {
      const stepName = l.stepName || sSteps[l.step]?.name || `Adım ${l.step + 1}`;
      s6Data.push([
        i + 1, l.cycle || Math.floor(i / stepCount) + 1, stepName,
        sTags[l.tag].name, toSec(l.t), toSec(l.nt || l.t), l.note || ''
      ]);
    }
  });

  const s6 = XLSX.utils.aoa_to_sheet(s6Data);
  s6['!cols'] = Array(16).fill({ wch: 12 });
  s6['!cols'][0] = { wch: 15 };
  // Style anomali - titles and key sections
  styleReportTitle(s6, 0, 16);
  styleSubSectionHeader(s6, 2, 16);
  styleColumnHeaders(s6, 3, 0, 15);
  // Normal section styling (mirror of Gözlem)
  styleReportTitle(s6, seq6NTRow, 16);
  styleSubSectionHeader(s6, seq6NTRow + 2, 16);
  styleColumnHeaders(s6, seq6NTRow + 3, 0, 15);
  XLSX.utils.book_append_sheet(wb, s6, 'Anomali Analizi');
  }

  // ========== SHEET 7: ÇEVRİM TREND ==========
  if (sheets.cevrimTrend !== false) {
  const cycleMaWin = Math.min(3, getSetting('stats', 'movingAvgWindow'));
  const cycleMa = movingAvg(cycleTimes, cycleMaWin);
  const cycleMaNT = movingAvg(cycleNormalTimes, cycleMaWin);
  const s7Data = [
    ['ÇEVRİM TREND ANALİZİ'],
    [],
    ['REGRESYON', 'Gözlem', 'Normal'],
    ['Eğim (ms/çevrim)', dp(cycleReg.slope, 4), dp(cycleRegNT.slope, 4)],
    ['Kesişim (sn)', toSec(cycleReg.intercept), toSec(cycleRegNT.intercept)],
    ['R²', dp(cycleReg.r2, 4), dp(cycleRegNT.r2, 4)],
    ['Trend Yönü', cycleReg.r2 < trendTh ? 'Belirsiz' : cycleReg.slope > (cycleStats?.stdDev || 100) * 0.1 ? 'Artış (yavaşlama)' : cycleReg.slope < -(cycleStats?.stdDev || 100) * 0.1 ? 'Azalış (hızlanma)' : 'Stabil',
      cycleRegNT.r2 < trendTh ? 'Belirsiz' : cycleRegNT.slope > (cycleStatsNT?.stdDev || 100) * 0.1 ? 'Artış (yavaşlama)' : cycleRegNT.slope < -(cycleStatsNT?.stdDev || 100) * 0.1 ? 'Azalış (hızlanma)' : 'Stabil'],
    [],
    ['ÇEVRİM BAZLI VERİ'],
    ['Çevrim', 'Gözlem (sn)', 'Normal (sn)', `Har. Ort. Göz. (${cycleMaWin})`, `Har. Ort. Nor. (${cycleMaWin})`,
     'Trend Göz.', 'Göz. - Trend', 'Trend Nor.', 'Nor. - Trend']
  ];

  for (let c = 0; c < completeCycles; c++) {
    const trendVal = cycleReg.intercept + cycleReg.slope * c;
    const trendValNT = cycleRegNT.intercept + cycleRegNT.slope * c;
    s7Data.push([
      c + 1, toSec(cycleTimes[c]), toSec(cycleNormalTimes[c]),
      toSec(cycleMa[c]), toSec(cycleMaNT[c]),
      toSec(trendVal), toSec(cycleTimes[c] - trendVal),
      toSec(trendValNT), toSec(cycleNormalTimes[c] - trendValNT)
    ]);
  }

  const s7 = XLSX.utils.aoa_to_sheet(s7Data);
  s7['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  styleReportTitle(s7, 0, 9);
  styleSubSectionHeader(s7, 2, 9);
  styleKVRows(s7, 3, 6, 3, false);
  styleSubSectionHeader(s7, 8, 9);
  styleColumnHeaders(s7, 9, 0, 8);
  addTableBorders(s7, 9, 0, 9 + completeCycles, 8);
  addZebraStripes(s7, 10, 9 + completeCycles, 9);
  addAutoFilter(s7, 9, 0, 9 + completeCycles, 8);
  XLSX.utils.book_append_sheet(wb, s7, 'Çevrim Trend');
  }

  // ========== SHEET 8: DAĞILIM ANALİZİ ==========
  if (sheets.dagilimAnalizi !== false) {
  const cycleBins = freqDist(cycleTimes);
  const cycleFreqHeader = ['Aralık Başı (sn)', 'Aralık Sonu (sn)', 'Frekans', 'Oran (%)', 'Küm. Frekans', 'Küm. (%)'];
  const dData = [
    ['DAĞILIM ANALİZİ - ÇEVRİM SÜRELERİ'],
    [],
    ['FREKANS DAĞILIMI - Gözlem Süreleri'],
    cycleFreqHeader
  ];

  let dCumFreq = 0;
  cycleBins.forEach(b => {
    dCumFreq += b.count;
    dData.push([
      toSec(b.binStart), toSec(b.binEnd), b.count,
      dp(b.freq, 2), dCumFreq,
      dp((dCumFreq / (cycleStats?.n || 1)) * 100, 2)
    ]);
  });

  // Normal çevrim süreleri frekans dağılımı
  const cycleBinsNT = freqDist(cycleNormalTimes);
  dData.push([], ['FREKANS DAĞILIMI - Normal Süreler'], [], cycleFreqHeader);

  let dCumFreqNT = 0;
  cycleBinsNT.forEach(b => {
    dCumFreqNT += b.count;
    dData.push([
      toSec(b.binStart), toSec(b.binEnd), b.count,
      dp(b.freq, 2), dCumFreqNT,
      dp((dCumFreqNT / (cycleStatsNT?.n || 1)) * 100, 2)
    ]);
  });

  dData.push([], ['PERSENTİL TABLOSU (Çevrim)'], []);
  dData.push(['Persentil', 'Gözlemlenen (sn)', 'Normal (sn)']);
  userPerc.forEach(p => {
    dData.push([
      p + '%',
      toSec(percentile(cycleSorted, p / 100)),
      toSec(percentile(cycleSortedNT, p / 100))
    ]);
  });

  dData.push([], ['BOX PLOT VERİLERİ (Çevrim)'], []);
  dData.push(['Metrik', 'Gözlem (sn)', 'Normal (sn)']);
  dData.push(['Minimum', toSec(cycleStats?.min), toSec(cycleStatsNT?.min)]);
  dData.push(['Q1', toSec(cycleQ.q1), toSec(cycleQNT.q1)]);
  dData.push(['Medyan (Q2)', toSec(cycleQ.q2), toSec(cycleQNT.q2)]);
  dData.push(['Q3', toSec(cycleQ.q3), toSec(cycleQNT.q3)]);
  dData.push(['Maksimum', toSec(cycleStats?.max), toSec(cycleStatsNT?.max)]);
  dData.push(['IQR', toSec(cycleQ.iqr), toSec(cycleQNT.iqr)]);
  const seqIqrK = getSetting('stats', 'iqrMultiplier');
  dData.push([`Alt Sınır (Q1-${seqIqrK}*IQR)`, toSec(cycleQ.q1 - seqIqrK * cycleQ.iqr), toSec(cycleQNT.q1 - seqIqrK * cycleQNT.iqr)]);
  dData.push([`Üst Sınır (Q3+${seqIqrK}*IQR)`, toSec(cycleQ.q3 + seqIqrK * cycleQ.iqr), toSec(cycleQNT.q3 + seqIqrK * cycleQNT.iqr)]);

  // Per-step distribution summary
  const stepDistHeader = ['Adım', 'n', 'Q1 (sn)', 'Medyan (sn)', 'Q3 (sn)', 'IQR (sn)', 'Çarpıklık', 'Basıklık'];
  dData.push([], ['ADIM BAZLI DAĞILIM ÖZETİ (Gözlem)'], [], stepDistHeader);
  for (let si = 0; si < stepCount; si++) {
    const stepLaps = session.laps.filter(l => l.step === si);
    const stepTimes = stepLaps.map(l => l.t);
    const stepQ = quartiles(stepTimes);
    const stepSt = calcStats(stepTimes, nReqOpts);
    const stepName = sSteps[si]?.name || `Adım ${si + 1}`;
    dData.push([
      stepName, stepTimes.length,
      toSec(stepQ.q1), toSec(stepQ.q2), toSec(stepQ.q3), toSec(stepQ.iqr),
      stepSt ? dp(skewness(stepTimes, stepSt.mean, stepSt.stdDev), 3) : '—',
      stepSt ? dp(kurtosis(stepTimes, stepSt.mean, stepSt.stdDev), 3) : '—'
    ]);
  }

  // Normal süreler adım dağılım özeti
  dData.push([], ['ADIM BAZLI DAĞILIM ÖZETİ (Normal)'], [], stepDistHeader);
  for (let si = 0; si < stepCount; si++) {
    const stepLaps = session.laps.filter(l => l.step === si);
    const stepNTimes = stepLaps.map(l => l.nt || l.t);
    const stepNTQ = quartiles(stepNTimes);
    const stepNTSt = calcStats(stepNTimes, nReqOpts);
    const stepName = sSteps[si]?.name || `Adım ${si + 1}`;
    dData.push([
      stepName, stepNTimes.length,
      toSec(stepNTQ.q1), toSec(stepNTQ.q2), toSec(stepNTQ.q3), toSec(stepNTQ.iqr),
      stepNTSt ? dp(skewness(stepNTimes, stepNTSt.mean, stepNTSt.stdDev), 3) : '—',
      stepNTSt ? dp(kurtosis(stepNTimes, stepNTSt.mean, stepNTSt.stdDev), 3) : '—'
    ]);
  }

  const dSheet = XLSX.utils.aoa_to_sheet(dData);
  dSheet['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
  const cbLen = cycleBins.length, cbLenNT = cycleBinsNT.length, cbOff = cbLen + cbLenNT;
  styleReportTitle(dSheet, 0, 8);
  styleSectionHeader(dSheet, 2, 6);
  styleColumnHeaders(dSheet, 3, 0, 5);
  addTableBorders(dSheet, 3, 0, 3 + cbLen, 5); addZebraStripes(dSheet, 4, 3 + cbLen, 6);
  const dnt = 5 + cbLen;
  styleSectionHeader(dSheet, dnt, 6);
  styleColumnHeaders(dSheet, dnt + 2, 0, 5);
  addTableBorders(dSheet, dnt + 2, 0, dnt + 2 + cbLenNT, 5); addZebraStripes(dSheet, dnt + 3, dnt + 2 + cbLenNT, 6);
  const seqPLen = userPerc.length;
  const dpt = dnt + 4 + cbLenNT;
  styleSubSectionHeader(dSheet, dpt, 8);
  styleColumnHeaders(dSheet, dpt + 2, 0, 2);
  addTableBorders(dSheet, dpt + 2, 0, dpt + 2 + seqPLen, 2);
  const dbp = dpt + 4 + seqPLen;
  styleSubSectionHeader(dSheet, dbp, 8);
  styleColumnHeaders(dSheet, dbp + 2, 0, 2);
  addTableBorders(dSheet, dbp + 2, 0, dbp + 10, 2);
  // Step distribution sections
  const dsd = dbp + 12;
  styleSectionHeader(dSheet, dsd, 8);
  styleColumnHeaders(dSheet, dsd + 2, 0, 7);
  addTableBorders(dSheet, dsd + 2, 0, dsd + 2 + stepCount, 7);
  const dsdNT = dsd + 4 + stepCount;
  styleSectionHeader(dSheet, dsdNT, 8);
  styleColumnHeaders(dSheet, dsdNT + 2, 0, 7);
  addTableBorders(dSheet, dsdNT + 2, 0, dsdNT + 2 + stepCount, 7);
  XLSX.utils.book_append_sheet(wb, dSheet, 'Dağılım Analizi');
  }

  // ========== SHEET 9: AYKIRI DEĞER ANALİZİ ==========
  if (sheets.aykiriDegerler !== false) {
  const cycleOutlierHeader = ['Çevrim No', 'Süre (sn)', 'Süre (mm:ss.cc)', 'Sapma Yönü', 'Z-Skor'];
  const oData = [
    ['AYKIRI DEĞER ANALİZİ - Gözlem Süreleri'],
    [],
    ['ÇEVRİM BAZLI (IQR Yöntemi)'],
    [`Alt Sınır (Q1 - ${seqIqrK}*IQR)`, toSec(cycleQ.q1 - seqIqrK * cycleQ.iqr), 'sn'],
    [`Üst Sınır (Q3 + ${seqIqrK}*IQR)`, toSec(cycleQ.q3 + seqIqrK * cycleQ.iqr), 'sn'],
    [],
    ['Aykırı Çevrim Sayısı', cycleOutliers.size],
    ['Aykırı Oranı', dp((cycleOutliers.size / (cycleStats?.n || 1)) * 100, 1) + '%'],
    [],
    ['AYKIRI ÇEVRİMLER'],
    cycleOutlierHeader
  ];

  for (let c = 0; c < completeCycles; c++) {
    if (cycleOutliers.has(c)) {
      const ct = cycleTimes[c];
      const zScore = cycleStats?.stdDev ? (ct - cycleStats.mean) / cycleStats.stdDev : 0;
      const dir = ct < cycleQ.q1 - seqIqrK * cycleQ.iqr ? 'Düşük ↓' : 'Yüksek ↑';
      oData.push([c + 1, toSec(ct), ffull(ct), dir, dp(zScore, 2)]);
    }
  }
  if (cycleOutliers.size === 0) oData.push(['Aykırı çevrim bulunamadı']);

  // Clean stats without outliers
  const cleanCycleTimes = cycleTimes.filter((_, i) => !cycleOutliers.has(i));
  if (cleanCycleTimes.length > 0 && cycleOutliers.size > 0) {
    const cleanCycleStats = calcStats(cleanCycleTimes, nReqOpts);
    oData.push([], ['AYKIRI DEĞERLER HARİÇ ÇEVRİM İSTATİSTİKLERİ']);
    oData.push(['Çevrim Sayısı', cleanCycleStats?.n || 0]);
    oData.push(['Ortalama', toSec(cleanCycleStats?.mean), 'sn']);
    oData.push(['Medyan', toSec(cleanCycleStats?.median), 'sn']);
    oData.push(['Std Sapma', toSec(cleanCycleStats?.stdDev), 'sn']);
    oData.push(['CV%', dp(cleanCycleStats?.cv, 2) || 0]);
    oData.push(['Min', toSec(cleanCycleStats?.min), 'sn']);
    oData.push(['Max', toSec(cleanCycleStats?.max), 'sn']);
  }

  // Normal süreler aykırı değer analizi
  const seqONTRow = oData.length + 1;
  oData.push([], ['AYKIRI DEĞER ANALİZİ - Normal Süreler'], []);
  oData.push(['ÇEVRİM BAZLI (IQR Yöntemi)']);
  oData.push([`Alt Sınır (Q1 - ${seqIqrK}*IQR)`, toSec(cycleQNT.q1 - seqIqrK * cycleQNT.iqr), 'sn']);
  oData.push([`Üst Sınır (Q3 + ${seqIqrK}*IQR)`, toSec(cycleQNT.q3 + seqIqrK * cycleQNT.iqr), 'sn']);
  oData.push([]);
  oData.push(['Aykırı Çevrim Sayısı', cycleOutliersNT.size]);
  oData.push(['Aykırı Oranı', dp((cycleOutliersNT.size / (cycleStatsNT?.n || 1)) * 100, 1) + '%']);
  oData.push([]);
  oData.push(['AYKIRI ÇEVRİMLER']);
  oData.push(cycleOutlierHeader);

  for (let c = 0; c < completeCycles; c++) {
    if (cycleOutliersNT.has(c)) {
      const cnt = cycleNormalTimes[c];
      const zScore = cycleStatsNT?.stdDev ? (cnt - cycleStatsNT.mean) / cycleStatsNT.stdDev : 0;
      const dir = cnt < cycleQNT.q1 - seqIqrK * cycleQNT.iqr ? 'Düşük ↓' : 'Yüksek ↑';
      oData.push([c + 1, toSec(cnt), ffull(cnt), dir, dp(zScore, 2)]);
    }
  }
  if (cycleOutliersNT.size === 0) oData.push(['Aykırı çevrim bulunamadı']);

  const cleanCycleNTimes = cycleNormalTimes.filter((_, i) => !cycleOutliersNT.has(i));
  if (cleanCycleNTimes.length > 0 && cycleOutliersNT.size > 0) {
    const cleanCycleNTStats = calcStats(cleanCycleNTimes, nReqOpts);
    oData.push([], ['AYKIRI DEĞERLER HARİÇ ÇEVRİM İSTATİSTİKLERİ']);
    oData.push(['Çevrim Sayısı', cleanCycleNTStats?.n || 0]);
    oData.push(['Ortalama', toSec(cleanCycleNTStats?.mean), 'sn']);
    oData.push(['Medyan', toSec(cleanCycleNTStats?.median), 'sn']);
    oData.push(['Std Sapma', toSec(cleanCycleNTStats?.stdDev), 'sn']);
    oData.push(['CV%', dp(cleanCycleNTStats?.cv, 2) || 0]);
    oData.push(['Min', toSec(cleanCycleNTStats?.min), 'sn']);
    oData.push(['Max', toSec(cleanCycleNTStats?.max), 'sn']);
  }

  // Per-step outlier summary (Gözlem + Normal)
  oData.push([], ['ADIM BAZLI AYKIRI DEĞER ÖZETİ'], []);
  oData.push(['Adım', 'Toplam', 'Aykırı (Göz.)', 'Oran Göz. (%)', 'Aykırı (Nor.)', 'Oran Nor. (%)']);
  for (let si = 0; si < stepCount; si++) {
    const stepLaps = session.laps.filter(l => l.step === si);
    const stepTimes = stepLaps.map(l => l.t);
    const stepNTimes = stepLaps.map(l => l.nt || l.t);
    const stepOutliers = detectOutliers(stepTimes);
    const stepOutliersNT = detectOutliers(stepNTimes);
    const stepName = sSteps[si]?.name || `Adım ${si + 1}`;
    oData.push([
      stepName, stepTimes.length,
      stepOutliers.size,
      stepTimes.length ? dp((stepOutliers.size / stepTimes.length) * 100, 1) + '%' : '—',
      stepOutliersNT.size,
      stepNTimes.length ? dp((stepOutliersNT.size / stepNTimes.length) * 100, 1) + '%' : '—'
    ]);
  }

  const oSheet = XLSX.utils.aoa_to_sheet(oData);
  oSheet['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  styleReportTitle(oSheet, 0, 6);
  styleSubSectionHeader(oSheet, 2, 6);
  styleKVRows(oSheet, 3, 4, 3, true);
  styleKVRows(oSheet, 6, 7, 3, false);
  styleSubSectionHeader(oSheet, 9, 6);
  styleColumnHeaders(oSheet, 10, 0, 4);
  // Style "AYKIRI DEĞERLER HARİÇ" Gözlem section (only when outliers exist)
  const seqOListEnd = 10 + cycleOutliers.size + (cycleOutliers.size === 0 ? 1 : 0);
  if (cycleOutliers.size > 0 && cleanCycleTimes.length > 0) {
    styleSubSectionHeader(oSheet, seqOListEnd + 2, 6);
    styleKVRows(oSheet, seqOListEnd + 3, seqOListEnd + 9, 3, true);
  }
  // Normal section styling (mirror of Gözlem)
  styleReportTitle(oSheet, seqONTRow, 6);
  styleSubSectionHeader(oSheet, seqONTRow + 2, 6);
  styleKVRows(oSheet, seqONTRow + 3, seqONTRow + 4, 3, true);
  styleKVRows(oSheet, seqONTRow + 6, seqONTRow + 7, 3, false);
  styleSubSectionHeader(oSheet, seqONTRow + 9, 6);
  styleColumnHeaders(oSheet, seqONTRow + 10, 0, 4);
  // Style "AYKIRI DEĞERLER HARİÇ" Normal section (only when outliers exist)
  const seqONTListEnd = seqONTRow + 10 + cycleOutliersNT.size + (cycleOutliersNT.size === 0 ? 1 : 0);
  if (cycleOutliersNT.size > 0 && cleanCycleNTimes.length > 0) {
    styleSubSectionHeader(oSheet, seqONTListEnd + 2, 6);
    styleKVRows(oSheet, seqONTListEnd + 3, seqONTListEnd + 9, 3, true);
  }
  XLSX.utils.book_append_sheet(wb, oSheet, 'Aykırı Değerler');
  }

  // ========== SHEET 10: TEMPO ANALİZİ ==========
  if (sheets.tempoAnalizi !== false) {
  const tempoGroups = {};
  const tempoGroupsNT = {};
  session.laps.forEach(l => {
    const t = l.tempo || 100;
    if (!tempoGroups[t]) { tempoGroups[t] = []; tempoGroupsNT[t] = []; }
    tempoGroups[t].push(l.t);
    tempoGroupsNT[t].push(l.nt || l.t);
  });

  const tempoHeader = ['Tempo (%)', 'Adet', 'Oran (%)', 'Toplam (sn)', 'Ortalama (sn)', 'Min (sn)', 'Max (sn)', 'Std Sapma (sn)', 'CV (%)'];
  const tempoKeys = Object.keys(tempoGroups).sort((a, b) => +b - +a);
  const tpData = [
    ['TEMPO ANALİZİ (Gözlem Süreleri)'],
    [],
    tempoHeader
  ];

  tempoKeys.forEach(tempo => {
    const tTimes = tempoGroups[tempo];
    const tStats = calcStats(tTimes, nReqOpts);
    tpData.push([
      +tempo, tStats?.n || 0,
      dp((tStats?.n / (st?.n || 1)) * 100, 1),
      toSec(tStats?.sum), toSec(tStats?.mean), toSec(tStats?.min),
      toSec(tStats?.max), toSec(tStats?.stdDev), (dp(tStats?.cv, 2) || 0)
    ]);
  });

  // Normal süreler tempo analizi
  tpData.push([], ['TEMPO ANALİZİ (Normal Süreler)'], [], tempoHeader);

  tempoKeys.forEach(tempo => {
    const tNTimes = tempoGroupsNT[tempo];
    const tNTStats = calcStats(tNTimes, nReqOpts);
    tpData.push([
      +tempo, tNTStats?.n || 0,
      dp((tNTStats?.n / (stNT?.n || 1)) * 100, 1),
      toSec(tNTStats?.sum), toSec(tNTStats?.mean), toSec(tNTStats?.min),
      toSec(tNTStats?.max), toSec(tNTStats?.stdDev), (dp(tNTStats?.cv, 2) || 0)
    ]);
  });

  tpData.push([], ['TEMPO DAĞILIMI (Kayıt Bazlı)'], []);
  tpData.push(['Kayıt', 'Çevrim', 'Adım', 'Tempo (%)', 'Süre (sn)', 'Normal Süre (sn)', 'Etki (%)']);
  session.laps.forEach((l, i) => {
    const tempo = l.tempo || 100;
    const nt = l.nt || l.t;
    const effect = tempo !== 100 && l.t > 0 ? ((l.t - nt) / l.t) * 100 : 0;
    const stepName = l.stepName || sSteps[l.step]?.name || `Adım ${l.step + 1}`;
    const cycle = l.cycle || Math.floor(i / stepCount) + 1;
    tpData.push([i + 1, cycle, stepName, tempo, toSec(l.t), toSec(nt), dp(effect, 2)]);
  });

  const tpSheet = XLSX.utils.aoa_to_sheet(tpData);
  tpSheet['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
  const tpNC = 9, tpKeys = tempoKeys.length;
  styleReportTitle(tpSheet, 0, tpNC);
  styleColumnHeaders(tpSheet, 2, 0, tpNC - 1);
  addTableBorders(tpSheet, 2, 0, 2 + tpKeys, tpNC - 1); addZebraStripes(tpSheet, 3, 2 + tpKeys, tpNC);
  const tpNT = 4 + tpKeys;
  styleReportTitle(tpSheet, tpNT, tpNC);
  styleColumnHeaders(tpSheet, tpNT + 2, 0, tpNC - 1);
  addTableBorders(tpSheet, tpNT + 2, 0, tpNT + 2 + tpKeys, tpNC - 1); addZebraStripes(tpSheet, tpNT + 3, tpNT + 2 + tpKeys, tpNC);
  const tpD = tpNT + 4 + tpKeys;
  styleReportTitle(tpSheet, tpD, tpNC);
  styleColumnHeaders(tpSheet, tpD + 2, 0, 6);
  addTableBorders(tpSheet, tpD + 2, 0, tpD + 2 + session.laps.length, 6);
  addZebraStripes(tpSheet, tpD + 3, tpD + 2 + session.laps.length, 7);
  addAutoFilter(tpSheet, tpD + 2, 0, tpD + 2 + session.laps.length, 6);
  XLSX.utils.book_append_sheet(wb, tpSheet, 'Tempo Analizi');
  }

  // ========== SHEET 11: NOTLAR ==========
  if (sheets.notlar !== false) {
  const notesLaps = session.laps.filter(l => l.note);
  const nData = [
    ['NOTLAR'],
    [],
    ['Kayıt No', 'Çevrim', 'Adım', 'Süre (sn)', 'Süre (mm:ss.cc)', 'Anomali', 'Tempo', 'Not']
  ];

  if (notesLaps.length > 0) {
    session.laps.forEach((l, i) => {
      if (l.note) {
        const anomaly = l.tag !== null && sTags[l.tag] ? sTags[l.tag].name : '';
        const stepName = l.stepName || sSteps[l.step]?.name || `Adım ${l.step + 1}`;
        const cycle = l.cycle || Math.floor(i / stepCount) + 1;
        nData.push([i + 1, cycle, stepName, toSec(l.t), ffull(l.t), anomaly, l.tempo || 100, l.note]);
      }
    });
  } else {
    nData.push(['Not bulunamadı']);
  }

  const nSheet = XLSX.utils.aoa_to_sheet(nData);
  nSheet['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 15 }, { wch: 10 }, { wch: 50 }];
  styleReportTitle(nSheet, 0, 8);
  styleColumnHeaders(nSheet, 2, 0, 7);
  if (notesLaps.length > 0) {
    addTableBorders(nSheet, 2, 0, 2 + notesLaps.length, 7);
    addZebraStripes(nSheet, 3, 2 + notesLaps.length, 8);
  }
  XLSX.utils.book_append_sheet(wb, nSheet, 'Notlar');
  }

  // ========== SHEET 12: KONFİGÜRASYON ==========
  if (sheets.konfigurasyon !== false) {
  const cfgData = [
    ['KONFİGÜRASYON'],
    [],
    ['ADIMLAR'],
    ['No', 'Adım Adı'],
  ];
  sSteps.forEach((s, i) => {
    cfgData.push([i + 1, s.name]);
  });

  cfgData.push([], ['ANOMALİ ETİKETLERİ'], ['No', 'İsim', 'İkon']);
  sTags.forEach((t, i) => {
    cfgData.push([i + 1, t.name, t.icon || 'tag']);
  });

  cfgData.push([], ['ÖLÇÜM MODU'], ['Mod', 'Ardışık İşlem (sequence)']);
  cfgData.push([], ['NREQ PARAMETRELERİ']);
  cfgData.push(['Güven Düzeyi', `%${confPct}`]);
  cfgData.push(['Hata Payı', `±%${errPct}`]);
  cfgData.push([], ['VERSİYON BİLGİSİ']);
  cfgData.push(['Export Versiyonu', '5.0']);
  cfgData.push(['Uygulama', 'Zaman Etüdü PWA']);

  const cfgSheet = XLSX.utils.aoa_to_sheet(cfgData);
  cfgSheet['!cols'] = [{ wch: 18 }, { wch: 25 }, { wch: 12 }];
  styleReportTitle(cfgSheet, 0, 3);
  styleSubSectionHeader(cfgSheet, 2, 3); // ADIMLAR
  styleColumnHeaders(cfgSheet, 3, 0, 1);
  addTableBorders(cfgSheet, 3, 0, 3 + sSteps.length, 1);
  addZebraStripes(cfgSheet, 4, 3 + sSteps.length, 2);
  const cf1 = 5 + sSteps.length;
  styleSubSectionHeader(cfgSheet, cf1, 3); // ANOMALİ ETİKETLERİ
  styleColumnHeaders(cfgSheet, cf1 + 1, 0, 2);
  addTableBorders(cfgSheet, cf1 + 1, 0, cf1 + 1 + sTags.length, 2);
  addZebraStripes(cfgSheet, cf1 + 2, cf1 + 1 + sTags.length, 3);
  const cf2 = cf1 + 3 + sTags.length;
  styleSubSectionHeader(cfgSheet, cf2, 3); // ÖLÇÜM MODU
  styleKVRows(cfgSheet, cf2 + 1, cf2 + 1, 3, false);
  styleSubSectionHeader(cfgSheet, cf2 + 3, 3); // NREQ
  styleKVRows(cfgSheet, cf2 + 4, cf2 + 5, 3, false);
  styleSubSectionHeader(cfgSheet, cf2 + 7, 3); // VERSİYON
  styleKVRows(cfgSheet, cf2 + 8, cf2 + 9, 3, false);
  XLSX.utils.book_append_sheet(wb, cfgSheet, 'Konfigürasyon');
  }
  if (sheets.terimlerSozlugu !== false) buildGlossarySheet(wb, 'sequence');
}

// Find mode (most frequent value rounded to 10ms)
// ============ JSON EXPORT ============

export function exportAllJSON() {
  const data = {
    version: 2,
    exportDate: new Date().toISOString(),
    tags: loadTags(),
    history: loadHistory()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'zaman_etudu_yedek_' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  toast('JSON yedeği indirildi', 't-ok');
}

// Trigger import JSON
export function triggerImportJSON() {
  $('jsonImportInput').click();
}

// Handle JSON import
export function handleJSONImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);

      // Doğrulama yap
      const validation = validateImportData(data);
      if (!validation.valid) {
        toast(validation.error, 't-dng');
        return;
      }

      // Etiketleri kaydet (4 adet ve geçerliyse)
      if (data.tags && data.tags.length === 4) {
        saveTags(data.tags);
        setTags(data.tags);
      }

      // Geçmişi kaydet
      saveHistory(data.history);
      toast(data.history.length + ' ölçüm başarıyla içe aktarıldı', 't-ok');
      renderHistory();
    } catch (err) {
      toast('Geçersiz JSON dosyası: Dosya okunamadı', 't-dng');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// İçe aktarma verisini doğrula
function validateImportData(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Geçersiz dosya formatı' };
  }

  if (!Array.isArray(data.history)) {
    return { valid: false, error: 'Geçmiş verisi bulunamadı' };
  }

  if (data.history.length === 0) {
    return { valid: true };
  }

  for (let i = 0; i < data.history.length; i++) {
    const record = data.history[i];

    if (!record || typeof record !== 'object') {
      return { valid: false, error: `Kayıt #${i + 1} geçersiz format` };
    }

    if (!Array.isArray(record.laps)) {
      return { valid: false, error: `Kayıt #${i + 1}: Tur verisi bulunamadı` };
    }

    for (let j = 0; j < record.laps.length; j++) {
      const lap = record.laps[j];

      if (!lap || typeof lap !== 'object') {
        return { valid: false, error: `Kayıt #${i + 1}, Tur #${j + 1}: Geçersiz format` };
      }

      if (typeof lap.t !== 'number' || lap.t < 0) {
        return { valid: false, error: `Kayıt #${i + 1}, Tur #${j + 1}: Geçersiz süre değeri` };
      }
    }

    // Sequence mode: validate step fields
    if (record.mode === 'sequence') {
      for (let j = 0; j < record.laps.length; j++) {
        const lap = record.laps[j];
        if (lap.step !== undefined && (typeof lap.step !== 'number' || lap.step < 0)) {
          return { valid: false, error: `Kayıt #${i + 1}, Tur #${j + 1}: Geçersiz adım değeri` };
        }
      }
    }
  }

  if (data.tags) {
    if (!Array.isArray(data.tags)) {
      return { valid: false, error: 'Etiket verisi geçersiz format' };
    }

    if (data.tags.length !== 4) {
      return { valid: false, error: 'Etiket sayısı 4 olmalı' };
    }

    for (let i = 0; i < data.tags.length; i++) {
      const tag = data.tags[i];
      if (!tag || typeof tag !== 'object') {
        return { valid: false, error: `Etiket #${i + 1}: Geçersiz format` };
      }
      if (!tag.name || typeof tag.name !== 'string') {
        return { valid: false, error: `Etiket #${i + 1}: İsim bulunamadı` };
      }
      if (!tag.color || typeof tag.color !== 'string') {
        return { valid: false, error: `Etiket #${i + 1}: Renk bulunamadı` };
      }
    }
  }

  return { valid: true };
}

// Initialize export events
export function initExportEvents() {
  $('jsonImportInput').addEventListener('change', handleJSONImport);
}
