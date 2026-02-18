// ===== NAVIGATION =====

import { $, toast } from './utils.js';
import { curScreen, setCurScreen } from './state.js';

// Screen elements
export const screens = {
  menu: null,
  settings: null,
  settingsMeasure: null,
  settingsStats: null,
  settingsExcel: null,
  settingsUx: null,
  modeSelect: null,
  setup: null,
  stepSetup: null,
  tagEditor: null,
  history: null,
  measure: null,
  summary: null
};

// Initialize screens (call after DOM loaded)
export function initScreens() {
  screens.menu = $('menuScreen');
  screens.settings = $('settingsScreen');
  screens.settingsMeasure = $('settingsMeasureScreen');
  screens.settingsStats = $('settingsStatsScreen');
  screens.settingsExcel = $('settingsExcelScreen');
  screens.settingsUx = $('settingsUxScreen');
  screens.modeSelect = $('modeSelectScreen');
  screens.setup = $('setupScreen');
  screens.stepSetup = $('stepSetupScreen');
  screens.tagEditor = $('tagEditorScreen');
  screens.history = $('historyScreen');
  screens.measure = $('measureScreen');
  screens.summary = $('summaryScreen');
}

// Show a specific screen
export function showScreen(name, push = true) {
  Object.entries(screens).forEach(([k, el]) => {
    if (el) {
      el.classList.remove('visible');
      el.classList.add('hidden');
    }
  });
  if (screens[name]) {
    screens[name].classList.remove('hidden');
    screens[name].classList.add('visible');
  }
  if (push && name !== curScreen) {
    history.pushState({ screen: name }, '', '#' + name);
  }
  setCurScreen(name);
}

// Check if any panel is open
export function isPanel() {
  return $('notePanel')?.classList.contains('open') ||
    $('tpPanel')?.classList.contains('open') ||
    $('finModal')?.classList.contains('open') ||
    $('sumDelModal')?.classList.contains('open') ||
    $('hiDelModal')?.classList.contains('open') ||
    $('tePanel')?.classList.contains('open') ||
    $('stepPanel')?.classList.contains('open') ||
    $('stepChoiceModal')?.classList.contains('open') ||
    $('settingsInfoModal')?.classList.contains('open') ||
    $('recoveryModal')?.classList.contains('open');
}

// Close all panels
export function closePanels() {
  const tpPanel = $('tpPanel');
  const tpOv = $('tpOv');
  if (tpPanel?.classList.contains('open')) {
    tpOv?.classList.remove('open');
    tpPanel.classList.remove('open');
    tpPanel.style.transform = 'translateX(-50%) translateY(100%)';
    return true;
  }

  const tePanel = $('tePanel');
  const teOv = $('teOv');
  if (tePanel?.classList.contains('open')) {
    teOv?.classList.remove('open');
    tePanel.classList.remove('open');
    tePanel.style.transform = 'translateX(-50%) translateY(100%)';
    return true;
  }

  const stepPanel = $('stepPanel');
  const stepOv = $('stepOv');
  if (stepPanel?.classList.contains('open')) {
    stepOv?.classList.remove('open');
    stepPanel.classList.remove('open');
    stepPanel.style.transform = 'translateX(-50%) translateY(100%)';
    return true;
  }

  const notePanel = $('notePanel');
  const noteOv = $('noteOv');
  const noteTa = $('noteTa');
  if (notePanel?.classList.contains('open')) {
    noteOv?.classList.remove('open');
    notePanel.classList.remove('open');
    noteTa?.blur();
    return true;
  }

  const finModal = $('finModal');
  if (finModal?.classList.contains('open')) {
    finModal.classList.remove('open');
    return true;
  }

  const sumDelModal = $('sumDelModal');
  if (sumDelModal?.classList.contains('open')) {
    sumDelModal.classList.remove('open');
    return true;
  }

  const hiDelModal = $('hiDelModal');
  if (hiDelModal?.classList.contains('open')) {
    hiDelModal.classList.remove('open');
    return true;
  }

  const stepChoiceModal = $('stepChoiceModal');
  if (stepChoiceModal?.classList.contains('open')) {
    stepChoiceModal.classList.remove('open');
    return true;
  }

  const settingsInfoModal = $('settingsInfoModal');
  if (settingsInfoModal?.classList.contains('open')) {
    settingsInfoModal.classList.remove('open');
    return true;
  }

  const recoveryModal = $('recoveryModal');
  if (recoveryModal?.classList.contains('open')) {
    recoveryModal.classList.remove('open');
    return true;
  }

  return false;
}

// Push panel state to history
export function pushPanel() {
  history.pushState({ panel: true, screen: curScreen }, '');
}

// Handle browser back/forward
export function initPopState() {
  history.replaceState({ screen: 'menu' }, '', '#menu');

  window.addEventListener('popstate', e => {
    if (isPanel()) {
      closePanels();
      history.replaceState({ screen: curScreen }, '', '#' + curScreen);
      return;
    }
    const t = e.state?.screen;
    if (t && screens[t]) {
      showScreen(t, false);
    } else if (curScreen === 'menu') {
      history.pushState({ screen: 'menu' }, '', '#menu');
      toast('Çıkmak için ana ekran tuşunu kullanın', 't-wrn');
    } else {
      showScreen('menu', false);
      history.replaceState({ screen: 'menu' }, '', '#menu');
    }
  });
}
