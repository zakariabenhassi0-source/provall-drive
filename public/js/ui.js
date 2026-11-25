// Petits utilitaires d'affichage.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const EUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
export const euro = (n) => EUR.format(Number(n) || 0);
export const num = (n) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 3 });

export const priceLabel = (p) => (p.unit === 'kg' ? `${euro(p.price)} / kg` : euro(p.price));
export const qtyLabel = (unit, q) => (unit === 'kg' ? `${num(q)} kg` : String(q));

export const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const STATUS = {
  recue: { label: 'Reçue' },
  preparation: { label: 'En préparation' },
  prete: { label: 'Prête' },
  arrive: { label: 'Client arrivé' },
  retiree: { label: 'Retirée' },
  annulee: { label: 'Annulée' },
};

export const badge = (status) => `<span class="badge s-${status}">${STATUS[status]?.label || status}</span>`;

export function parseIsoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dayParts(iso) {
  const d = parseIsoDate(iso);
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((d - t0) / 864e5);
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const weekday = d.toLocaleDateString('fr-FR', { weekday: 'short' });
  const top = diff === 0 ? "Aujourd'hui" : diff === 1 ? 'Demain' : weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return { top, bottom: date, diff };
}

export function slotLabel(slot) {
  if (!slot) return '';
  const p = dayParts(slot.date);
  const day = p.diff === 0 || p.diff === 1 ? p.top : `${p.top} ${p.bottom}`;
  return `${day}, ${slot.start}–${slot.end}`;
}

export const time = (iso) => (iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');

export const tempTag = (temp) =>
  temp === 'frais' ? '<span class="tag cold">Frais</span>' : temp === 'surgele' ? '<span class="tag frozen">Surgelé</span>' : '';

export function toast(message) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2800);
  setTimeout(() => el.remove(), 3300);
}

let audioCtx = null;
export function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = [880, 1175];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const t = audioCtx.currentTime + i * 0.18;
      o.frequency.value = f;
      o.connect(g);
      g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.start(t);
      o.stop(t + 0.32);
    });
  } catch {
    /* son indisponible */
  }
}

export function download(filename, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 0);
}
