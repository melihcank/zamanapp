// ===== STATISTICS FUNCTIONS =====

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

// Get t-critical value for given sample size and confidence level
export function tCritical(n, confidence = 0.95) {
  const df = n - 1;
  if (df < 1) return confidence === 0.99 ? 2.576 : 1.96;
  const table = confidence === 0.99 ? T_CRIT_99 : T_CRIT_95;
  if (df <= 30) return table[df - 1];
  return confidence === 0.99 ? 2.576 : 1.96;
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

// Calculate statistics for an array of times
export function calcStats(times) {
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
  const t = tCritical(n);
  const ci95Low = Math.max(0, mean - t * se);
  const ci95High = mean + t * se;

  // Required observation count (±5%, 95% confidence): n'=(40*sqrt(n*Σx²-(Σx)²)/Σx)²
  const sumSq = times.reduce((a, t) => a + t * t, 0);
  const inner = n * sumSq - sum * sum;
  const nReq = sum > 0 && inner > 0 ? Math.ceil(Math.pow(40 * Math.sqrt(inner) / sum, 2)) : n;

  return { n, sum, mean, median, stdDev, cv, min, max, range, ci95Low, ci95High, se, nReq };
}

// Tag analysis for summary
export function tagAnalysis(laps, tgs) {
  const res = [];
  tgs.forEach((tag, i) => {
    const fl = laps.filter(l => l.tag === i);
    if (fl.length) {
      const s = calcStats(fl.map(l => l.t));
      res.push({ name: tag.name, color: tag.color, idx: i, count: fl.length, ...s });
    } else {
      res.push({ name: tag.name, color: tag.color, idx: i, count: 0, sum: 0, mean: 0, median: 0, stdDev: 0, cv: 0, min: 0, max: 0, range: 0, ci95Low: 0, ci95High: 0, se: 0, nReq: 0 });
    }
  });

  const un = laps.filter(l => l.tag === null);
  if (un.length) {
    const s = calcStats(un.map(l => l.t));
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
  const low = q.q1 - 1.5 * q.iqr;
  const high = q.q3 + 1.5 * q.iqr;

  const s = new Set();
  times.forEach((t, i) => {
    if (t < low || t > high) s.add(i);
  });

  return s;
}
