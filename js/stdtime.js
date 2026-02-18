// ===== STANDARD TIME MODULE =====

import { $, toast, ffull, esc, dimColor } from './utils.js';
import { calcStats, calcStandardTime } from './stats.js';
import { loadHistory, saveHistory } from './storage.js';
import { showScreen } from './nav.js';
import { STEP_COLORS } from './config.js';

// Module state
let _currentRecord = null;
let _currentIdx = null;
let _allowances = [];

const DEFAULT_ALLOWANCES = [
  { name: 'Kişisel İhtiyaç', percent: 5 },
  { name: 'Yorgunluk', percent: 4 },
  { name: 'Gecikme', percent: 2 }
];

// ===== EXPORTED FUNCTIONS =====

// Render the list of history records for standard time calculation
export function renderStdTimeList() {
  const list = $('stdTimeList');
  list.innerHTML = '';
  const hist = loadHistory();

  if (!hist.length) {
    const e = document.createElement('div');
    e.className = 'hi-empty';
    e.textContent = 'Henüz kayıtlı ölçüm yok. Önce bir ölçüm yapın.';
    list.appendChild(e);
    return;
  }

  hist.slice().reverse().forEach((h, ri) => {
    const idx = hist.length - 1 - ri;
    const card = document.createElement('div');
    card.className = 'st-list-card';
    card.dataset.idx = idx;
    const avg = h.laps.length ? h.laps.reduce((a, l) => a + (l.nt || l.t), 0) / h.laps.length : 0;
    const modeBadge = h.mode === 'sequence'
      ? '<span style="display:inline-block;padding:1px 5px;background:var(--inf-d);color:var(--inf);border-radius:var(--r-pill);font-size:clamp(7px,2vw,9px);font-weight:700;margin-left:4px">ARDIŞIK</span>'
      : '';
    const stData = h.standardTime;
    const stBadge = stData
      ? `<span class="st-badge">SZ: ${ffull(stData.result)}</span>`
      : '';
    const lapLabel = h.mode === 'sequence' ? 'kayıt' : 'tur';
    card.innerHTML = `<div class="st-list-card-top"><span class="st-list-job">${esc(h.job)}${modeBadge}${stBadge}</span><span class="st-list-date">${h.date}</span></div><div class="st-list-card-row">${esc(h.op)} &middot; <span>${h.laps.length}</span> ${lapLabel} &middot; NT Ort: <span>${ffull(avg)}</span></div>`;
    list.appendChild(card);
  });

  // Card click handlers
  list.querySelectorAll('.st-list-card').forEach(card => {
    card.onclick = () => {
      const h = loadHistory()[+card.dataset.idx];
      if (!h) return;
      openStdTimeCalc(h, +card.dataset.idx);
    };
  });
}

// Open standard time calculation screen for a specific record
export function openStdTimeCalc(record, idx) {
  _currentRecord = record;
  _currentIdx = idx;

  // Load existing allowances or use defaults
  if (record.standardTime && record.standardTime.allowances) {
    _allowances = JSON.parse(JSON.stringify(record.standardTime.allowances));
  } else {
    _allowances = JSON.parse(JSON.stringify(DEFAULT_ALLOWANCES));
  }

  renderStdTimeCalcScreen();
  showScreen('stdTimeCalc');
}

// Save standard time calculation to history
export function saveStandardTime() {
  if (!_currentRecord || _currentIdx === null) return;

  const totalPct = _allowances.reduce((a, r) => a + (parseFloat(r.percent) || 0), 0);
  const isSeq = _currentRecord.mode === 'sequence';

  const stObj = {
    allowances: _allowances.map(a => ({ name: a.name, percent: parseFloat(a.percent) || 0 })),
    totalAllowance: totalPct,
    savedAt: new Date().toISOString()
  };

  if (isSeq) {
    const steps = _currentRecord.steps || [];
    const resultPerStep = [];
    let cycleST = 0;

    steps.forEach((step, si) => {
      const stepLaps = _currentRecord.laps.filter(l => l.step === si);
      const stepNTs = stepLaps.map(l => l.nt || l.t);
      let ntMean = 0;
      if (stepNTs.length) ntMean = stepNTs.reduce((a, b) => a + b, 0) / stepNTs.length;
      const stepST = calcStandardTime(ntMean, totalPct);
      resultPerStep.push({ stepName: step.name, ntMean: Math.round(ntMean), st: stepST });
      cycleST += stepST;
    });

    stObj.resultPerStep = resultPerStep;
    stObj.cycleST = cycleST;
    stObj.result = cycleST;
  } else {
    const normalTimes = _currentRecord.laps.map(l => l.nt || l.t);
    const st = calcStats(normalTimes);
    if (!st) {
      toast('Hesaplama yapılamadı — veri yok', 't-wrn');
      return;
    }
    stObj.result = calcStandardTime(st.mean, totalPct);
  }

  // Save to history
  const hist = loadHistory();
  if (!hist[_currentIdx]) {
    toast('Kayıt bulunamadı', 't-dng');
    return;
  }
  hist[_currentIdx].standardTime = stObj;
  saveHistory(hist);

  toast('Standart zaman kaydedildi', 't-ok');
  renderStdTimeList();
  showScreen('stdTimeList');
}

// Initialize events for standard time screens
export function initStdTimeEvents() {
  $('stcBack').onclick = () => showScreen('stdTimeList');
  $('stcAddAllowance').onclick = addAllowance;
  $('stcSave').onclick = saveStandardTime;
}

// ===== INTERNAL FUNCTIONS =====

function addAllowance() {
  _allowances.push({ name: '', percent: 0 });
  renderAllowanceRows();
  recalcAndDisplay();
  // Focus the new name input
  setTimeout(() => {
    const inputs = $('stcAllowancesList').querySelectorAll('.st-al-name');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 50);
}

function deleteAllowance(idx) {
  if (_allowances.length <= 1) {
    toast('En az 1 pay kalemi gerekli', 't-wrn');
    return;
  }
  _allowances.splice(idx, 1);
  renderAllowanceRows();
  recalcAndDisplay();
}

function renderStdTimeCalcScreen() {
  const rec = _currentRecord;
  const isSeq = rec.mode === 'sequence';
  const summary = $('stcSummary');

  // Calculate NT stats
  let ntMeanDisplay;
  if (isSeq) {
    // For sequence, show per-cycle NT total
    const steps = rec.steps || [];
    const completeCycles = Math.floor(rec.laps.length / steps.length);
    const totalNT = rec.laps.reduce((a, l) => a + (l.nt || l.t), 0);
    ntMeanDisplay = completeCycles > 0 ? totalNT / completeCycles : totalNT;
    summary.innerHTML = `<div class="st-summary-title">${esc(rec.job)}</div>
      <div class="st-summary-grid">
        <div class="st-stat"><div class="st-stat-label">Operatör</div><div class="st-stat-value">${esc(rec.op)}</div></div>
        <div class="st-stat"><div class="st-stat-label">Mod</div><div class="st-stat-value">Ardışık</div></div>
        <div class="st-stat"><div class="st-stat-label">Kayıt Sayısı</div><div class="st-stat-value">${rec.laps.length}</div></div>
        <div class="st-stat"><div class="st-stat-label">Adım Sayısı</div><div class="st-stat-value">${steps.length}</div></div>
        <div class="st-stat"><div class="st-stat-label">Tam Çevrim</div><div class="st-stat-value">${completeCycles}</div></div>
        <div class="st-stat"><div class="st-stat-label">Çevrim NT Ort</div><div class="st-stat-value">${ffull(ntMeanDisplay)}</div></div>
      </div>`;
  } else {
    const normalTimes = rec.laps.map(l => l.nt || l.t);
    const st = calcStats(normalTimes);
    ntMeanDisplay = st ? st.mean : 0;
    summary.innerHTML = `<div class="st-summary-title">${esc(rec.job)}</div>
      <div class="st-summary-grid">
        <div class="st-stat"><div class="st-stat-label">Operatör</div><div class="st-stat-value">${esc(rec.op)}</div></div>
        <div class="st-stat"><div class="st-stat-label">Mod</div><div class="st-stat-value">Tekrarlı</div></div>
        <div class="st-stat"><div class="st-stat-label">Tur Sayısı</div><div class="st-stat-value">${rec.laps.length}</div></div>
        <div class="st-stat"><div class="st-stat-label">NT Ortalaması</div><div class="st-stat-value">${ffull(ntMeanDisplay)}</div></div>
      </div>`;
  }

  renderAllowanceRows();
  recalcAndDisplay();
}

function renderAllowanceRows() {
  const container = $('stcAllowancesList');
  container.innerHTML = '';

  _allowances.forEach((al, i) => {
    const row = document.createElement('div');
    row.className = 'st-allowance-row';
    row.innerHTML = `<input type="text" class="st-al-name" value="${esc(al.name)}" placeholder="Pay adı" data-idx="${i}"><input type="number" class="st-al-pct" value="${al.percent}" placeholder="%" min="0" max="100" step="0.5" inputmode="decimal" data-idx="${i}"><span class="st-pct-suffix">%</span><button type="button" class="st-al-del" data-idx="${i}" ${_allowances.length <= 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>`;
    container.appendChild(row);
  });

  // Event delegation
  container.querySelectorAll('.st-al-name').forEach(inp => {
    inp.oninput = () => {
      _allowances[+inp.dataset.idx].name = inp.value;
    };
  });

  container.querySelectorAll('.st-al-pct').forEach(inp => {
    inp.oninput = () => {
      _allowances[+inp.dataset.idx].percent = parseFloat(inp.value) || 0;
      recalcAndDisplay();
    };
  });

  container.querySelectorAll('.st-al-del').forEach(btn => {
    btn.onclick = () => deleteAllowance(+btn.dataset.idx);
  });

  // Total row
  const totalPct = _allowances.reduce((a, r) => a + (parseFloat(r.percent) || 0), 0);
  const totalRow = document.createElement('div');
  totalRow.className = 'st-total-row';
  totalRow.innerHTML = `<span>Toplam Pay</span><span>%${totalPct.toFixed(1)}</span>`;
  container.appendChild(totalRow);
}

function recalcAndDisplay() {
  const rec = _currentRecord;
  if (!rec) return;

  const totalPct = _allowances.reduce((a, r) => a + (parseFloat(r.percent) || 0), 0);
  const resultDiv = $('stcResult');
  const isSeq = rec.mode === 'sequence';

  if (isSeq) {
    const steps = rec.steps || [];
    let html = '<div class="st-result-label">STANDART ZAMAN HESABI</div>';
    html += '<table class="st-step-table"><thead><tr><th>Adım</th><th>NT Ort</th><th>SZ</th></tr></thead><tbody>';

    let cycleST = 0;
    steps.forEach((step, si) => {
      const stepLaps = rec.laps.filter(l => l.step === si);
      const stepNTs = stepLaps.map(l => l.nt || l.t);
      let ntMean = 0;
      if (stepNTs.length) ntMean = stepNTs.reduce((a, b) => a + b, 0) / stepNTs.length;
      const stepST = calcStandardTime(ntMean, totalPct);
      cycleST += stepST;
      const color = step.color || STEP_COLORS[si % STEP_COLORS.length];
      html += `<tr><td><span class="st-step-dot" style="background:${color}"></span>${esc(step.name)}</td><td>${stepNTs.length ? ffull(ntMean) : '—'}</td><td>${stepNTs.length ? ffull(stepST) : '—'}</td></tr>`;
    });

    html += `<tr class="st-step-total"><td>Çevrim Toplamı</td><td></td><td>${ffull(cycleST)}</td></tr>`;
    html += '</tbody></table>';
    html += `<div class="st-result-formula">Formül: NT Ort × (1 + %${totalPct.toFixed(1)}) = Standart Zaman</div>`;
    resultDiv.innerHTML = html;
  } else {
    const normalTimes = rec.laps.map(l => l.nt || l.t);
    const st = calcStats(normalTimes);
    if (!st) {
      resultDiv.innerHTML = '<div class="st-result-label">Hesaplanamadı</div>';
      return;
    }
    const result = calcStandardTime(st.mean, totalPct);
    const resultSec = (result / 1000).toFixed(3);

    resultDiv.innerHTML = `<div class="st-result-label">STANDART ZAMAN</div>
      <div class="st-result-main">${ffull(result)}</div>
      <div class="st-result-sub">${resultSec} saniye &middot; NT Ort: <span>${ffull(st.mean)}</span> &middot; Pay: <span>%${totalPct.toFixed(1)}</span></div>
      <div class="st-result-formula">Formül: ${ffull(st.mean)} × (1 + ${totalPct.toFixed(1)}%) = ${ffull(result)}</div>`;
  }
}
