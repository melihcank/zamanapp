// ===== STATISTICS FUNCTIONS =====

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
  const ci95Low = Math.max(0, mean - 1.96 * se);
  const ci95High = mean + 1.96 * se;

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

// Detect outliers using IQR method
export function detectOutliers(times) {
  if (times.length < 4) return new Set();

  const sorted = [...times].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;

  const s = new Set();
  times.forEach((t, i) => {
    if (t < low || t > high) s.add(i);
  });

  return s;
}
