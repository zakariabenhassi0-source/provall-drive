// Back-office du responsable : commandes, catalogue (avec import/export CSV), réglages, statistiques.
import { getState, update, refresh, setOrder, setStatus, resetDemo, generateDemoOrders, round2, CATEGORIES, category, REMOTE } from '../store.js';
import { esc, euro, badge, slotLabel, toast, download } from '../ui.js';

const ui = { tab: 'commandes' };
const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export function render() {
  const tab = (k, label) => `<button class="tab ${ui.tab === k ? 'on' : ''}" data-action="tab" data-tab="${k}">${label}</button>`;
  const body = { commandes: ordersTab, catalogue: catalogTab, reglages: settingsTab, stats: statsTab }[ui.tab]();
  return `<header class="top staff admin"><div class="wrap top-in">
      <div class="brand"><span class="logo" aria-hidden="true">P</span><span><b>Back-office</b><small>Proval Drive · responsable</small></span></div>
    </div></header>
    <main class="wrap page">
      <div class="tabs wide">${tab('commandes', 'Commandes')}${tab('catalogue', 'Catalogue')}${tab('reglages', 'Réglages')}${tab('stats', 'Statistiques')}</div>
      ${body}
    </main>`;
}

// ---------- Commandes ----------

function ordersTab() {
  const orders = [...getState().orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!orders.length)
    return `<div class="card empty"><p>Aucune commande pour l'instant.</p>${REMOTE ? '' : '<button class="btn" data-action="demo">Générer 3 commandes de démo</button>'}</div>`;
  return `${REMOTE ? '' : '<div class="toolbar"><button class="btn ghost sm" data-action="demo">Générer 3 commandes de démo</button></div>'}
    <div class="card tablewrap"><table>
    <thead><tr><th>N°</th><th>Client</th><th>Retrait</th><th>Statut</th><th class="num">Estimé</th><th class="num">Débité</th><th></th></tr></thead>
    <tbody>${orders
      .map(
        (o) => `<tr>
        <td><b>${o.id}</b></td>
        <td>${esc(o.customer.name)}<br><small class="muted">${esc(o.customer.phone)}</small></td>
        <td>${esc(slotLabel(o.slot))}</td>
        <td>${badge(o.status)}${o.refunded ? ' <span class="badge s-annulee">Remboursée</span>' : ''}</td>
        <td class="num">${euro(o.estimated)}</td>
        <td class="num">${o.final != null ? euro(o.final) : '—'}</td>
        <td class="right">${
          o.status === 'retiree' && !o.refunded
            ? `<button class="btn sm ghost" data-action="refund" data-id="${o.id}">Rembourser</button>`
            : o.status !== 'retiree' && o.status !== 'annulee'
              ? `<button class="btn sm ghost" data-action="cancelOrder" data-id="${o.id}">Annuler</button>`
              : ''
        }</td></tr>`,
      )
      .join('')}</tbody></table></div>`;
}

// ---------- Catalogue ----------

function catalogTab() {
  const products = [...getState().products].sort(
    (a, b) => (category(a.cat)?.aisle || 99) - (category(b.cat)?.aisle || 99) || a.name.localeCompare(b.name),
  );
  return `<div class="toolbar">
      <button class="btn ghost sm" data-action="exportCsv">Exporter en CSV</button>
      <label class="btn ghost sm">Importer un CSV<input type="file" accept=".csv,text/csv" hidden data-change="importCsv"></label>
      <span class="muted small">Format : id;nom;rayon;prix;unite;format;origine;temperature;disponible;emoji</span>
    </div>
    <div class="card tablewrap"><table>
      <thead><tr><th>Produit</th><th>Rayon</th><th class="num">Prix (€)</th><th>Unité</th><th>Disponible</th><th></th></tr></thead>
      <tbody>${products
        .map(
          (p) => `<tr class="${p.available ? '' : 'dim'}">
          <td>${p.emoji} <b>${esc(p.name)}</b><br><small class="muted">${esc([p.format, p.origin].filter(Boolean).join(' · '))}</small></td>
          <td>${esc(category(p.cat)?.name || p.cat)}</td>
          <td class="num"><input class="price" type="number" step="0.01" min="0" id="price-${p.id}" value="${p.price}" data-change="price" data-id="${p.id}" aria-label="Prix de ${esc(p.name)}"></td>
          <td>${p.unit === 'kg' ? 'au kg' : 'pièce'}</td>
          <td><label class="switch"><input type="checkbox" id="av-${p.id}" data-change="avail" data-id="${p.id}" ${p.available ? 'checked' : ''}><span aria-hidden="true"></span><em class="sr">Disponible</em></label></td>
          <td class="right"><button class="icon" data-action="delProduct" data-id="${p.id}" aria-label="Supprimer ${esc(p.name)}">✕</button></td>
        </tr>`,
        )
        .join('')}</tbody></table></div>
    <form class="card form grid-form" data-submit="addProduct">
      <h2>Ajouter un produit</h2>
      <label>Nom<input name="name" required></label>
      <label>Rayon<select name="cat">${CATEGORIES.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
      <label>Prix (€)<input name="price" type="number" step="0.01" min="0" required></label>
      <label>Unité<select name="unit"><option value="piece">Pièce</option><option value="kg">Au kilo</option></select></label>
      <label>Format<input name="format" placeholder="ex. 500 g"></label>
      <label>Origine<input name="origin" placeholder="ex. France"></label>
      <label>Température<select name="temp"><option value="sec">Sec</option><option value="frais">Frais</option><option value="surgele">Surgelé</option></select></label>
      <label>Emoji<input name="emoji" value="🛒" maxlength="4"></label>
      <button class="btn">Ajouter au catalogue</button>
    </form>`;
}

const CSV_HEAD = ['id', 'nom', 'rayon', 'prix', 'unite', 'format', 'origine', 'temperature', 'disponible', 'emoji'];

function toCsv(products) {
  const cell = (v) => {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = products.map((p) =>
    [p.id, p.name, p.cat, String(p.price).replace('.', ','), p.unit, p.format, p.origin, p.temp, p.available ? 'oui' : 'non', p.emoji].map(cell).join(';'),
  );
  return [CSV_HEAD.join(';'), ...rows].join('\n');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ';') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

// ---------- Réglages ----------

function settingsTab() {
  const s = getState().settings;
  const n = (name, label, attrs) => `<label>${label}<input type="number" name="${name}" value="${s[name]}" ${attrs} required></label>`;
  return `<form class="card form grid-form" data-submit="saveSettings">
      <h2>Créneaux de retrait</h2>
      <label>Ouverture du drive<input type="time" name="open" value="${s.open}" required></label>
      <label>Fermeture du drive<input type="time" name="close" value="${s.close}" required></label>
      ${n('slotMinutes', 'Durée d\'un créneau (min)', 'min="10" max="120" step="5"')}
      ${n('capacity', 'Commandes max par créneau', 'min="1" max="50"')}
      ${n('leadHours', 'Délai minimum avant retrait (h)', 'min="0" max="48"')}
      ${n('daysAhead', 'Réservation possible (jours)', 'min="1" max="30"')}
      <fieldset class="full"><legend>Jours de fermeture du drive</legend>
        ${DAYS.map((d, i) => `<label class="check"><input type="checkbox" name="closed" value="${i}" ${s.closedDays.includes(i) ? 'checked' : ''}> ${d}</label>`).join('')}
      </fieldset>
      <h2>Commande et retrait</h2>
      ${n('minOrder', 'Minimum de commande (€)', 'min="0" step="1"')}
      ${n('parkingSpots', 'Places de retrait', 'min="1" max="20"')}
      <label>Marge d'empreinte, produits au poids (%)<input type="number" name="weightMargin" value="${Math.round(s.weightMargin * 100)}" min="0" max="50" required></label>
      <button class="btn">Enregistrer les réglages</button>
    </form>`;
}

// ---------- Statistiques ----------

function statsTab() {
  const orders = getState().orders;
  const valid = orders.filter((o) => o.status !== 'annulee');
  const done = valid.filter((o) => o.status === 'retiree' && !o.refunded);
  const revenue = round2(done.reduce((sum, o) => sum + (o.final || 0), 0));
  const avg = done.length ? revenue / done.length : 0;
  const prepared = valid.filter((o) => ['prete', 'arrive', 'retiree'].includes(o.status));
  const items = prepared.flatMap((o) => o.items);
  const missing = items.filter((it) => it.pick === 'missing').length;
  const rate = items.length ? Math.round((missing / items.length) * 1000) / 10 : 0;
  const counts = {};
  for (const o of valid) for (const it of o.items) counts[it.name] = (counts[it.name] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const tile = (label, value) => `<div class="card tile"><span>${label}</span><b>${value}</b></div>`;
  return `<div class="tiles">
      ${tile('Commandes (hors annulées)', valid.length)}
      ${tile('Commandes retirées', done.length)}
      ${tile("Chiffre d'affaires retiré", euro(revenue))}
      ${tile('Panier moyen', euro(avg))}
      ${tile('Taux de rupture', `${String(rate).replace('.', ',')} %`)}
    </div>
    <div class="cols">
      <div class="card"><h2>Produits les plus commandés</h2>${
        top.length
          ? `<table><thead><tr><th>Produit</th><th class="num">Commandes</th></tr></thead><tbody>${top.map(([name, c]) => `<tr><td>${esc(name)}</td><td class="num">${c}</td></tr>`).join('')}</tbody></table>`
          : '<p class="muted">Pas encore de données.</p>'
      }</div>
      ${
        REMOTE
          ? `<div class="card"><h2>Base de données</h2><p class="muted small">Connecté à Supabase : les données sont partagées en temps réel entre tous les appareils. Les statistiques portent sur les 300 dernières commandes.</p></div>`
          : `<div class="card"><h2>Démonstration</h2>
        <p class="muted small">Mode local : les données sont enregistrées dans ce navigateur uniquement.</p>
        <button class="btn ghost block" data-action="demo">Générer 3 commandes de démo</button>
        <button class="btn danger block" data-action="reset">Réinitialiser la démo</button>
      </div>`
      }
    </div>`;
}

// ---------- Actions ----------

export const actions = {
  tab(el) {
    ui.tab = el.dataset.tab;
    refresh();
  },
  demo() {
    const n = generateDemoOrders(3);
    toast(n ? `${n} commandes de démo créées. Ouvrez la vue Préparation.` : 'Aucun créneau libre pour créer des commandes.');
  },
  reset() {
    if (confirm('Réinitialiser la démo ? Les commandes, le panier et les modifications du catalogue seront effacés.')) {
      resetDemo();
      toast('Démo réinitialisée');
    }
  },
  cancelOrder(el) {
    if (!confirm(`Annuler la commande ${el.dataset.id} ? L'empreinte bancaire sera libérée (simulation).`)) return;
    setOrder(el.dataset.id, (o) => setStatus(o, 'annulee'));
    toast('Commande annulée');
  },
  refund(el) {
    if (!confirm(`Rembourser la commande ${el.dataset.id} (simulation) ?`)) return;
    setOrder(el.dataset.id, (o) => (o.refunded = true));
    toast('Remboursement enregistré (simulation)');
  },
  price(el) {
    const v = parseFloat(String(el.value).replace(',', '.'));
    if (!(v >= 0)) return toast('Prix invalide');
    update((st) => {
      const p = st.products.find((x) => x.id === el.dataset.id);
      if (p) p.price = round2(v);
    });
    toast('Prix mis à jour');
  },
  avail(el) {
    update((st) => {
      const p = st.products.find((x) => x.id === el.dataset.id);
      if (p) p.available = el.checked;
    });
  },
  delProduct(el) {
    const p = getState().products.find((x) => x.id === el.dataset.id);
    if (!p || !confirm(`Supprimer « ${p.name} » du catalogue ?`)) return;
    update((st) => (st.products = st.products.filter((x) => x.id !== p.id)));
  },
  addProduct(form) {
    const fd = new FormData(form);
    const unit = fd.get('unit') === 'kg' ? 'kg' : 'piece';
    const name = String(fd.get('name')).trim();
    const price = parseFloat(String(fd.get('price')).replace(',', '.'));
    if (!name || !(price >= 0)) return toast('Nom ou prix invalide');
    update((st) =>
      st.products.push({
        id: 'p' + Date.now().toString(36),
        name,
        cat: String(fd.get('cat')),
        price: round2(price),
        unit,
        step: unit === 'kg' ? 0.25 : 1,
        available: true,
        temp: String(fd.get('temp')),
        format: String(fd.get('format') || '').trim(),
        origin: String(fd.get('origin') || '').trim(),
        emoji: String(fd.get('emoji') || '🛒').trim() || '🛒',
      }),
    );
    form.reset();
    toast(`« ${name} » ajouté au catalogue`);
  },
  exportCsv() {
    download('catalogue-proval-drive.csv', toCsv(getState().products));
  },
  importCsv(el) {
    const file = el.files && el.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result));
      const head = rows.shift()?.map((h) => h.trim().toLowerCase()) || [];
      const col = (r, k) => (r[head.indexOf(k)] ?? '').trim();
      if (!head.includes('nom') || !head.includes('prix')) return toast('Fichier non reconnu : colonnes « nom » et « prix » requises.');
      let added = 0, updated = 0, skipped = 0;
      update((st) => {
        for (const r of rows) {
          const price = parseFloat(col(r, 'prix').replace(',', '.'));
          const name = col(r, 'nom');
          if (!name || !(price >= 0)) { skipped++; continue; }
          const catRaw = col(r, 'rayon');
          const cat = CATEGORIES.find((c) => c.id === catRaw || c.name.toLowerCase() === catRaw.toLowerCase())?.id || 'epicerie';
          const unit = col(r, 'unite').toLowerCase().startsWith('kg') ? 'kg' : 'piece';
          const temp = ['sec', 'frais', 'surgele'].includes(col(r, 'temperature')) ? col(r, 'temperature') : 'sec';
          const fields = {
            name, cat, price: round2(price), unit, step: unit === 'kg' ? 0.25 : 1, temp,
            format: col(r, 'format'), origin: col(r, 'origine'),
            available: !/^(non|0|false)$/i.test(col(r, 'disponible')),
            emoji: col(r, 'emoji') || '🛒',
          };
          const id = col(r, 'id');
          const existing = id && st.products.find((p) => p.id === id);
          if (existing) { Object.assign(existing, fields); updated++; }
          else { st.products.push({ id: id || 'p' + Date.now().toString(36) + added, ...fields }); added++; }
        }
      });
      toast(`Import : ${added} ajouté(s), ${updated} mis à jour, ${skipped} ignoré(s)`);
    };
    reader.readAsText(file, 'utf-8');
    el.value = '';
  },
  saveSettings(form) {
    const fd = new FormData(form);
    const int = (k) => parseInt(fd.get(k), 10);
    const open = String(fd.get('open'));
    const close = String(fd.get('close'));
    if (open >= close) return toast("L'heure de fermeture doit être après l'ouverture.");
    update((st) => {
      Object.assign(st.settings, {
        open, close,
        slotMinutes: int('slotMinutes'),
        capacity: int('capacity'),
        leadHours: int('leadHours'),
        daysAhead: int('daysAhead'),
        minOrder: Number(fd.get('minOrder')),
        parkingSpots: int('parkingSpots'),
        weightMargin: int('weightMargin') / 100,
        closedDays: fd.getAll('closed').map(Number),
      });
    });
    toast('Réglages enregistrés');
  },
};
