// Écran de préparation (tablette de l'équipe) : file des commandes, liste par rayon,
// pesée, ruptures, remplacements, commande prête, alerte d'arrivée et remise.
import { getState, refresh, setOrder, setStatus, product, category, finalAmount, itemDone, itemTotal } from '../store.js';
import { esc, euro, priceLabel, qtyLabel, badge, slotLabel, time, tempTag, toast, beep } from '../ui.js';

const ui = { tab: 'todo', sel: null, subEdit: null };

const bySlot = (a, b) => (a.slot.date + a.slot.start).localeCompare(b.slot.date + b.slot.start);

export function render() {
  const orders = getState().orders.filter((o) => o.status !== 'annulee');
  const arrivals = orders.filter((o) => o.status === 'arrive').sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
  const groups = {
    todo: orders.filter((o) => o.status === 'recue' || o.status === 'preparation').sort(bySlot),
    ready: orders.filter((o) => o.status === 'prete' || o.status === 'arrive').sort(bySlot),
    done: orders.filter((o) => o.status === 'retiree').sort((a, b) => b.pickedUpAt.localeCompare(a.pickedUpAt)),
  };
  if (!ui.sel || !orders.some((o) => o.id === ui.sel)) ui.sel = arrivals[0]?.id || groups.todo[0]?.id || null;
  const sel = orders.find((o) => o.id === ui.sel);
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const tab = (k, label) =>
    `<button class="tab ${ui.tab === k ? 'on' : ''}" data-action="tab" data-tab="${k}">${label} <span class="pill">${groups[k].length}</span></button>`;

  return `<header class="top staff"><div class="wrap top-in">
      <div class="brand"><span class="logo" aria-hidden="true">P</span><span><b>Préparation</b><small>Proval Drive · ${today}</small></span></div>
      <button class="btn ghost sm" data-action="sound">Tester le son</button>
    </div></header>
    <main class="wrap page">
      ${arrivals
        .map(
          (o) => `<button class="alert" data-action="select" data-id="${o.id}">
            <b>${esc(o.customer.name)} est arrivé · place n° ${o.spot}</b>
            <span>Commande ${o.id}${o.bin ? ` · bac ${esc(o.bin)}` : ''} · signalé à ${time(o.arrivedAt)}</span></button>`,
        )
        .join('')}
      <div class="prep">
        <div class="queue">
          <div class="tabs">${tab('todo', 'À préparer')}${tab('ready', 'Prêtes')}${tab('done', 'Retirées')}</div>
          ${groups[ui.tab].length ? groups[ui.tab].map(queueItem).join('') : '<p class="empty small">Aucune commande.</p>'}
        </div>
        <section class="detail">${
          sel
            ? detail(sel)
            : `<div class="card empty"><p>Aucune commande à traiter.</p>
               <p class="muted small">Passez une commande dans la vue Client (dans un autre onglet), ou générez des commandes de démo dans le Back-office.</p></div>`
        }</section>
      </div>
    </main>`;
}

function queueItem(o) {
  const done = o.items.filter(itemDone).length;
  return `<button class="qitem ${o.id === ui.sel ? 'on' : ''}" data-action="select" data-id="${o.id}">
    <span class="qrow"><b>${esc(slotLabel(o.slot))}</b>${badge(o.status)}</span>
    <span>${esc(o.customer.name)} · ${o.items.length} article${o.items.length > 1 ? 's' : ''}</span>
    <small class="muted">${o.id}${o.status === 'preparation' ? ` · ${done}/${o.items.length} traités` : ''}</small>
  </button>`;
}

function detail(o) {
  const head = `<div class="dhead">
      <div><h2>${o.id} · ${esc(o.customer.name)}</h2>
      <p class="muted small">Retrait ${esc(slotLabel(o.slot))} · ${esc(o.customer.phone)}${o.customer.plate ? ` · ${esc(o.customer.plate)}` : ''}</p></div>
      ${badge(o.status)}</div>`;

  if (o.status === 'recue') {
    return `<div class="card">${head}
      <p>${o.items.length} articles à préparer, estimés à ${euro(o.estimated)}.</p>
      ${summaryList(o, false)}
      <button class="btn block big" data-action="start" data-id="${o.id}">Commencer la préparation</button></div>`;
  }

  if (o.status === 'preparation') {
    const order = o.items.map((it, i) => ({ it, i })).sort((a, b) => a.it.aisle - b.it.aisle || a.it.name.localeCompare(b.it.name));
    let lastCat = null;
    const rows = order
      .map(({ it, i }) => {
        let h = '';
        if (it.cat !== lastCat) {
          lastCat = it.cat;
          const c = category(it.cat);
          h = `<h3 class="aisle">${c ? `${c.emoji} ${esc(c.name)}` : 'Autres'}</h3>`;
        }
        return h + pickRow(o, it, i);
      })
      .join('');
    const done = o.items.filter(itemDone).length;
    const all = done === o.items.length;
    return `<div class="card">${head}
      <div class="progress" aria-label="Progression"><span style="width:${Math.round((done / o.items.length) * 100)}%"></span></div>
      <p class="small muted">${done} / ${o.items.length} articles traités · liste triée dans l'ordre des rayons</p>
      ${rows}
      <div class="readybar">
        <label class="inline">Bac ou emplacement <input id="bin-${o.id}" value="${esc(o.bin)}" placeholder="ex. B3" data-change="bin" data-id="${o.id}"></label>
        <button class="btn big" data-action="ready" data-id="${o.id}" ${all ? '' : 'disabled'}>Commande prête</button>
      </div>
      ${all ? '' : '<p class="note">Traitez chaque article (pris, manquant ou remplacé) et saisissez les poids réels pour terminer.</p>'}
    </div>`;
  }

  if (o.status === 'prete') {
    return `<div class="card">${head}
      <p>Commande prête${o.bin ? `, rangée au <b>bac ${esc(o.bin)}</b>` : ''}. En attente du client.</p>
      <p>Montant débité : <b>${euro(o.final)}</b>${o.capped ? ' (plafonné à l\'empreinte)' : ''} · code de retrait <b>${o.pickupCode}</b></p>
      ${summaryList(o, true)}</div>`;
  }

  if (o.status === 'arrive') {
    return `<div class="card handover">${head}
      <div class="bigspot"><span>Place</span><b>${o.spot}</b>${o.bin ? `<span>Bac ${esc(o.bin)}</span>` : ''}</div>
      <p>Apportez les sacs à la voiture${o.customer.plate ? ` (${esc(o.customer.plate)})` : ''} et vérifiez le code de retrait affiché sur le téléphone du client.</p>
      <form class="codeform" data-submit="handover" data-id="${o.id}">
        <input id="code-${o.id}" name="code" inputmode="numeric" maxlength="4" placeholder="Code à 4 chiffres" autocomplete="off" aria-label="Code de retrait">
        <button class="btn">Valider la remise</button>
      </form>
      <button class="btn ghost sm" data-action="handoverName" data-id="${o.id}">Remise sans code (nom vérifié)</button>
      ${summaryList(o, true)}</div>`;
  }

  return `<div class="card">${head}<p>Retirée à ${time(o.pickedUpAt)} · ${euro(o.final)} débités.</p>${summaryList(o, true)}</div>`;
}

function summaryList(o, prepared) {
  return `<div class="list compact">${o.items
    .map((it) => {
      const note =
        prepared && it.pick === 'missing'
          ? ' <small class="no">manquant</small>'
          : prepared && it.pick === 'sub'
            ? ` <small class="ok">→ ${esc(it.sub.name)}</small>`
            : prepared && it.unit === 'kg'
              ? ` <small class="muted">${qtyLabel('kg', it.actualQty)} pesés</small>`
              : '';
      return `<div class="line"><span class="pic xs" aria-hidden="true">${it.emoji}</span><span class="grow">${esc(it.name)} <small class="muted">${qtyLabel(it.unit, it.qty)}</small>${note}</span>${tempTag(it.temp)}<b class="amount">${euro(prepared ? itemTotal(it) : it.price * it.qty)}</b></div>`;
    })
    .join('')}</div>`;
}

function pickRow(o, it, i) {
  const needWeight = it.unit === 'kg' && (it.pick === 'ok' || it.pick === 'sub');
  const candidates =
    ui.subEdit === `${o.id}:${i}`
      ? getState().products.filter((p) => p.available && p.cat === it.cat && p.id !== it.productId && p.unit === it.unit && p.price <= it.price)
      : null;
  return `<div class="pick ${it.pick ? 'p-' + it.pick : ''}">
    <div class="pic sm" aria-hidden="true">${it.emoji}</div>
    <div class="grow">
      <b>${esc(it.name)}</b> ${tempTag(it.temp)}
      <small class="block">${qtyLabel(it.unit, it.qty)} · ${priceLabel(it)} · ${it.allowSub ? '<span class="ok">remplacement accepté</span>' : '<span class="no">pas de remplacement</span>'}</small>
      ${it.pick === 'sub' ? `<small class="block">→ Remplacé par <b>${esc(it.sub.name)}</b> (${priceLabel(it.sub)})</small>` : ''}
      ${it.pick === 'missing' ? '<small class="block no">Rupture : article retiré de la commande</small>' : ''}
      ${needWeight ? `<label class="inline">Poids réel (kg) <input type="number" id="w-${o.id}-${i}" step="0.005" min="0" value="${it.actualQty ?? ''}" data-change="weight" data-id="${o.id}" data-i="${i}"></label>` : ''}
      ${
        candidates
          ? `<div class="subs">${
              candidates.length
                ? candidates.map((p) => `<button class="chip" data-action="subPick" data-id="${o.id}" data-i="${i}" data-pid="${p.id}">${p.emoji} ${esc(p.name)} · ${priceLabel(p)}</button>`).join('')
                : '<small class="muted">Aucun produit équivalent au même prix ou moins cher : marquez l\'article manquant.</small>'
            }<button class="chip ghost" data-action="subCancel">Annuler</button></div>`
          : ''
      }
    </div>
    <div class="pickbtns">
      <button class="btn sm ${it.pick === 'ok' ? '' : 'ghost'}" data-action="pick" data-id="${o.id}" data-i="${i}" data-v="ok">Pris</button>
      <button class="btn sm ${it.pick === 'missing' ? 'danger' : 'ghost'}" data-action="pick" data-id="${o.id}" data-i="${i}" data-v="missing">Manquant</button>
      ${it.allowSub ? `<button class="btn sm ${it.pick === 'sub' ? '' : 'ghost'}" data-action="subOpen" data-id="${o.id}" data-i="${i}">Remplacer</button>` : ''}
    </div>
  </div>`;
}

function retire(id) {
  setOrder(id, (o) => {
    if (o.status !== 'arrive' && o.status !== 'prete') return;
    o.pickedUpAt = new Date().toISOString();
    setStatus(o, 'retiree');
  });
  toast('Remise enregistrée. Bonne route !');
}

export const actions = {
  tab(el) {
    ui.tab = el.dataset.tab;
    refresh();
  },
  select(el) {
    ui.sel = el.dataset.id;
    ui.subEdit = null;
    refresh();
  },
  sound() {
    beep();
  },
  start(el) {
    setOrder(el.dataset.id, (o) => o.status === 'recue' && setStatus(o, 'preparation'));
  },
  pick(el) {
    const i = Number(el.dataset.i);
    const v = el.dataset.v;
    ui.subEdit = null;
    setOrder(el.dataset.id, (o) => {
      const it = o.items[i];
      it.pick = v;
      it.sub = null;
      if (v === 'missing') it.actualQty = null;
      if (v === 'ok' && it.unit !== 'kg') it.actualQty = it.qty;
    });
  },
  subOpen(el) {
    ui.subEdit = `${el.dataset.id}:${el.dataset.i}`;
    refresh();
  },
  subCancel() {
    ui.subEdit = null;
    refresh();
  },
  subPick(el) {
    const p = product(el.dataset.pid);
    const i = Number(el.dataset.i);
    if (!p) return;
    ui.subEdit = null;
    setOrder(el.dataset.id, (o) => {
      const it = o.items[i];
      it.pick = 'sub';
      it.sub = { productId: p.id, name: p.name, price: p.price, unit: p.unit, emoji: p.emoji };
      it.actualQty = it.unit === 'kg' ? null : it.qty;
    });
  },
  weight(el) {
    const v = parseFloat(String(el.value).replace(',', '.'));
    const i = Number(el.dataset.i);
    setOrder(el.dataset.id, (o) => {
      o.items[i].actualQty = v > 0 ? Math.round(v * 1000) / 1000 : null;
    });
  },
  bin(el) {
    const v = el.value.trim();
    setOrder(el.dataset.id, (o) => (o.bin = v));
  },
  ready(el) {
    let capped = false;
    setOrder(el.dataset.id, (o) => {
      if (!o.items.every(itemDone)) return;
      const total = finalAmount(o);
      o.capped = total > o.preauth;
      capped = o.capped;
      o.final = Math.min(total, o.preauth);
      setStatus(o, 'prete');
    });
    ui.tab = 'ready';
    toast(capped ? 'Commande prête. Montant plafonné à l\'empreinte bancaire.' : 'Commande prête : le client est prévenu.');
  },
  handover(form) {
    const id = form.dataset.id;
    const o = getState().orders.find((x) => x.id === id);
    const code = String(new FormData(form).get('code') || '').trim();
    if (!o) return;
    if (code !== o.pickupCode) {
      toast('Code incorrect. Vérifiez le téléphone du client.');
      return;
    }
    retire(id);
  },
  handoverName(el) {
    if (confirm('Confirmer la remise après vérification du nom du client ?')) retire(el.dataset.id);
  },
};
