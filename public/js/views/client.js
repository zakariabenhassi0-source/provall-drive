// Espace client : catalogue, panier, créneau, paiement simulé, suivi et « Je suis arrivé ».
import {
  getState, getCart, updateCart, refresh, product, cartSummary, availableSlots, isSlotBookable,
  placeOrder, customerArrived, customerCancel, reorder, itemTotal, ensureSlotCounts, sendMagicLink,
  auth, REMOTE, CATEGORIES,
} from '../store.js';
import { esc, euro, priceLabel, qtyLabel, norm, toast, badge, slotLabel, dayParts, tempTag, time } from '../ui.js';

const ui = { q: '', cat: 'all', day: null, slot: null, spot: null, form: {}, linkSent: null, busy: false };

// En mode Supabase, commander et suivre ses commandes demande d'être connecté (lien par email).
const needLogin = () => REMOTE && !auth.user;

function loginCard(reason) {
  if (ui.linkSent)
    return `<div class="card empty"><h2>Vérifiez vos emails</h2>
      <p>Un lien de connexion a été envoyé à <b>${esc(ui.linkSent)}</b>. Ouvrez-le dans ce même navigateur.</p>
      <button class="btn ghost" data-action="resetLink">Utiliser une autre adresse</button></div>`;
  return `<form class="card form narrow" data-submit="magicLink">
      <h2>Connexion</h2>
      <p class="muted">${reason}</p>
      <label>Email<input id="login-email" name="email" type="email" required autocomplete="email"></label>
      <button class="btn block" ${ui.busy ? 'disabled' : ''}>Recevoir un lien de connexion</button>
      <p class="note">Pas de mot de passe : vous recevez un lien par email, valable une fois.</p>
    </form>`;
}

export function render([page, arg]) {
  let body;
  switch (page) {
    case 'panier': body = cartPage(); break;
    case 'creneau': body = slotPage(); break;
    case 'paiement': body = paymentPage(); break;
    case 'commande': body = orderPage(arg); break;
    case 'commandes': body = ordersPage(); break;
    default: body = catalogue();
  }
  return header(page) + `<main class="wrap page">${body}</main>` + (page === 'catalogue' ? cartBar() : '');
}

function header(page) {
  const s = cartSummary();
  const on = (cond) => (cond ? 'on' : '');
  return `<header class="top"><div class="wrap top-in">
    <a href="#/" class="brand"><span class="logo" aria-hidden="true">P</span><span><b>Proval Drive</b><small>Metz-Vallières</small></span></a>
    <nav class="topnav" aria-label="Navigation client">
      <a href="#/" class="${on(page === 'catalogue')}">Catalogue</a>
      <a href="#/commandes" class="${on(page === 'commandes' || page === 'commande')}">Mes commandes</a>
      <a href="#/panier" class="cartlink ${on(page === 'panier')}">Panier <span class="pill">${s.count}</span></a>
    </nav></div></header>`;
}

function cartBar() {
  const s = cartSummary();
  if (!s.count) return '';
  return `<a class="cartbar" href="#/panier"><span>${s.count} article${s.count > 1 ? 's' : ''}</span><b>Voir le panier · ${euro(s.estimated)}</b></a>`;
}

const emptyCart = () =>
  `<div class="card empty"><p>Votre panier est vide.</p><a class="btn" href="#/">Parcourir le catalogue</a></div>`;

// ---------- Catalogue ----------

function catalogue() {
  const st = getState();
  const q = norm(ui.q.trim());
  const list = st.products.filter((p) => (ui.cat === 'all' || p.cat === ui.cat) && (!q || norm(p.name).includes(q)));
  return `<section class="hero">
      <h1>Vos courses prêtes, sans sortir de la voiture</h1>
      <p>Commandez en ligne, choisissez un créneau : on vous apporte vos sacs sur le parking.</p>
    </section>
    <div class="search"><input id="q" type="search" placeholder="Rechercher un produit (tomates, lait…)" value="${esc(ui.q)}" data-input="search" autocomplete="off" aria-label="Rechercher un produit"></div>
    <div class="chips" role="tablist">
      <button class="chip ${ui.cat === 'all' ? 'on' : ''}" data-action="cat" data-cat="all">Tout</button>
      ${CATEGORIES.map((c) => `<button class="chip ${ui.cat === c.id ? 'on' : ''}" data-action="cat" data-cat="${c.id}">${c.emoji} ${esc(c.name)}</button>`).join('')}
    </div>
    ${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : `<p class="empty">Aucun produit ne correspond à « ${esc(ui.q)} ».</p>`}`;
}

function card(p) {
  const line = getCart().find((l) => l.productId === p.id);
  const ctrl = !p.available
    ? '<span class="muted small">Indisponible</span>'
    : line
      ? stepper(p, line.qty)
      : `<button class="btn sm" data-action="add" data-id="${p.id}">Ajouter</button>`;
  return `<article class="card product ${p.available ? '' : 'off'}">
    <div class="pic" aria-hidden="true">${p.emoji}</div>
    <div class="pbody">
      <h3>${esc(p.name)}</h3>
      <p class="meta">${esc([p.format, p.origin].filter(Boolean).join(' · ')) || '&nbsp;'}</p>
      <div class="tags">${p.unit === 'kg' ? '<span class="tag">Au poids</span>' : ''}${tempTag(p.temp)}</div>
    </div>
    <div class="pfoot"><strong>${priceLabel(p)}</strong>${ctrl}</div>
  </article>`;
}

function stepper(p, q) {
  return `<div class="stepper"><button data-action="dec" data-id="${p.id}" aria-label="Diminuer ${esc(p.name)}">−</button><span>${qtyLabel(p.unit, q)}</span><button data-action="inc" data-id="${p.id}" aria-label="Augmenter ${esc(p.name)}">+</button></div>`;
}

function changeQty(id, dir) {
  const p = product(id);
  if (!p) return;
  updateCart((c) => {
    const l = c.find((x) => x.productId === id);
    if (!l) return;
    const step = p.unit === 'kg' ? p.step : 1;
    const max = p.max || (p.unit === 'kg' ? 5 : 10);
    l.qty = Math.round((l.qty + dir * step) * 100) / 100;
    if (l.qty > max) {
      l.qty = max;
      toast(`Maximum ${qtyLabel(p.unit, max)} pour ce produit`);
    }
    if (l.qty <= 0) c.splice(c.indexOf(l), 1);
  });
}

// ---------- Panier ----------

function cartPage() {
  const c = getCart();
  if (!c.length) return `<h1>Mon panier</h1>${emptyCart()}`;
  const st = getState();
  const s = cartSummary();
  const min = st.settings.minOrder;
  const below = s.estimated < min;
  const hasKg = c.some((l) => product(l.productId)?.unit === 'kg');
  const lines = c
    .map((l) => {
      const p = product(l.productId);
      if (!p) return '';
      return `<div class="line">
        <div class="pic sm" aria-hidden="true">${p.emoji}</div>
        <div class="grow">
          <b>${esc(p.name)}</b> <small class="muted">${priceLabel(p)}</small>
          <label class="check"><input type="checkbox" id="sub-${p.id}" data-change="toggleSub" data-id="${p.id}" ${l.allowSub ? 'checked' : ''}> Accepter un produit de remplacement</label>
        </div>
        ${stepper(p, l.qty)}
        <b class="amount">${euro(p.price * l.qty)}</b>
        <button class="icon" data-action="remove" data-id="${p.id}" aria-label="Retirer ${esc(p.name)}">✕</button>
      </div>`;
    })
    .join('');
  return `<h1>Mon panier</h1><div class="cols">
    <div class="card list">${lines}</div>
    <aside class="card summary">
      <div class="sumrow"><span>Total estimé</span><b>${euro(s.estimated)}</b></div>
      ${hasKg ? `<p class="note">Produits au poids : le montant final est ajusté après la pesée. L'empreinte bancaire peut aller jusqu'à ${euro(s.preauth)} (+${Math.round(st.settings.weightMargin * 100)} % sur ces produits).</p>` : ''}
      ${below ? `<p class="warn">Minimum de commande : ${euro(min)}. Il manque ${euro(min - s.estimated)}.</p>` : ''}
      ${below ? `<span class="btn block disabled" aria-disabled="true">Choisir un créneau de retrait</span>` : `<a class="btn block" href="#/creneau">Choisir un créneau de retrait</a>`}
      <button class="btn ghost block" data-action="clearCart">Vider le panier</button>
    </aside></div>`;
}

// ---------- Créneau ----------

function slotPage() {
  if (!getCart().length) return `<h1>Créneau de retrait</h1>${emptyCart()}`;
  ensureSlotCounts();
  const st = getState();
  const days = availableSlots();
  const usable = days.filter((d) => d.slots.some((s) => !s.full && !s.tooSoon));
  if (!ui.day || !days.some((d) => d.date === ui.day)) ui.day = (usable[0] || days[0])?.date || null;
  const day = days.find((d) => d.date === ui.day);
  const slotButtons = day
    ? day.slots
        .map((s) => {
          const off = s.full || s.tooSoon;
          const on = ui.slot && ui.slot.date === s.date && ui.slot.start === s.start;
          const left = st.settings.capacity - s.booked;
          const info = s.tooSoon ? 'Trop tôt' : s.full ? 'Complet' : `${left} place${left > 1 ? 's' : ''}`;
          return `<button class="slot ${on ? 'on' : ''}" ${off ? 'disabled' : ''} data-action="slot" data-date="${s.date}" data-start="${s.start}" data-end="${s.end}"><b>${s.start} – ${s.end}</b><small>${info}</small></button>`;
        })
        .join('')
    : '<p class="muted">Aucun créneau disponible.</p>';
  return `<h1>Créneau de retrait</h1>
    <p class="muted">Retrait sur le parking du Proval, Metz-Vallières. Créneaux de ${st.settings.slotMinutes} minutes, au moins ${st.settings.leadHours} h après la commande.</p>
    <div class="days">${days
      .map((d) => {
        const p = dayParts(d.date);
        return `<button class="day ${d.date === ui.day ? 'on' : ''}" data-action="day" data-date="${d.date}"><b>${p.top}</b><span>${p.bottom}</span></button>`;
      })
      .join('')}</div>
    <div class="slots">${slotButtons}</div>
    <div class="actionsbar">
      <a class="btn ghost" href="#/panier">← Panier</a>
      ${ui.slot ? `<a class="btn" href="#/paiement">Continuer · ${esc(slotLabel(ui.slot))}</a>` : '<span class="btn disabled" aria-disabled="true">Choisissez un créneau</span>'}
    </div>`;
}

// ---------- Paiement (simulé) ----------

function paymentPage() {
  if (!getCart().length) return `<h1>Validation</h1>${emptyCart()}`;
  if (!ui.slot)
    return `<h1>Validation</h1><div class="card empty"><p>Choisissez d'abord un créneau de retrait.</p><a class="btn" href="#/creneau">Choisir un créneau</a></div>`;
  if (needLogin()) return `<h1>Validation</h1>${loginCard('Connectez-vous pour valider votre commande. Votre panier et votre créneau sont conservés.')}`;
  const st = getState();
  const s = cartSummary();
  const c = { ...(st.customer || {}), ...ui.form };
  if (REMOTE) c.email = auth.user.email;
  const field = (name, label, attrs = '') =>
    `<label>${label}<input id="f-${name}" name="${name}" value="${esc(c[name] || '')}" data-input="formField" ${attrs}></label>`;
  return `<h1>Validation et paiement</h1><div class="cols">
    <form class="card form" data-submit="pay">
      <h2>Vos coordonnées</h2>
      ${field('name', 'Nom et prénom', 'required autocomplete="name"')}
      ${field('phone', 'Téléphone', 'type="tel" required autocomplete="tel"')}
      ${field('email', 'Email', `type="email" required autocomplete="email" ${REMOTE ? 'readonly' : ''}`)}
      ${field('plate', 'Immatriculation <span class="muted">(facultatif, pour vous reconnaître)</span>', 'autocomplete="off"')}
      <h2>Paiement</h2>
      <div class="sim"><b>Paiement simulé</b>
        <p>Ce prototype ne demande aucune carte bancaire. Dans la version finale, le formulaire sécurisé du prestataire de paiement (3D Secure) s'affichera ici et bloquera une empreinte de ${euro(s.preauth)}.</p></div>
      <label class="check"><input type="checkbox" id="f-cgv" required> J'accepte les conditions générales de vente</label>
      <button class="btn block big" type="submit" ${ui.busy ? 'disabled' : ''}>${ui.busy ? 'Validation…' : 'Confirmer la commande (paiement simulé)'}</button>
    </form>
    <aside class="card summary">
      <h2>Récapitulatif</h2>
      <div class="sumrow"><span>Retrait</span><b>${esc(slotLabel(ui.slot))}</b></div>
      <div class="sumrow"><span>Articles</span><b>${s.count}</b></div>
      <div class="sumrow"><span>Total estimé</span><b>${euro(s.estimated)}</b></div>
      <div class="sumrow"><span>Empreinte bancaire</span><b>${euro(s.preauth)}</b></div>
      <p class="note">Vous êtes débité du montant réel après la préparation : poids réels, ruptures retirées, remplacements ajoutés.</p>
      <a href="#/creneau" class="link">Changer de créneau</a>
    </aside></div>`;
}

// ---------- Suivi d'une commande ----------

const STEPS = ['recue', 'preparation', 'prete', 'retiree'];
const STEP_INDEX = { recue: 0, preparation: 1, prete: 2, arrive: 2, retiree: 3 };
const STEP_LABEL = { recue: 'Reçue', preparation: 'En préparation', prete: 'Prête', retiree: 'Retirée' };

function orderPage(id) {
  if (needLogin()) return `<h1>Ma commande</h1>${loginCard('Connectez-vous pour suivre votre commande.')}`;
  const st = getState();
  const o = st.orders.find((x) => x.id === id);
  if (!o) return `<div class="card empty"><p>Commande introuvable.</p><a class="btn" href="#/commandes">Mes commandes</a></div>`;
  const idx = STEP_INDEX[o.status] ?? -1;
  const timeline =
    o.status === 'annulee'
      ? ''
      : `<ol class="timeline">${STEPS.map((k, i) => `<li class="${i < idx || o.status === 'retiree' ? 'done' : i === idx ? 'current' : ''}"><span></span>${STEP_LABEL[k]}</li>`).join('')}</ol>`;

  let panel = '';
  if (o.status === 'annulee') {
    panel = `<div class="card warnbox"><b>Commande annulée.</b> L'empreinte bancaire a été libérée.</div>`;
  } else if (o.status === 'recue') {
    panel = `<div class="card"><p>Nous avons bien reçu votre commande. La préparation commencera avant votre créneau.</p>
      <button class="btn ghost" data-action="cancel" data-id="${o.id}">Annuler la commande</button></div>`;
  } else if (o.status === 'preparation') {
    panel = `<div class="card"><p>Votre commande est en cours de préparation. Vous serez prévenu dès qu'elle sera prête.</p></div>`;
  } else if (o.status === 'prete') {
    const n = st.settings.parkingSpots;
    panel = `<div class="card arrivebox">
      <h2>Votre commande est prête</h2>
      <p>Garez-vous sur une place <b>Proval Drive</b>, puis indiquez votre numéro de place. Restez dans votre voiture.</p>
      <div class="spots">${Array.from({ length: n }, (_, i) => i + 1)
        .map((i) => `<button class="spot ${ui.spot === i ? 'on' : ''}" data-action="spot" data-spot="${i}" aria-label="Place ${i}">${i}</button>`)
        .join('')}</div>
      <button class="btn block big" data-action="arrived" data-id="${o.id}">Je suis arrivé</button>
      <p class="note">Dans la version finale, ce bouton ne sera actif que pendant votre créneau.</p>
      ${codeBox(o)}</div>`;
  } else if (o.status === 'arrive') {
    panel = `<div class="card arrivebox live">
      <h2>On arrive !</h2>
      <p>Un membre de l'équipe vous apporte vos courses à la <b>place n° ${o.spot}</b>. Restez dans votre voiture, ouvrez simplement le coffre.</p>
      ${codeBox(o)}</div>`;
  } else if (o.status === 'retiree') {
    panel = `<div class="card okbox"><h2>Merci et à bientôt !</h2><p>Commande retirée à ${time(o.pickedUpAt)}. Votre ticket a été envoyé par email (simulation).</p>
      <button class="btn" data-action="reorder" data-id="${o.id}">Recommander ce panier</button></div>`;
  }

  const prepared = ['prete', 'arrive', 'retiree'].includes(o.status);
  const items = o.items
    .map((it) => {
      let note = '';
      if (prepared && it.pick === 'missing') note = '<small class="no">Rupture : non facturé</small>';
      else if (prepared && it.pick === 'sub') note = `<small class="ok">Remplacé par ${esc(it.sub.name)}</small>`;
      else if (prepared && it.unit === 'kg') note = `<small class="muted">Poids réel : ${qtyLabel('kg', it.actualQty)}</small>`;
      const amount = prepared ? itemTotal(it) : it.price * it.qty;
      return `<div class="line ${prepared && it.pick === 'missing' ? 'struck' : ''}"><div class="pic sm" aria-hidden="true">${it.emoji}</div><div class="grow"><b>${esc(it.name)}</b> <small class="muted">${qtyLabel(it.unit, it.qty)}</small>${note ? '<br>' + note : ''}</div><b class="amount">${euro(amount)}</b></div>`;
    })
    .join('');

  return `<a class="link" href="#/commandes">← Mes commandes</a>
    <div class="ohead"><h1>Commande ${o.id}</h1>${badge(o.status)}</div>
    <p class="muted">Retrait ${esc(slotLabel(o.slot))} · Proval Market, Metz-Vallières</p>
    ${timeline}
    <div class="cols">
      <div>${panel}<div class="card list">${items}</div></div>
      <aside class="card summary">
        <h2>Montants</h2>
        <div class="sumrow"><span>Total estimé</span><b>${euro(o.estimated)}</b></div>
        <div class="sumrow"><span>Empreinte bancaire</span><b>${euro(o.preauth)}</b></div>
        ${o.final != null ? `<div class="sumrow total"><span>Montant débité</span><b>${euro(o.final)}</b></div>` : '<p class="note">Le montant débité sera calculé après la préparation.</p>'}
        ${o.refunded ? '<p class="warn">Commande remboursée.</p>' : ''}
      </aside>
    </div>`;
}

const codeBox = (o) => `<div class="code"><span>Code de retrait</span><b>${o.pickupCode}</b></div>`;

// ---------- Historique ----------

function ordersPage() {
  if (needLogin()) return `<h1>Mes commandes</h1>${loginCard('Connectez-vous pour retrouver vos commandes sur tous vos appareils.')}`;
  const orders = [...getState().orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!orders.length)
    return `<h1>Mes commandes</h1><div class="card empty"><p>Aucune commande pour l'instant.</p><a class="btn" href="#/">Faire mes courses</a></div>`;
  return `<h1>Mes commandes</h1><div class="card list">${orders
    .map(
      (o) => `<div class="line">
        <div class="grow"><a href="#/commande/${o.id}"><b>${o.id}</b></a> ${badge(o.status)}<br><small class="muted">${esc(slotLabel(o.slot))} · ${o.items.length} article${o.items.length > 1 ? 's' : ''} · ${esc(o.customer.name)}</small></div>
        <b class="amount">${euro(o.final ?? o.estimated)}</b>
        <a class="btn sm ghost" href="#/commande/${o.id}">Suivre</a>
        <button class="btn sm ghost" data-action="reorder" data-id="${o.id}">Recommander</button>
      </div>`,
    )
    .join('')}</div>`;
}

// ---------- Actions ----------

export const actions = {
  search(el) {
    ui.q = el.value;
    refresh();
  },
  cat(el) {
    ui.cat = el.dataset.cat;
    refresh();
  },
  add(el) {
    const p = product(el.dataset.id);
    if (!p || !p.available) return;
    updateCart((c) => c.push({ productId: p.id, qty: p.unit === 'kg' ? p.step * 2 : 1, allowSub: true }));
  },
  inc: (el) => changeQty(el.dataset.id, +1),
  dec: (el) => changeQty(el.dataset.id, -1),
  remove(el) {
    updateCart((c) => {
      const i = c.findIndex((l) => l.productId === el.dataset.id);
      if (i >= 0) c.splice(i, 1);
    });
  },
  toggleSub(el) {
    updateCart((c) => {
      const l = c.find((x) => x.productId === el.dataset.id);
      if (l) l.allowSub = el.checked;
    });
  },
  clearCart() {
    if (confirm('Vider le panier ?')) updateCart((c) => c.splice(0));
  },
  day(el) {
    ui.day = el.dataset.date;
    refresh();
  },
  slot(el) {
    ui.slot = { date: el.dataset.date, start: el.dataset.start, end: el.dataset.end };
    refresh();
  },
  formField(el) {
    ui.form[el.name] = el.value;
  },
  async magicLink(form) {
    const email = String(new FormData(form).get('email') || '').trim();
    if (!email) return;
    ui.busy = true;
    refresh();
    try {
      await sendMagicLink(email);
      ui.linkSent = email;
    } catch (e) {
      toast(e.message);
    }
    ui.busy = false;
    refresh();
  },
  resetLink() {
    ui.linkSent = null;
    refresh();
  },
  async pay(form) {
    if (ui.busy) return;
    if (!ui.slot) {
      location.hash = '#/creneau';
      return;
    }
    if (!isSlotBookable(ui.slot)) {
      toast("Ce créneau n'est plus disponible. Choisissez-en un autre.");
      ui.slot = null;
      location.hash = '#/creneau';
      return;
    }
    const fd = new FormData(form);
    const customer = {
      name: String(fd.get('name') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      plate: String(fd.get('plate') || '').trim(),
    };
    ui.busy = true;
    refresh();
    try {
      const order = await placeOrder(customer, ui.slot);
      ui.slot = null;
      ui.form = {};
      location.hash = '#/commande/' + order.id;
      toast('Commande confirmée !');
    } catch (e) {
      toast(e.message);
    } finally {
      ui.busy = false;
      refresh();
    }
  },
  spot(el) {
    ui.spot = Number(el.dataset.spot);
    refresh();
  },
  async arrived(el) {
    if (!ui.spot) {
      toast('Choisissez votre numéro de place.');
      return;
    }
    try {
      await customerArrived(el.dataset.id, ui.spot);
      ui.spot = null;
      toast("L'équipe est prévenue, elle arrive !");
    } catch (e) {
      toast(e.message);
    }
  },
  async cancel(el) {
    if (!confirm("Annuler cette commande ? L'empreinte bancaire sera libérée.")) return;
    try {
      await customerCancel(el.dataset.id);
      toast('Commande annulée');
    } catch (e) {
      toast(e.message);
    }
  },
  reorder(el) {
    const { added, skipped } = reorder(el.dataset.id);
    toast(skipped ? `${added} produit(s) ajouté(s), ${skipped} indisponible(s)` : `${added} produit(s) ajouté(s) au panier`);
    location.hash = '#/panier';
  },
};
