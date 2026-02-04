// ===== UTILITY FUNCTIONS =====

import { SVG_ICONS } from './config.js';

// DOM selector shorthand
export const $ = id => document.getElementById(id);

// Time formatting
export function fmt(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export function fms(ms) {
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
  toastC.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

// Vibration feedback
export function vib(ms = 15) {
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

// Get current high-precision time
export function getNow() {
  return performance.now();
}

// Request fullscreen (if not already)
export function goFS() {
  if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) return;
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  else if (el.msRequestFullscreen) el.msRequestFullscreen();
}
