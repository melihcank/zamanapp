// ===== SEQUENCE MODE STEPS =====

import { $, toast, vib, esc } from './utils.js';
import { STEP_COLORS } from './config.js';
import {
  sequenceSteps, setSequenceSteps,
  currentStep, setCurrentStep,
  sequenceCycle, setSequenceCycle,
  stepEditIdx, setStepEditIdx
} from './state.js';
import { pushPanel } from './nav.js';

// Initialize sequence mode
export function initSequenceMode() {
  // Initialize with 4 default numbered steps if empty
  if (!sequenceSteps.length) {
    setSequenceSteps([
      { name: 'Adım 1', color: STEP_COLORS[0] },
      { name: 'Adım 2', color: STEP_COLORS[1] },
      { name: 'Adım 3', color: STEP_COLORS[2] },
      { name: 'Adım 4', color: STEP_COLORS[3] }
    ]);
  }
  setCurrentStep(0);
  setSequenceCycle(1);
  renderStepIndicator();
  // Bind step name click
  $('stepName').onclick = () => openStepNameEdit(currentStep);
}

// Render step indicator
export function renderStepIndicator() {
  const dots = $('stepDots');
  if (!dots) return;

  dots.innerHTML = '';
  sequenceSteps.forEach((step, i) => {
    const dot = document.createElement('div');
    dot.className = 'step-dot';
    if (i === currentStep) dot.classList.add('active');
    else if (i < currentStep || (sequenceCycle > 1 && i >= currentStep)) dot.classList.add('done');
    dot.onclick = () => openStepNameEdit(i);
    dot.style.cursor = 'pointer';
    dot.title = step.name;
    dots.appendChild(dot);
  });

  // Add button to add more steps
  const addBtn = document.createElement('button');
  addBtn.className = 'step-add';
  addBtn.innerHTML = '+';
  addBtn.title = 'Yeni adım ekle';
  addBtn.onclick = addNewStep;
  dots.appendChild(addBtn);

  const curStep = sequenceSteps[currentStep];
  $('stepName').textContent = curStep ? curStep.name : '—';
  $('stepCycle').textContent = 'Çevrim ' + sequenceCycle;
}

// Add new step
export function addNewStep() {
  const newIdx = sequenceSteps.length;
  const color = STEP_COLORS[newIdx % STEP_COLORS.length];
  const newSteps = [...sequenceSteps, { name: 'Adım ' + (newIdx + 1), color }];
  setSequenceSteps(newSteps);
  renderStepIndicator();
  toast('Yeni adım eklendi', 't-ok');
  vib(15);
}

// Open step name edit panel
export function openStepNameEdit(idx) {
  setStepEditIdx(idx);
  const step = sequenceSteps[idx];
  $('stepPanelTitle').textContent = 'Adım ' + (idx + 1) + ' Adını Düzenle';
  $('stepNameInput').value = step.name;
  $('stepOv').classList.add('open');
  $('stepPanel').classList.add('open');
  $('stepPanel').style.transform = 'translateX(-50%) translateY(0)';
  $('stepNameInput').focus();
  pushPanel();
}

// Close step name edit panel
export function closeStepPanel() {
  $('stepOv').classList.remove('open');
  $('stepPanel').classList.remove('open');
  $('stepPanel').style.transform = 'translateX(-50%) translateY(100%)';
  setStepEditIdx(null);
}

// Save step name
export function saveStepName() {
  if (stepEditIdx === null) return;
  const newName = $('stepNameInput').value.trim() || ('Adım ' + (stepEditIdx + 1));
  const newSteps = [...sequenceSteps];
  newSteps[stepEditIdx].name = newName;
  setSequenceSteps(newSteps);
  closeStepPanel();
  renderStepIndicator();
  toast('Adım adı güncellendi', 't-ok');
}

// Advance to next step
export function advanceStep() {
  let step = currentStep + 1;
  let cycle = sequenceCycle;
  if (step >= sequenceSteps.length) {
    step = 0;
    cycle++;
    setSequenceCycle(cycle);
  }
  setCurrentStep(step);
  renderStepIndicator();
}

// Initialize step panel events
export function initStepPanelEvents() {
  $('stepOv').onclick = closeStepPanel;
  $('stepSaveBtn').onclick = saveStepName;
}
