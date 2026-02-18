// ===== STATISTICS FUNCTIONS =====

import { getSetting } from './settings.js';

// t-distribution critical values (two-tailed, α/2 = 0.025 for 95% CI)
// df = n-1, index 0 = df=1, index 29 = df=30
const T_CRIT_95 = [
  12.706, 4.303, 3.182, 2.776, 2.571,
  2.447, 2.365, 2.306, 2.262, 2.228,
  2.201, 2.179, 2.160, 2.145, 2.131,
  2.120, 2.110, 2.101, 2.093, 2.086,
  2.080, 2.074, 2.069, 2.064, 2.060,
  2.056, 2.052, 2.048, 2.045, 2.042
];

// t-distribution critical values (two-tailed, α/2 = 0.005 for 99% CI)
const T_CRIT_99 = [
  63.657, 9.925, 5.841, 4.604, 4.032,
  3.707, 3.499, 3.355, 3.250, 3.169,
  3.106, 3.055, 3.012, 2.977, 2.947,
  2.921, 2.898, 2.878, 2.861, 2.845,
  2.831, 2.819, 2.807, 2.797, 2.787,
  2.779, 2.771, 2.763, 2.756, 2.750
];

// t-distribution critical values (two-tailed, α/2 = 0.05 for 90% CI)
const T_CRIT_90 = [
  6.314, 2.920, 2.353, 2.132, 2.015,
  1.943, 1.895, 1.860, 1.833, 1.812,
  1.796, 1.782, 1.771, 1.761, 1.753,
  1.746, 1.740, 1.734, 1.729, 1.725,
  1.721, 1.717, 1.714, 1.711, 1.708,
  1.706, 1.703, 1.701, 1.699, 1.697
];

// Get t-critical value for given sample size and confidence level
export function tCritical(n, confidence) {
  if (confidence === undefined) confidence = getSetting('stats', 'defaultConfidence');
  const df = n - 1;
  const zFallback = confidence === 0.99 ? 2.576 : confidence === 0.90 ? 1.645 : 1.96;
  if (df < 1) return zFallback;
  const table = confidence === 0.99 ? T_CRIT_99 : confidence === 0.90 ? T_CRIT_90 : T_CRIT_95;
  if (df <= 30) return table[df - 1];
  return zFallback;
}

// Percentile calculation (linear interpolation — Excel PERCENTILE.INC compatible)
export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

// Quartiles using interpolation method
export function quartiles(times) {
  if (!times.length) return { q1: 0, q2: 0, q3: 0, iqr: 0 };
  const sorted = [...times].sort((a, b) => a - b);
  return {
    q1: percentile(sorted, 0.25),
    q2: percentile(sorted, 0.50),
    q3: percentile(sorted, 0.75),
    iqr: percentile(sorted, 0.75) - percentile(sorted, 0.25)
  };
}

// Z-values for nReq formula (gerekli gözlem sayısı)
const Z_MAP = { 0.90: 1.645, 0.95: 1.96, 0.99: 2.576 };

// Calculate statistics for an array of times
// opts: { confidence: 0.90|0.95|0.99, errorMargin: 0.03|0.05|0.10 }
export function calcStats(times, opts = {}) {
  const n = times.length;
  if (!n) return null;

  const sum = times.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const sorted = [...times].sort((a, b) => a - b);
  const median = n % 2 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const variance = times.reduce((a, t) => a + (t - mean) ** 2, 0) / (n > 1 ? n - 1 : 1);
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? (stdDev / mean) * 100 : 0;
  const min = sorted[0];
  const max = sorted[n - 1];
  const range = max - min;
  const se = stdDev / Math.sqrt(n);
  const ciConf = opts.confidence || getSetting('stats', 'defaultConfidence') || 0.95;
  const t = tCritical(n, ciConf);
  const ci95Low = Math.max(0, mean - t * se);
  const ci95High = mean + t * se;

  // Required observation count: nReq = (z * s / (e * x̄))²
  const z = Z_MAP[opts.confidence] || Z_MAP[getSetting('stats', 'defaultConfidence')] || 1.96;
  const e = opts.errorMargin || getSetting('stats', 'defaultErrorMargin');
  const k = z / e;
  const nReq = mean > 0 && n > 1 ? Math.ceil((k * stdDev / mean) ** 2) : n;

  return { n, sum, mean, median, stdDev, cv, min, max, range, ci95Low, ci95High, se, nReq, ciConf };
}

// Standard time calculation: NT mean × (1 + allowance%)
export function calcStandardTime(ntMean, totalAllowancePct) {
  if (!ntMean || ntMean <= 0) return 0;
  return Math.round(ntMean * (1 + totalAllowancePct / 100));
}

// Tag analysis for summary
export function tagAnalysis(laps, tgs, opts = {}) {
  const res = [];
  tgs.forEach((tag, i) => {
    const fl = laps.filter(l => l.tag === i);
    if (fl.length) {
      const s = calcStats(fl.map(l => l.t), opts);
      res.push({ name: tag.name, color: tag.color, idx: i, count: fl.length, ...s });
    } else {
      res.push({ name: tag.name, color: tag.color, idx: i, count: 0, sum: 0, mean: 0, median: 0, stdDev: 0, cv: 0, min: 0, max: 0, range: 0, ci95Low: 0, ci95High: 0, se: 0, nReq: 0 });
    }
  });

  const un = laps.filter(l => l.tag === null);
  if (un.length) {
    const s = calcStats(un.map(l => l.t), opts);
    res.push({ name: 'Etiketsiz', color: '#666', idx: -1, count: un.length, ...s });
  } else {
    res.push({ name: 'Etiketsiz', color: '#666', idx: -1, count: 0, sum: 0, mean: 0, median: 0, stdDev: 0, cv: 0, min: 0, max: 0, range: 0, ci95Low: 0, ci95High: 0, se: 0, nReq: 0 });
  }

  return res;
}

// Detect outliers using IQR method (interpolation-based quartiles)
export function detectOutliers(times) {
  if (times.length < 4) return new Set();

  const q = quartiles(times);
  const k = getSetting('stats', 'iqrMultiplier');
  const low = q.q1 - k * q.iqr;
  const high = q.q3 + k * q.iqr;

  const s = new Set();
  times.forEach((t, i) => {
    if (t < low || t > high) s.add(i);
  });

  return s;
}

// Frequency distribution (histogram bins)
export function freqDist(times, binCount) {
  if (binCount === undefined) binCount = getSetting('stats', 'histogramBins');
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

// Moving average
export function movingAvg(times, window) {
  if (window === undefined) window = getSetting('stats', 'movingAvgWindow');
  const result = [];
  for (let i = 0; i < times.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = times.slice(start, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return result;
}

// Linear regression (y = intercept + slope * x, R²)
export function linearRegression(times) {
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

// Skewness (örneklem çarpıklık — n-1 düzeltmeli)
export function skewness(times, mean, stdDev) {
  if (!times.length || stdDev === 0) return 0;
  const n = times.length;
  if (n < 3) return 0;
  const m3 = times.reduce((sum, t) => sum + Math.pow((t - mean) / stdDev, 3), 0);
  return (n / ((n - 1) * (n - 2))) * m3;
}

// Kurtosis (örneklem excess kurtosis — n-1 düzeltmeli)
export function kurtosis(times, mean, stdDev) {
  if (!times.length || stdDev === 0) return 0;
  const n = times.length;
  if (n < 4) return 0;
  const m4 = times.reduce((sum, t) => sum + Math.pow((t - mean) / stdDev, 4), 0);
  const k = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * m4;
  return k - (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
}

// Mode — en sık değer (10ms yuvarlama ile)
export function findMode(times) {
  if (!times.length) return 0;
  const rounding = getSetting('stats', 'modeRounding');
  const freq = {};
  times.forEach(t => {
    const rounded = Math.round(t / rounding) * rounding;
    freq[rounded] = (freq[rounded] || 0) + 1;
  });
  let mode = times[0], maxFreq = 0;
  Object.entries(freq).forEach(([val, f]) => {
    if (f > maxFreq) { maxFreq = f; mode = +val; }
  });
  return mode;
}
