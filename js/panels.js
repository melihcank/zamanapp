// ===== PANELS MODULE =====

import { $, toast, vib, esc, ffull, tagIcon } from './utils.js';
import {
  S, tags, tpTarget, setTpTarget,
  teTarget, setTeTarget,
  selNoteLap, setSelNoteLap
} from './state.js';
import { pushPanel } from './nav.js';
import { updCard } from './laps.js';

// ===== TAG PICKER =====

export function openTP(lap, card) {
  setTpTarget({ lap, card });
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
      tpTarget.lap.tag = i;
      updCard(tpTarget.card, tpTarget.lap);
      toast('Etiket: ' + tag.name, 't-ok');
      vib(15);
      closeTP();
    };
    tpGrid.appendChild(btn);
  });

  const rem = document.createElement('button');
  rem.className = 'tp-remove';
  rem.textContent = 'Etiketi Kaldır';
  rem.onclick = () => {
    tpTarget.lap.tag = null;
    updCard(tpTarget.card, tpTarget.lap);
    toast('Etiket kaldırıldı', 't-wrn');
    vib(15);
    closeTP();
  };
  tpGrid.appendChild(rem);

  $('tpOv').classList.add('open');
  $('tpPanel').classList.add('open');
  $('tpPanel').style.transform = 'translateX(-50%) translateY(0)';
  pushPanel();
}

export function closeTP() {
  $('tpOv').classList.remove('open');
  $('tpPanel').classList.remove('open');
  $('tpPanel').style.transform = 'translateX(-50%) translateY(100%)';
  setTpTarget(null);
}

// ===== NOTE PANEL =====

export function openNote() {
  if (!S.laps.length) {
    toast('Henüz tur kaydı yok', 't-wrn');
    return;
  }

  const noteChips = $('noteChips');
  const noteTa = $('noteTa');
  noteChips.innerHTML = '';
  const rec = S.laps.slice(-5).reverse();

  rec.forEach((l, i) => {
    const c = document.createElement('button');
    c.className = 'note-chip' + (i === 0 ? ' sel' : '');
    c.textContent = '#' + l.num + ' — ' + ffull(l.t);
    c.onclick = () => {
      noteChips.querySelectorAll('.note-chip').forEach(x => x.classList.remove('sel'));
      c.classList.add('sel');
      setSelNoteLap(l.id);
      noteTa.value = l.note || '';
    };
    noteChips.appendChild(c);
    if (i === 0) setSelNoteLap(l.id);
  });

  noteTa.value = rec[0]?.note || '';
  $('noteOv').classList.add('open');
  $('notePanel').classList.add('open');
  pushPanel();
}

export function closeNote() {
  $('noteOv').classList.remove('open');
  $('notePanel').classList.remove('open');
  $('noteTa')?.blur();
}

export function saveNote() {
  if (!selNoteLap) return;
  const l = S.laps.find(x => x.id === selNoteLap);
  if (l) {
    l.note = $('noteTa').value.trim();
    const c = $('lapList').querySelector(`[data-id="${l.id}"]`);
    if (c) updCard(c, l);
    toast('Not kaydedildi', 't-ok');
  }
  closeNote();
}

// ===== TEMPO EDIT PANEL =====

export function openTempoEdit(lap) {
  setTeTarget(lap);
  $('teTitle').textContent = 'Tempo Düzenle — Tur #' + lap.num;
  $('teInput').value = lap.tempo || 100;
  $('teOv').classList.add('open');
  $('tePanel').classList.add('open');
  $('tePanel').style.transform = 'translateX(-50%) translateY(0)';
  pushPanel();
}

export function closeTempoEdit() {
  $('teOv').classList.remove('open');
  $('tePanel').classList.remove('open');
  $('tePanel').style.transform = 'translateX(-50%) translateY(100%)';
  setTeTarget(null);
}

export function saveTempoEdit(updateHistoryLapsCallback, rebuildSummaryCallback) {
  if (!teTarget) return;
  let newTempo = Math.round((+$('teInput').value || 100) / 5) * 5;
  newTempo = Math.max(50, Math.min(150, newTempo));
  teTarget.tempo = newTempo;
  teTarget.nt = teTarget.t * (newTempo / 100);
  closeTempoEdit();
  if (updateHistoryLapsCallback) updateHistoryLapsCallback();
  if (rebuildSummaryCallback) rebuildSummaryCallback();
  toast('Tempo güncellendi', 't-ok');
}

// Initialize panel events
export function initPanelEvents(updateHistoryLapsCallback, rebuildSummaryCallback) {
  $('tpOv').onclick = closeTP;
  $('bNote').onclick = openNote;
  $('noteOv').onclick = closeNote;
  $('noteSave').onclick = saveNote;
  $('teOv').onclick = closeTempoEdit;
  $('teMinus').onclick = () => { const inp = $('teInput'); inp.value = Math.max(50, +inp.value - 5); };
  $('tePlus').onclick = () => { const inp = $('teInput'); inp.value = Math.min(150, +inp.value + 5); };
  $('tePanel').querySelectorAll('.te-preset').forEach(btn => {
    btn.onclick = () => $('teInput').value = btn.dataset.val;
  });
  $('teSaveBtn').onclick = () => saveTempoEdit(updateHistoryLapsCallback, rebuildSummaryCallback);
}
