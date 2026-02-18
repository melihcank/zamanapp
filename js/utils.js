// ===== UTILITY FUNCTIONS =====

import { SVG_ICONS } from './config.js';
import { getSetting } from './settings.js';

// DOM selector shorthand
export const $ = id => document.getElementById(id);

// Time formatting
export function fmt(ms) {
  ms = ms || 0;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export function fms(ms) {
  ms = ms || 0;
  return '.' + String(Math.floor((ms % 1000) / 10)).padStart(2, '0');
}

export function ffull(ms) {
  return fmt(ms) + fms(ms);
}

// Toast notifications
export function toast(msg, cls = '') {
  const toastC = $('toastC');
  const t = document.createElement('div');
  t.className = 'toast' + (cls ? ' ' + cls : '');
  t.textContent = msg;
  const dur = getSetting('ux', 'toastDuration') || 2000;
  const fadeOutStart = Math.max(0, (dur - 500) / 1000);
  t.style.animation = `tIn .25s ease forwards, tOut .25s ease ${fadeOutStart}s forwards`;
  toastC.appendChild(t);
  setTimeout(() => t.remove(), dur);
}

// Vibration feedback
export function vib(ms = 15) {
  if (getSetting('ux', 'vibration') === false) return;
  if (navigator.vibrate) navigator.vibrate(ms);
}

// HTML escape
export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Get tag icon SVG
export function tagIcon(tag) {
  return SVG_ICONS[tag.icon] || SVG_ICONS.tag;
}

// Create dimmed color from hex
export function dimColor(hex, a = 0.15) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// Get current time (Date.now for background reliability)
// performance.now() pauses on iOS Safari when backgrounded/screen off
// Date.now() tracks wall-clock time, survives background suspension
export function getNow() {
  return Date.now();
}

// Request fullscreen (if not already)
export function goFS() {
  if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) return;
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  else if (el.msRequestFullscreen) el.msRequestFullscreen();
}

// Exit fullscreen (if in fullscreen)
export function exitFS() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) return;
  if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
}
