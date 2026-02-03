// ===== APPLICATION STATE =====

import { STEP_COLORS } from './config.js';
import { loadTags } from './storage.js';

// Main application state
export const S = {
  op: '',
  job: '',
  running: false,
  paused: false,
  started: false,
  startTime: 0,
  elapsed: 0,
  pauseStart: 0,
  totalPaused: 0,      // Duraklatma süresi
  deletedTime: 0,      // Silinen turların toplam süresi
  laps: [],
  lastLapTime: 0,
  raf: null,
  defaultTag: 0,
  resumeFromTime: 0
};

// Tags state
export let tags = loadTags();

// Tempo state
export let currentTempo = 100;
export let tempoIdx = 10; // index of 100 in TEMPO_VALUES

// Summary state
export let sumDelTarget = null;
export let sumFilterTags = new Set([0, 1, 2, 3, 'none']);
export let sumIncludeOutliers = true;
export let sumDateStr = '';
export let sumTimeStr = '';

// History state
export let historyViewIdx = null;
export let hiDelTarget = null;

// Measurement mode
export let measurementMode = 'repeat';
export let currentStep = 0;
export let sequenceSteps = [];
export let sequenceCycle = 1;

// Step edit state
export let stepEditIdx = null;

// Panel targets
export let tpTarget = null;
export let teTarget = null;
export let selNoteLap = null;

// Navigation
export let curScreen = 'menu';

// Setters for state that needs to be updated from other modules
export function setTags(newTags) { tags = newTags; }
export function setCurrentTempo(val) { currentTempo = val; }
export function setTempoIdx(val) { tempoIdx = val; }
export function setSumDelTarget(val) { sumDelTarget = val; }
export function setSumFilterTags(val) { sumFilterTags = val; }
export function setSumIncludeOutliers(val) { sumIncludeOutliers = val; }
export function setSumDateStr(val) { sumDateStr = val; }
export function setSumTimeStr(val) { sumTimeStr = val; }
export function setHistoryViewIdx(val) { historyViewIdx = val; }
export function setHiDelTarget(val) { hiDelTarget = val; }
export function setMeasurementMode(val) { measurementMode = val; }
export function setCurrentStep(val) { currentStep = val; }
export function setSequenceSteps(val) { sequenceSteps = val; }
export function setSequenceCycle(val) { sequenceCycle = val; }
export function setStepEditIdx(val) { stepEditIdx = val; }
export function setTpTarget(val) { tpTarget = val; }
export function setTeTarget(val) { teTarget = val; }
export function setSelNoteLap(val) { selNoteLap = val; }
export function setCurScreen(val) { curScreen = val; }

// Reset all state
export function resetAllState() {
  // Timer state
  S.laps = [];
  S.started = false;
  S.running = false;
  S.paused = false;
  S.startTime = 0;
  S.totalPaused = 0;
  S.deletedTime = 0;
  S.lastLapTime = 0;
  S.pauseStart = 0;
  S.elapsed = 0;
  S.resumeFromTime = 0;
  S.defaultTag = 0;

  // Animasyon - varsa iptal et
  if (S.raf) {
    cancelAnimationFrame(S.raf);
    S.raf = null;
  }

  // Tags & mode
  tags = loadTags();
  historyViewIdx = null;
  measurementMode = 'repeat';
  currentStep = 0;
  sequenceCycle = 1;
  sequenceSteps = [];
  currentTempo = 100;
  tempoIdx = 10;
}
