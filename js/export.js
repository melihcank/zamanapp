// ===== EXPORT MODULE =====
// Kapsamlı Excel & JSON Export Sistemi

import { $, toast, ffull, fmt, fms } from './utils.js';
import { STEP_COLORS, TEMPO_VALUES } from './config.js';
import { calcStats, tagAnalysis, detectOutliers, percentile, quartiles, tCritical } from './stats.js';
import { loadHistory, saveHistory, loadTags, saveTags } from './storage.js';
import { tags, setTags, sequenceSteps } from './state.js';
import { renderHistory } from './history.js';

// Load XLSX library dynamically
function loadXLSX(cb) {
  if (typeof XLSX !== 'undefined') { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload = cb;
  s.onerror = () => toast('Excel kütüphanesi yüklenemedi. İnternet bağlantısını kontrol edin.', 't-dng');
  document.head.appendChild(s);
}

// ============ HELPER FUNCTIONS ============

// Convert ms to seconds with precision
function toSec(ms, decimals = 3) {
  return ms != null ? +(ms / 1000).toFixed(decimals) : null;
}

// Calculate frequency distribution
function freqDist(times, binCount = 10) {
  if (!times.length) return [];
  const min = Math.min(...times);
  const max = Math.max(...times);
  const range = max - min || 1;
  const binSize = range / binCount;

  const bins = [];
  for (let i = 0; i < binCount; i++) {
    const lo = min + i * binSize;
    const hi = min + (i + 1) * binSize;
    const count = times.filter(t => t >= lo && (i === binCount - 1 ? t <= hi : t < hi)).length;
    bins.push({
      binStart: lo,
      binEnd: hi,
      count,
      freq: (count / times.length) * 100
    });
  }
  return bins;
}

// Calculate moving average
function movingAvg(times, window = 5) {
  const result = [];
  for (let i = 0; i < times.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = times.slice(start, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return result;
}

// Linear regression
function linearRegression(times) {
  const n = times.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += times[i];
    sumXY += i * times[i];
    sumX2 += i * i;
    sumY2 += times[i] * times[i];
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R² calculation
  const yMean = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * i;
    ssTot += (times[i] - yMean) ** 2;
    ssRes += (times[i] - pred) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, r2 };
}

// Calculate skewness
function skewness(times, mean, stdDev) {
  if (!times.length || stdDev === 0) return 0;
  const n = times.length;
  const m3 = times.reduce((sum, t) => sum + Math.pow((t - mean) / stdDev, 3), 0) / n;
  return m3;
}

// Calculate kurtosis
function kurtosis(times, mean, stdDev) {
  if (!times.length || stdDev === 0) return 0;
  const n = times.length;
  const m4 = times.reduce((sum, t) => sum + Math.pow((t - mean) / stdDev, 4), 0) / n;
  return m4 - 3; // Excess kurtosis
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

    XLSX.writeFile(wb, fn);
    toast('Kapsamlı Excel raporu indirildi', 't-ok');
  });
}

// ============ REPEAT MODE EXCEL ============

function buildRepeatExcel(wb, session, sTags) {
  const times = session.laps.map(l => l.t);
  const normalTimes = session.laps.map(l => l.nt || l.t);
  const st = calcStats(times);
  const stNT = calcStats(normalTimes);
  const outliers = detectOutliers(times);
  const q = quartiles(times);
  const qNT = quartiles(normalTimes);
  const sorted = [...times].sort((a, b) => a - b);
  const sortedNT = [...normalTimes].sort((a, b) => a - b);
  const reg = linearRegression(times);
  const regNT = linearRegression(normalTimes);
  const ma = movingAvg(times, 5);
  const maNT = movingAvg(normalTimes, 5);

  // ========== SHEET 1: ÖZET ==========
  const s1Data = [
    ['ZAMAN ETÜDÜ RAPORU - TEKRARLI ÖLÇÜM'],
    ['Oluşturma Tarihi:', new Date().toLocaleString('tr-TR')],
    [],
    ['ÖLÇÜM BİLGİLERİ'],
    ['İş / Proses Adı', session.job || '-'],
    ['Operatör', session.op || '-'],
    ['Ölçüm Tarihi', session.date || '-'],
    ['Ölçüm Saati', session.time || '-'],
    ['Toplam Gözlem (n)', st?.n || 0],
    ['Toplam Süre', ffull(st?.sum || 0)],
    [],
    ['GÖZLEMLENEN SÜRELER'],
    ['Ortalama (x̄)', toSec(st?.mean), 'sn'],
    ['Medyan', toSec(st?.median), 'sn'],
    ['Mod (En sık)', toSec(findMode(times)), 'sn'],
    ['Standart Sapma (σ)', toSec(st?.stdDev), 'sn'],
    ['Varyans (σ²)', toSec(st?.stdDev ? st.stdDev ** 2 : 0, 6), 'sn²'],
    ['Varyasyon Katsayısı (CV)', st?.cv?.toFixed(2) || 0, '%'],
    ['Minimum', toSec(st?.min), 'sn'],
    ['Maksimum', toSec(st?.max), 'sn'],
    ['Aralık (Range)', toSec(st?.range), 'sn'],
    ['Standart Hata (SE)', toSec(st?.se), 'sn'],
    [],
    ['NORMAL SÜRELER (Tempo Düzeltmeli)'],
    ['Ortalama Normal Süre', toSec(stNT?.mean), 'sn'],
    ['Medyan Normal Süre', toSec(stNT?.median), 'sn'],
    ['Toplam Normal Süre', toSec(stNT?.sum), 'sn'],
    ['Std Sapma (Normal)', toSec(stNT?.stdDev), 'sn'],
    ['CV (Normal)', stNT?.cv?.toFixed(2) || 0, '%'],
    [],
    ['DAĞILIM BİLGİLERİ'],
    ['Q1 (25. Persentil)', toSec(q.q1), 'sn'],
    ['Q2 (Medyan)', toSec(q.q2), 'sn'],
    ['Q3 (75. Persentil)', toSec(q.q3), 'sn'],
    ['IQR (Çeyrekler Arası)', toSec(q.iqr), 'sn'],
    ['10. Persentil', toSec(percentile(sorted, 0.10)), 'sn'],
    ['90. Persentil', toSec(percentile(sorted, 0.90)), 'sn'],
    ['Çarpıklık (Skewness)', st ? skewness(times, st.mean, st.stdDev).toFixed(3) : 0],
    ['Basıklık (Kurtosis)', st ? kurtosis(times, st.mean, st.stdDev).toFixed(3) : 0],
    [],
    ['GÜVEN ARALIĞI & YETERLİLİK'],
    ['%95 GA Alt Sınır', toSec(st?.ci95Low), 'sn'],
    ['%95 GA Üst Sınır', toSec(st?.ci95High), 'sn'],
    ['%99 GA Alt Sınır', toSec(st ? Math.max(0, st.mean - tCritical(st.n, 0.99) * st.se) : 0), 'sn'],
    ['%99 GA Üst Sınır', toSec(st ? st.mean + tCritical(st.n, 0.99) * st.se : 0), 'sn'],
    ['Gerekli Gözlem (±%5, %95)', st?.nReq || 0],
    ['Yeterli Gözlem?', st && st.n >= st.nReq ? 'EVET' : 'HAYIR'],
    [],
    ['TREND ANALİZİ'],
    ['Eğim (Slope)', reg.slope.toFixed(6), 'ms/tur'],
    ['Kesişim (Intercept)', toSec(reg.intercept), 'sn'],
    ['R² (Belirleyicilik)', reg.r2.toFixed(4)],
    ['Trend Yönü', reg.slope > 1 ? 'Artış ↑' : reg.slope < -1 ? 'Azalış ↓' : 'Stabil →'],
    [],
    ['AYKIRI DEĞERLER'],
    ['Aykırı Sayısı (IQR)', outliers.size],
    ['Aykırı Oranı', ((outliers.size / (st?.n || 1)) * 100).toFixed(1) + '%']
  ];

  const s1 = XLSX.utils.aoa_to_sheet(s1Data);
  s1['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, s1, 'Özet');

  // ========== SHEET 2: HAM VERİ ==========
  const s2Header = [
    'Tur No', 'Süre (ms)', 'Süre (sn)', 'Süre (mm:ss.cc)',
    'Tempo (%)', 'Normal (ms)', 'Normal (sn)', 'Normal (mm:ss.cc)',
    'Kümülatif (ms)', 'Kümülatif (sn)', 'Kümülatif (mm:ss.cc)',
    'Etiket Kodu', 'Etiket Adı', 'Etiket Rengi',
    'Not', 'Aykırı Değer?',
    'Ortalamadan Sapma (ms)', 'Ortalamadan Sapma (%)',
    'Z-Skor', 'Hareketli Ort. (5)', 'Trend Değeri'
  ];
  const s2Data = [s2Header];

  session.laps.forEach((l, i) => {
    const tagName = l.tag !== null && sTags[l.tag] ? sTags[l.tag].name : '';
    const tagColor = l.tag !== null && sTags[l.tag] ? sTags[l.tag].color : '';
    const tempo = l.tempo || 100;
    const nt = l.nt || l.t;
    const isOutlier = outliers.has(i);
    const devMs = l.t - (st?.mean || 0);
    const devPct = st?.mean ? (devMs / st.mean) * 100 : 0;
    const zScore = st?.stdDev ? (l.t - st.mean) / st.stdDev : 0;
    const trendVal = reg.intercept + reg.slope * i;

    s2Data.push([
      i + 1,
      l.t,
      toSec(l.t),
      ffull(l.t),
      tempo,
      nt,
      toSec(nt),
      ffull(nt),
      l.cum,
      toSec(l.cum),
      ffull(l.cum),
      l.tag !== null ? l.tag : '',
      tagName,
      tagColor,
      l.note || '',
      isOutlier ? 'EVET' : '',
      +devMs.toFixed(1),
      +devPct.toFixed(2),
      +zScore.toFixed(3),
      toSec(ma[i]),
      toSec(trendVal)
    ]);
  });

  const s2 = XLSX.utils.aoa_to_sheet(s2Data);
  s2['!cols'] = [
    { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
    { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 14 },
    { wch: 10 }, { wch: 15 }, { wch: 10 },
    { wch: 30 }, { wch: 12 },
    { wch: 16 }, { wch: 16 },
    { wch: 10 }, { wch: 14 }, { wch: 12 }
  ];
  XLSX.utils.book_append_sheet(wb, s2, 'Ham Veri');

  // ========== SHEET 3: ETİKET ANALİZİ ==========
  const ta = tagAnalysis(session.laps, sTags);
  const s3Data = [
    ['ETİKET ANALİZİ'],
    [],
    ['Etiket', 'Renk', 'Adet', 'Oran (%)', 'Toplam (sn)', 'Ortalama (sn)', 'Medyan (sn)',
     'Min (sn)', 'Max (sn)', 'Aralık (sn)', 'Std Sapma (sn)', 'CV (%)',
     'Q1 (sn)', 'Q3 (sn)', 'IQR (sn)', '%95 GA Alt', '%95 GA Üst']
  ];

  ta.forEach(ts => {
    const tLaps = session.laps.filter(l => ts.idx === -1 ? l.tag === null : l.tag === ts.idx);
    const tTimes = tLaps.map(l => l.t);
    const tQ = quartiles(tTimes);

    s3Data.push([
      ts.name,
      ts.color,
      ts.count,
      +((ts.count / (st?.n || 1)) * 100).toFixed(1),
      toSec(ts.sum),
      toSec(ts.mean),
      toSec(ts.median),
      toSec(ts.min),
      toSec(ts.max),
      toSec(ts.range),
      toSec(ts.stdDev),
      +ts.cv.toFixed(2),
      toSec(tQ.q1),
      toSec(tQ.q3),
      toSec(tQ.iqr),
      toSec(ts.ci95Low),
      toSec(ts.ci95High)
    ]);
  });

  const s3 = XLSX.utils.aoa_to_sheet(s3Data);
  s3['!cols'] = Array(17).fill({ wch: 12 });
  s3['!cols'][0] = { wch: 15 };
  XLSX.utils.book_append_sheet(wb, s3, 'Etiket Analizi');

  // ========== SHEET 4: DAĞILIM ANALİZİ ==========
  const bins = freqDist(times, 10);
  const s4Data = [
    ['FREKANS DAĞILIMI (10 Aralık)'],
    [],
    ['Aralık Başı (sn)', 'Aralık Sonu (sn)', 'Frekans', 'Oran (%)', 'Kümülatif Frekans', 'Kümülatif (%)'],
  ];

  let cumFreq = 0;
  bins.forEach(b => {
    cumFreq += b.count;
    s4Data.push([
      toSec(b.binStart),
      toSec(b.binEnd),
      b.count,
      +b.freq.toFixed(2),
      cumFreq,
      +((cumFreq / (st?.n || 1)) * 100).toFixed(2)
    ]);
  });

  s4Data.push([], ['PERSENTİL TABLOSU'], []);
  s4Data.push(['Persentil', 'Gözlemlenen (sn)', 'Normal (sn)']);
  [5, 10, 25, 50, 75, 90, 95].forEach(p => {
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
  s4Data.push(['Alt Sınır (Q1-1.5*IQR)', toSec(q.q1 - 1.5 * q.iqr), toSec(qNT.q1 - 1.5 * qNT.iqr)]);
  s4Data.push(['Üst Sınır (Q3+1.5*IQR)', toSec(q.q3 + 1.5 * q.iqr), toSec(qNT.q3 + 1.5 * qNT.iqr)]);

  const s4 = XLSX.utils.aoa_to_sheet(s4Data);
  s4['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, s4, 'Dağılım Analizi');

  // ========== SHEET 5: TREND ANALİZİ ==========
  const s5Data = [
    ['TREND ANALİZİ'],
    [],
    ['REGRESYON ANALİZİ'],
    ['Metrik', 'Gözlemlenen', 'Normal'],
    ['Eğim (ms/tur)', reg.slope.toFixed(4), regNT.slope.toFixed(4)],
    ['Kesişim (ms)', reg.intercept.toFixed(2), regNT.intercept.toFixed(2)],
    ['R²', reg.r2.toFixed(4), regNT.r2.toFixed(4)],
    ['Trend', reg.slope > 1 ? 'Artış' : reg.slope < -1 ? 'Azalış' : 'Stabil', regNT.slope > 1 ? 'Artış' : regNT.slope < -1 ? 'Azalış' : 'Stabil'],
    [],
    ['TUR BAZLI TREND VERİSİ'],
    ['Tur', 'Gözlemlenen (sn)', 'Normal (sn)', 'Har. Ort. Göz. (sn)', 'Har. Ort. Nor. (sn)', 'Trend Değeri (sn)', 'Göz. - Trend (sn)']
  ];

  session.laps.forEach((l, i) => {
    const trendVal = reg.intercept + reg.slope * i;
    s5Data.push([
      i + 1,
      toSec(l.t),
      toSec(l.nt || l.t),
      toSec(ma[i]),
      toSec(maNT[i]),
      toSec(trendVal),
      toSec(l.t - trendVal)
    ]);
  });

  const s5 = XLSX.utils.aoa_to_sheet(s5Data);
  s5['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, s5, 'Trend Analizi');

  // ========== SHEET 6: AYKIRI DEĞER ANALİZİ ==========
  const s6Data = [
    ['AYKIRI DEĞER ANALİZİ (IQR Yöntemi)'],
    [],
    ['SINIRLAR'],
    ['Alt Sınır (Q1 - 1.5*IQR)', toSec(q.q1 - 1.5 * q.iqr), 'sn'],
    ['Üst Sınır (Q3 + 1.5*IQR)', toSec(q.q3 + 1.5 * q.iqr), 'sn'],
    [],
    ['ÖZET'],
    ['Toplam Aykırı Değer', outliers.size],
    ['Aykırı Oranı', ((outliers.size / (st?.n || 1)) * 100).toFixed(1) + '%'],
    [],
    ['AYKIRI DEĞER LİSTESİ'],
    ['Tur No', 'Süre (sn)', 'Süre (mm:ss.cc)', 'Etiket', 'Sapma Yönü', 'Z-Skor']
  ];

  session.laps.forEach((l, i) => {
    if (outliers.has(i)) {
      const tagName = l.tag !== null && sTags[l.tag] ? sTags[l.tag].name : 'Etiketsiz';
      const zScore = st?.stdDev ? (l.t - st.mean) / st.stdDev : 0;
      const dir = l.t < q.q1 - 1.5 * q.iqr ? 'Düşük ↓' : 'Yüksek ↑';
      s6Data.push([i + 1, toSec(l.t), ffull(l.t), tagName, dir, +zScore.toFixed(2)]);
    }
  });

  if (outliers.size === 0) {
    s6Data.push(['Aykırı değer bulunamadı']);
  }

  // Add stats without outliers
  const cleanTimes = times.filter((_, i) => !outliers.has(i));
  if (cleanTimes.length > 0 && outliers.size > 0) {
    const cleanStats = calcStats(cleanTimes);
    s6Data.push([], ['AYKIRI DEĞERLER HARİÇ İSTATİSTİKLER']);
    s6Data.push(['Gözlem Sayısı', cleanStats?.n || 0]);
    s6Data.push(['Ortalama', toSec(cleanStats?.mean), 'sn']);
    s6Data.push(['Medyan', toSec(cleanStats?.median), 'sn']);
    s6Data.push(['Std Sapma', toSec(cleanStats?.stdDev), 'sn']);
    s6Data.push(['CV%', cleanStats?.cv?.toFixed(2) || 0]);
    s6Data.push(['Min', toSec(cleanStats?.min), 'sn']);
    s6Data.push(['Max', toSec(cleanStats?.max), 'sn']);
  }

  const s6 = XLSX.utils.aoa_to_sheet(s6Data);
  s6['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, s6, 'Aykırı Değerler');

  // ========== SHEET 7: TEMPO ANALİZİ ==========
  const tempoGroups = {};
  session.laps.forEach(l => {
    const t = l.tempo || 100;
    if (!tempoGroups[t]) tempoGroups[t] = [];
    tempoGroups[t].push(l.t);
  });

  const s7Data = [
    ['TEMPO ANALİZİ'],
    [],
    ['Tempo (%)', 'Adet', 'Oran (%)', 'Toplam (sn)', 'Ortalama (sn)', 'Min (sn)', 'Max (sn)', 'Std Sapma (sn)', 'CV (%)']
  ];

  Object.keys(tempoGroups).sort((a, b) => +b - +a).forEach(tempo => {
    const tTimes = tempoGroups[tempo];
    const tStats = calcStats(tTimes);
    s7Data.push([
      +tempo,
      tStats?.n || 0,
      +((tStats?.n / (st?.n || 1)) * 100).toFixed(1),
      toSec(tStats?.sum),
      toSec(tStats?.mean),
      toSec(tStats?.min),
      toSec(tStats?.max),
      toSec(tStats?.stdDev),
      +tStats?.cv?.toFixed(2)
    ]);
  });

  // Add tempo distribution
  s7Data.push([], ['TEMPO DAĞILIMI (Tur Bazlı)'], []);
  s7Data.push(['Tur', 'Tempo (%)', 'Süre (sn)', 'Normal Süre (sn)', 'Etki (%)']);
  session.laps.forEach((l, i) => {
    const tempo = l.tempo || 100;
    const nt = l.nt || l.t;
    const effect = tempo !== 100 ? ((l.t - nt) / l.t) * 100 : 0;
    s7Data.push([i + 1, tempo, toSec(l.t), toSec(nt), +effect.toFixed(2)]);
  });

  const s7 = XLSX.utils.aoa_to_sheet(s7Data);
  s7['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, s7, 'Tempo Analizi');

  // ========== SHEET 8: NOTLAR ==========
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
  XLSX.utils.book_append_sheet(wb, s8, 'Notlar');

  // ========== SHEET 9: KONFİGÜRASYON ==========
  const s9Data = [
    ['KONFİGÜRASYON'],
    [],
    ['ETİKETLER'],
    ['No', 'İsim', 'Renk', 'İkon'],
  ];
  sTags.forEach((t, i) => {
    s9Data.push([i + 1, t.name, t.color, t.icon || 'tag']);
  });

  s9Data.push([], ['ÖLÇÜM MODU'], ['Mod', 'Tekrarlı (repeat)']);
  s9Data.push([], ['VERSİYON BİLGİSİ']);
  s9Data.push(['Export Versiyonu', '3.0']);
  s9Data.push(['Uygulama', 'Zaman Etüdü PWA']);

  const s9 = XLSX.utils.aoa_to_sheet(s9Data);
  s9['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, s9, 'Konfigürasyon');
}

// ============ SEQUENCE MODE EXCEL ============

function buildSequenceExcel(wb, session, sTags, sSteps) {
  const stepCount = sSteps.length || 4;
  const completeCycles = Math.floor(session.laps.length / stepCount);
  const times = session.laps.map(l => l.t);
  const normalTimes = session.laps.map(l => l.nt || l.t);
  const st = calcStats(times);
  const stNT = calcStats(normalTimes);
  const outliers = detectOutliers(times);

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
  const cycleStats = calcStats(cycleTimes);
  const cycleStatsNT = calcStats(cycleNormalTimes);
  const cycleQ = quartiles(cycleTimes);
  const cycleReg = linearRegression(cycleTimes);
  const cycleOutliers = detectOutliers(cycleTimes);

  // ========== SHEET 1: ÖZET ==========
  const s1Data = [
    ['ZAMAN ETÜDÜ RAPORU - ARDIŞIK İŞLEM'],
    ['Oluşturma Tarihi:', new Date().toLocaleString('tr-TR')],
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
    ['ÇEVRİM SÜRESİ İSTATİSTİKLERİ'],
    ['Ortalama Çevrim', toSec(cycleStats?.mean), 'sn'],
    ['Medyan Çevrim', toSec(cycleStats?.median), 'sn'],
    ['Std Sapma', toSec(cycleStats?.stdDev), 'sn'],
    ['CV%', cycleStats?.cv?.toFixed(2) || 0],
    ['Minimum Çevrim', toSec(cycleStats?.min), 'sn'],
    ['Maksimum Çevrim', toSec(cycleStats?.max), 'sn'],
    ['Aralık', toSec(cycleStats?.range), 'sn'],
    [],
    ['NORMAL ÇEVRİM SÜRESİ (Tempo Düzeltmeli)'],
    ['Ortalama Normal Çevrim', toSec(cycleStatsNT?.mean), 'sn'],
    ['Toplam Normal Süre', toSec(cycleStatsNT?.sum), 'sn'],
    [],
    ['GÜVEN ARALIĞI'],
    ['%95 GA Alt', toSec(cycleStats?.ci95Low), 'sn'],
    ['%95 GA Üst', toSec(cycleStats?.ci95High), 'sn'],
    ['Gerekli Çevrim (±%5, %95)', cycleStats?.nReq || 0],
    ['Yeterli Çevrim?', cycleStats && completeCycles >= cycleStats.nReq ? 'EVET' : 'HAYIR'],
    [],
    ['TREND'],
    ['Eğim (Slope)', cycleReg.slope.toFixed(4), 'ms/çevrim'],
    ['R²', cycleReg.r2.toFixed(4)],
    ['Trend Yönü', cycleReg.slope > 10 ? 'Artış ↑' : cycleReg.slope < -10 ? 'Azalış ↓' : 'Stabil →'],
    [],
    ['DAĞILIM BİLGİLERİ (Çevrim)'],
    ['Varyans (σ²)', toSec(cycleStats?.stdDev ? cycleStats.stdDev ** 2 : 0, 6), 'sn²'],
    ['Standart Hata (SE)', toSec(cycleStats?.se), 'sn'],
    ['Q1 (25. Persentil)', toSec(cycleQ.q1), 'sn'],
    ['Q2 (Medyan)', toSec(cycleQ.q2), 'sn'],
    ['Q3 (75. Persentil)', toSec(cycleQ.q3), 'sn'],
    ['IQR (Çeyrekler Arası)', toSec(cycleQ.iqr), 'sn'],
    ['Mod (En sık)', toSec(findMode(cycleTimes)), 'sn'],
    ['Çarpıklık (Skewness)', cycleStats ? skewness(cycleTimes, cycleStats.mean, cycleStats.stdDev).toFixed(3) : 0],
    ['Basıklık (Kurtosis)', cycleStats ? kurtosis(cycleTimes, cycleStats.mean, cycleStats.stdDev).toFixed(3) : 0],
    [],
    ['%99 GÜVEN ARALIĞI'],
    ['%99 GA Alt', toSec(cycleStats ? Math.max(0, cycleStats.mean - tCritical(cycleStats.n, 0.99) * cycleStats.se) : 0), 'sn'],
    ['%99 GA Üst', toSec(cycleStats ? cycleStats.mean + tCritical(cycleStats.n, 0.99) * cycleStats.se : 0), 'sn'],
    [],
    ['AYKIRI DEĞERLER (Çevrim)'],
    ['Aykırı Çevrim Sayısı (IQR)', cycleOutliers.size],
    ['Aykırı Oranı', ((cycleOutliers.size / (cycleStats?.n || 1)) * 100).toFixed(1) + '%']
  ];

  const s1 = XLSX.utils.aoa_to_sheet(s1Data);
  s1['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, s1, 'Özet');

  // ========== SHEET 2: HAM VERİ ==========
  const lapMA = movingAvg(times, 5);
  const lapReg = linearRegression(times);

  const s2Header = [
    'Kayıt No', 'Çevrim', 'Adım No', 'Adım Adı', 'Adım Rengi',
    'Süre (ms)', 'Süre (sn)', 'Süre (mm:ss.cc)',
    'Tempo (%)', 'Normal (ms)', 'Normal (sn)', 'Normal (mm:ss.cc)',
    'Kümülatif (ms)', 'Kümülatif (sn)', 'Kümülatif (mm:ss.cc)',
    'Anomali Kodu', 'Anomali Adı', 'Not', 'Aykırı?',
    'Ort. Sapma (ms)', 'Ort. Sapma (%)', 'Z-Skor', 'Har. Ort. (5) sn', 'Trend Değeri (sn)'
  ];
  const s2Data = [s2Header];

  session.laps.forEach((l, i) => {
    const stepIdx = l.step !== undefined ? l.step : i % stepCount;
    const stepName = l.stepName || sSteps[stepIdx]?.name || `Adım ${stepIdx + 1}`;
    const stepColor = sSteps[stepIdx]?.color || STEP_COLORS[stepIdx % STEP_COLORS.length];
    const anomaly = l.tag !== null && sTags[l.tag] ? sTags[l.tag].name : '';
    const tempo = l.tempo || 100;
    const nt = l.nt || l.t;
    const cycle = l.cycle || Math.floor(i / stepCount) + 1;
    const devMs = l.t - (st?.mean || 0);
    const devPct = st?.mean ? (devMs / st.mean) * 100 : 0;
    const zScore = st?.stdDev ? (l.t - st.mean) / st.stdDev : 0;
    const trendVal = lapReg.intercept + lapReg.slope * i;

    s2Data.push([
      i + 1, cycle, stepIdx + 1, stepName, stepColor,
      l.t, toSec(l.t), ffull(l.t),
      tempo, nt, toSec(nt), ffull(nt),
      l.cum, toSec(l.cum), ffull(l.cum),
      l.tag !== null ? l.tag : '', anomaly, l.note || '',
      outliers.has(i) ? 'EVET' : '',
      +devMs.toFixed(1), +devPct.toFixed(2), +zScore.toFixed(3),
      toSec(lapMA[i]), toSec(trendVal)
    ]);
  });

  const s2 = XLSX.utils.aoa_to_sheet(s2Data);
  s2['!cols'] = [
    { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 10 },
    { wch: 12 }, { wch: 10 }, { wch: 12 },
    { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 14 },
    { wch: 12 }, { wch: 15 }, { wch: 30 }, { wch: 8 },
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, s2, 'Ham Veri');

  // ========== SHEET 3: ÇEVRİM ANALİZİ ==========
  const s3Data = [
    ['ÇEVRİM ANALİZİ'],
    [],
    ['Çevrim No', 'Toplam (sn)', 'Toplam (mm:ss.cc)', 'Normal (sn)',
     'Ortalamadan Sapma (sn)', 'Sapma (%)', 'Z-Skor', 'Aykırı?']
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

    const row = [
      c + 1, toSec(ct), ffull(ct), toSec(cnt),
      toSec(devMs), +devPct.toFixed(2), +zScore.toFixed(2),
      cycleOutliers.has(c) ? 'EVET' : ''
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
    { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 8 }
  ];
  for (let s = 0; s < stepCount; s++) s3Cols.push({ wch: 12 });
  s3['!cols'] = s3Cols;
  XLSX.utils.book_append_sheet(wb, s3, 'Çevrim Analizi');

  // ========== SHEET 4: ADIM ANALİZİ ==========
  const s4Data = [
    ['ADIM ANALİZİ'],
    [],
    ['Adım', 'Renk', 'Adet', 'Toplam (sn)', 'Ortalama (sn)', 'Normal Ort (sn)',
     'Medyan (sn)', 'Min (sn)', 'Max (sn)', 'Aralık (sn)',
     'Std Sapma (sn)', 'CV (%)', 'Q1 (sn)', 'Q3 (sn)', '%95 GA Alt', '%95 GA Üst',
     'Oran (%)', 'Trend Eğimi']
  ];

  for (let i = 0; i < stepCount; i++) {
    const stepLaps = session.laps.filter(l => (l.step !== undefined ? l.step : 0) === i);
    const stepTimes = stepLaps.map(l => l.t);
    const stepNT = stepLaps.map(l => l.nt || l.t);
    const stats = calcStats(stepTimes);
    const ntStats = calcStats(stepNT);
    const stepQ = quartiles(stepTimes);
    const stepReg = linearRegression(stepTimes);
    const stepName = sSteps[i]?.name || `Adım ${i + 1}`;
    const stepColor = sSteps[i]?.color || STEP_COLORS[i % STEP_COLORS.length];
    const ratio = cycleStats?.mean ? ((stats?.mean || 0) / cycleStats.mean) * 100 : 0;

    if (stats) {
      s4Data.push([
        stepName, stepColor, stats.n, toSec(stats.sum), toSec(stats.mean), toSec(ntStats?.mean),
        toSec(stats.median), toSec(stats.min), toSec(stats.max), toSec(stats.range),
        toSec(stats.stdDev), +stats.cv.toFixed(2), toSec(stepQ.q1), toSec(stepQ.q3),
        toSec(stats.ci95Low), toSec(stats.ci95High),
        +ratio.toFixed(1), stepReg.slope.toFixed(4)
      ]);
    }
  }

  // Add totals row
  s4Data.push([]);
  s4Data.push(['TOPLAM', '', st?.n || 0, toSec(st?.sum), '', '', '', '', '', '', '', '', '', '', '', '', '100%', '']);

  const s4 = XLSX.utils.aoa_to_sheet(s4Data);
  s4['!cols'] = Array(18).fill({ wch: 12 });
  s4['!cols'][0] = { wch: 18 };
  XLSX.utils.book_append_sheet(wb, s4, 'Adım Analizi');

  // ========== SHEET 5: ADIM KARŞILAŞTIRMA ==========
  const s5Data = [
    ['ADIM KARŞILAŞTIRMA MATRİSİ'],
    [],
    ['Çevrim \\ Adım']
  ];

  // Header row with step names
  for (let s = 0; s < stepCount; s++) {
    s5Data[2].push(sSteps[s]?.name || `Adım ${s + 1}`);
  }
  s5Data[2].push('Çevrim Toplamı');

  // Data rows
  for (let c = 0; c < completeCycles; c++) {
    const row = [`Çevrim ${c + 1}`];
    for (let s = 0; s < stepCount; s++) {
      const idx = c * stepCount + s;
      row.push(toSec(session.laps[idx]?.t));
    }
    row.push(toSec(cycleTimes[c]));
    s5Data.push(row);
  }

  // Summary rows
  s5Data.push([]);
  const avgRow = ['Ortalama'];
  const minRow = ['Minimum'];
  const maxRow = ['Maximum'];
  const stdRow = ['Std Sapma'];

  for (let s = 0; s < stepCount; s++) {
    const stepTimes = session.laps.filter(l => l.step === s).map(l => l.t);
    const stepStats = calcStats(stepTimes);
    avgRow.push(toSec(stepStats?.mean));
    minRow.push(toSec(stepStats?.min));
    maxRow.push(toSec(stepStats?.max));
    stdRow.push(toSec(stepStats?.stdDev));
  }
  avgRow.push(toSec(cycleStats?.mean));
  minRow.push(toSec(cycleStats?.min));
  maxRow.push(toSec(cycleStats?.max));
  stdRow.push(toSec(cycleStats?.stdDev));

  s5Data.push(avgRow, minRow, maxRow, stdRow);

  const s5 = XLSX.utils.aoa_to_sheet(s5Data);
  const s5Cols = [{ wch: 15 }];
  for (let s = 0; s <= stepCount; s++) s5Cols.push({ wch: 14 });
  s5['!cols'] = s5Cols;
  XLSX.utils.book_append_sheet(wb, s5, 'Adım Karşılaştırma');

  // ========== SHEET 6: ANOMALİ ANALİZİ ==========
  const anomalyLaps = session.laps.filter(l => l.tag !== null && l.tag !== undefined);
  const s6Data = [
    ['ANOMALİ ANALİZİ'],
    [],
    ['ÖZET'],
    ['Anomali Türü', 'Renk', 'Adet', 'Oran (%)', 'Toplam Süre (sn)', 'Ortalama (sn)', 'Min (sn)', 'Max (sn)']
  ];

  sTags.forEach((t, i) => {
    const tagLaps = anomalyLaps.filter(l => l.tag === i);
    const tagTimes = tagLaps.map(l => l.t);
    const tagStats = calcStats(tagTimes);
    if (tagLaps.length > 0) {
      s6Data.push([
        t.name, t.color, tagLaps.length,
        +((tagLaps.length / session.laps.length) * 100).toFixed(1),
        toSec(tagStats?.sum), toSec(tagStats?.mean), toSec(tagStats?.min), toSec(tagStats?.max)
      ]);
    }
  });

  s6Data.push([], ['ANOMALİ DETAYI'], []);
  s6Data.push(['Kayıt No', 'Çevrim', 'Adım', 'Anomali', 'Süre (sn)', 'Not']);

  session.laps.forEach((l, i) => {
    if (l.tag !== null && l.tag !== undefined && sTags[l.tag]) {
      const stepName = l.stepName || sSteps[l.step]?.name || `Adım ${(l.step || 0) + 1}`;
      s6Data.push([
        i + 1, l.cycle || Math.floor(i / stepCount) + 1, stepName,
        sTags[l.tag].name, toSec(l.t), l.note || ''
      ]);
    }
  });

  const s6 = XLSX.utils.aoa_to_sheet(s6Data);
  s6['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, s6, 'Anomali Analizi');

  // ========== SHEET 7: ÇEVRİM TREND ==========
  const cycleMa = movingAvg(cycleTimes, 3);
  const s7Data = [
    ['ÇEVRİM TREND ANALİZİ'],
    [],
    ['REGRESYON'],
    ['Eğim (ms/çevrim)', cycleReg.slope.toFixed(4)],
    ['Kesişim (ms)', cycleReg.intercept.toFixed(2)],
    ['R²', cycleReg.r2.toFixed(4)],
    ['Trend Yönü', cycleReg.slope > 10 ? 'Artış (yavaşlama)' : cycleReg.slope < -10 ? 'Azalış (hızlanma)' : 'Stabil'],
    [],
    ['ÇEVRİM BAZLI VERİ'],
    ['Çevrim', 'Süre (sn)', 'Hareketli Ort (3)', 'Trend Değeri', 'Trend Sapması']
  ];

  for (let c = 0; c < completeCycles; c++) {
    const trendVal = cycleReg.intercept + cycleReg.slope * c;
    s7Data.push([
      c + 1, toSec(cycleTimes[c]), toSec(cycleMa[c]), toSec(trendVal), toSec(cycleTimes[c] - trendVal)
    ]);
  }

  const s7 = XLSX.utils.aoa_to_sheet(s7Data);
  s7['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, s7, 'Çevrim Trend');

  // ========== SHEET 8: DAĞILIM ANALİZİ ==========
  const cycleSorted = [...cycleTimes].sort((a, b) => a - b);
  const cycleBins = freqDist(cycleTimes, 10);
  const dData = [
    ['DAĞILIM ANALİZİ - ÇEVRİM SÜRELERİ'],
    [],
    ['FREKANS DAĞILIMI (10 Aralık)'],
    ['Aralık Başı (sn)', 'Aralık Sonu (sn)', 'Frekans', 'Oran (%)', 'Küm. Frekans', 'Küm. (%)']
  ];

  let dCumFreq = 0;
  cycleBins.forEach(b => {
    dCumFreq += b.count;
    dData.push([
      toSec(b.binStart), toSec(b.binEnd), b.count,
      +b.freq.toFixed(2), dCumFreq,
      +((dCumFreq / (cycleStats?.n || 1)) * 100).toFixed(2)
    ]);
  });

  dData.push([], ['PERSENTİL TABLOSU (Çevrim)'], []);
  dData.push(['Persentil', 'Gözlemlenen (sn)', 'Normal (sn)']);
  const cycleNTSorted = [...cycleNormalTimes].sort((a, b) => a - b);
  [5, 10, 25, 50, 75, 90, 95].forEach(p => {
    dData.push([
      p + '%',
      toSec(percentile(cycleSorted, p / 100)),
      toSec(percentile(cycleNTSorted, p / 100))
    ]);
  });

  dData.push([], ['BOX PLOT VERİLERİ (Çevrim)'], []);
  dData.push(['Metrik', 'Değer (sn)']);
  dData.push(['Minimum', toSec(cycleStats?.min)]);
  dData.push(['Q1', toSec(cycleQ.q1)]);
  dData.push(['Medyan (Q2)', toSec(cycleQ.q2)]);
  dData.push(['Q3', toSec(cycleQ.q3)]);
  dData.push(['Maksimum', toSec(cycleStats?.max)]);
  dData.push(['IQR', toSec(cycleQ.iqr)]);
  dData.push(['Alt Sınır (Q1-1.5*IQR)', toSec(cycleQ.q1 - 1.5 * cycleQ.iqr)]);
  dData.push(['Üst Sınır (Q3+1.5*IQR)', toSec(cycleQ.q3 + 1.5 * cycleQ.iqr)]);

  // Per-step distribution summary
  dData.push([], ['ADIM BAZLI DAĞILIM ÖZETİ'], []);
  dData.push(['Adım', 'n', 'Q1 (sn)', 'Medyan (sn)', 'Q3 (sn)', 'IQR (sn)', 'Çarpıklık', 'Basıklık']);
  for (let si = 0; si < stepCount; si++) {
    const stepLaps = session.laps.filter(l => (l.step !== undefined ? l.step : 0) === si);
    const stepTimes = stepLaps.map(l => l.t);
    const stepQ = quartiles(stepTimes);
    const stepSt = calcStats(stepTimes);
    const stepName = sSteps[si]?.name || `Adım ${si + 1}`;
    dData.push([
      stepName, stepTimes.length,
      toSec(stepQ.q1), toSec(stepQ.q2), toSec(stepQ.q3), toSec(stepQ.iqr),
      stepSt ? skewness(stepTimes, stepSt.mean, stepSt.stdDev).toFixed(3) : '—',
      stepSt ? kurtosis(stepTimes, stepSt.mean, stepSt.stdDev).toFixed(3) : '—'
    ]);
  }

  const dSheet = XLSX.utils.aoa_to_sheet(dData);
  dSheet['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, dSheet, 'Dağılım Analizi');

  // ========== SHEET 9: AYKIRI DEĞER ANALİZİ ==========
  const oData = [
    ['AYKIRI DEĞER ANALİZİ'],
    [],
    ['ÇEVRİM BAZLI (IQR Yöntemi)'],
    ['Alt Sınır (Q1 - 1.5*IQR)', toSec(cycleQ.q1 - 1.5 * cycleQ.iqr), 'sn'],
    ['Üst Sınır (Q3 + 1.5*IQR)', toSec(cycleQ.q3 + 1.5 * cycleQ.iqr), 'sn'],
    [],
    ['Aykırı Çevrim Sayısı', cycleOutliers.size],
    ['Aykırı Oranı', ((cycleOutliers.size / (cycleStats?.n || 1)) * 100).toFixed(1) + '%'],
    [],
    ['AYKIRI ÇEVRİMLER'],
    ['Çevrim No', 'Süre (sn)', 'Süre (mm:ss.cc)', 'Sapma Yönü', 'Z-Skor']
  ];

  for (let c = 0; c < completeCycles; c++) {
    if (cycleOutliers.has(c)) {
      const ct = cycleTimes[c];
      const zScore = cycleStats?.stdDev ? (ct - cycleStats.mean) / cycleStats.stdDev : 0;
      const dir = ct < cycleQ.q1 - 1.5 * cycleQ.iqr ? 'Düşük ↓' : 'Yüksek ↑';
      oData.push([c + 1, toSec(ct), ffull(ct), dir, +zScore.toFixed(2)]);
    }
  }
  if (cycleOutliers.size === 0) oData.push(['Aykırı çevrim bulunamadı']);

  // Clean stats without outliers
  const cleanCycleTimes = cycleTimes.filter((_, i) => !cycleOutliers.has(i));
  if (cleanCycleTimes.length > 0 && cycleOutliers.size > 0) {
    const cleanCycleStats = calcStats(cleanCycleTimes);
    oData.push([], ['AYKIRI DEĞERLER HARİÇ ÇEVRİM İSTATİSTİKLERİ']);
    oData.push(['Çevrim Sayısı', cleanCycleStats?.n || 0]);
    oData.push(['Ortalama', toSec(cleanCycleStats?.mean), 'sn']);
    oData.push(['Medyan', toSec(cleanCycleStats?.median), 'sn']);
    oData.push(['Std Sapma', toSec(cleanCycleStats?.stdDev), 'sn']);
    oData.push(['CV%', cleanCycleStats?.cv?.toFixed(2) || 0]);
    oData.push(['Min', toSec(cleanCycleStats?.min), 'sn']);
    oData.push(['Max', toSec(cleanCycleStats?.max), 'sn']);
  }

  // Per-step outlier summary
  oData.push([], ['ADIM BAZLI AYKIRI DEĞER ÖZETİ'], []);
  oData.push(['Adım', 'Toplam', 'Aykırı', 'Oran (%)']);
  for (let si = 0; si < stepCount; si++) {
    const stepTimes = session.laps.filter(l => (l.step !== undefined ? l.step : 0) === si).map(l => l.t);
    const stepOutliers = detectOutliers(stepTimes);
    const stepName = sSteps[si]?.name || `Adım ${si + 1}`;
    oData.push([
      stepName, stepTimes.length, stepOutliers.size,
      stepTimes.length ? ((stepOutliers.size / stepTimes.length) * 100).toFixed(1) + '%' : '—'
    ]);
  }

  const oSheet = XLSX.utils.aoa_to_sheet(oData);
  oSheet['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, oSheet, 'Aykırı Değerler');

  // ========== SHEET 10: TEMPO ANALİZİ ==========
  const tempoGroups = {};
  session.laps.forEach(l => {
    const t = l.tempo || 100;
    if (!tempoGroups[t]) tempoGroups[t] = [];
    tempoGroups[t].push(l.t);
  });

  const tpData = [
    ['TEMPO ANALİZİ'],
    [],
    ['Tempo (%)', 'Adet', 'Oran (%)', 'Toplam (sn)', 'Ortalama (sn)', 'Min (sn)', 'Max (sn)', 'Std Sapma (sn)', 'CV (%)']
  ];

  Object.keys(tempoGroups).sort((a, b) => +b - +a).forEach(tempo => {
    const tTimes = tempoGroups[tempo];
    const tStats = calcStats(tTimes);
    tpData.push([
      +tempo, tStats?.n || 0,
      +((tStats?.n / (st?.n || 1)) * 100).toFixed(1),
      toSec(tStats?.sum), toSec(tStats?.mean), toSec(tStats?.min),
      toSec(tStats?.max), toSec(tStats?.stdDev), +(tStats?.cv?.toFixed(2) || 0)
    ]);
  });

  tpData.push([], ['TEMPO DAĞILIMI (Kayıt Bazlı)'], []);
  tpData.push(['Kayıt', 'Çevrim', 'Adım', 'Tempo (%)', 'Süre (sn)', 'Normal Süre (sn)', 'Etki (%)']);
  session.laps.forEach((l, i) => {
    const tempo = l.tempo || 100;
    const nt = l.nt || l.t;
    const effect = tempo !== 100 ? ((l.t - nt) / l.t) * 100 : 0;
    const stepName = l.stepName || sSteps[l.step || 0]?.name || `Adım ${(l.step || 0) + 1}`;
    const cycle = l.cycle || Math.floor(i / stepCount) + 1;
    tpData.push([i + 1, cycle, stepName, tempo, toSec(l.t), toSec(nt), +effect.toFixed(2)]);
  });

  const tpSheet = XLSX.utils.aoa_to_sheet(tpData);
  tpSheet['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, tpSheet, 'Tempo Analizi');

  // ========== SHEET 11: NOTLAR ==========
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
        const stepName = l.stepName || sSteps[l.step || 0]?.name || `Adım ${(l.step || 0) + 1}`;
        const cycle = l.cycle || Math.floor(i / stepCount) + 1;
        nData.push([i + 1, cycle, stepName, toSec(l.t), ffull(l.t), anomaly, l.tempo || 100, l.note]);
      }
    });
  } else {
    nData.push(['Not bulunamadı']);
  }

  const nSheet = XLSX.utils.aoa_to_sheet(nData);
  nSheet['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 15 }, { wch: 10 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, nSheet, 'Notlar');

  // ========== SHEET 12: KONFİGÜRASYON ==========
  const cfgData = [
    ['KONFİGÜRASYON'],
    [],
    ['ADIMLAR'],
    ['No', 'Adım Adı', 'Renk'],
  ];
  sSteps.forEach((s, i) => {
    cfgData.push([i + 1, s.name, s.color || STEP_COLORS[i % STEP_COLORS.length]]);
  });

  cfgData.push([], ['ANOMALİ ETİKETLERİ'], ['No', 'İsim', 'Renk', 'İkon']);
  sTags.forEach((t, i) => {
    cfgData.push([i + 1, t.name, t.color, t.icon || 'tag']);
  });

  cfgData.push([], ['ÖLÇÜM MODU'], ['Mod', 'Ardışık İşlem (sequence)']);
  cfgData.push([], ['VERSİYON BİLGİSİ']);
  cfgData.push(['Export Versiyonu', '3.0']);
  cfgData.push(['Uygulama', 'Zaman Etüdü PWA']);

  const cfgSheet = XLSX.utils.aoa_to_sheet(cfgData);
  cfgSheet['!cols'] = [{ wch: 18 }, { wch: 25 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, cfgSheet, 'Konfigürasyon');
}

// Find mode (most frequent value rounded to 10ms)
function findMode(times) {
  if (!times.length) return 0;
  const freq = {};
  times.forEach(t => {
    const rounded = Math.round(t / 10) * 10;
    freq[rounded] = (freq[rounded] || 0) + 1;
  });
  let mode = times[0], maxFreq = 0;
  Object.entries(freq).forEach(([val, f]) => {
    if (f > maxFreq) { maxFreq = f; mode = +val; }
  });
  return mode;
}

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
