// Point d'entrée : routage par hash, accès par rôle, délégation des événements, notifications.
import { subscribe, getState, init, auth, REMOTE, signOut } from './store.js';
import * as client from './views/client.js';
import * as prep from './views/prep.js';
import * as admin from './views/admin.js';
import * as login from './views/login.js';
import { beep, toast, esc } from './ui.js';

const root = document.getElementById('app');
let current = null;
let pending = false;

function route() {
  const [first = '', ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  let r;
  if (first === 'preparation') r = { view: prep, area: 'prep', params: rest };
  else if (first === 'admin') r = { view: admin, area: 'admin', params: rest };
  else r = { view: client, area: 'client', params: [first || 'catalogue', ...rest] };
  // En mode Supabase, la préparation et le back-office demandent un compte de l'équipe.
  if (REMOTE && r.area !== 'client') {
    const allowed = r.area === 'admin' ? ['admin'] : ['staff', 'admin'];
    if (!allowed.includes(auth.role)) r = { ...r, view: login, params: [r.area] };
  }
  return r;
}

function demoBar(area) {
  const links = [
    ['client', '#/', 'Client'],
    ['prep', '#/preparation', 'Préparation'],
    ['admin', '#/admin', 'Back-office'],
  ];
  const who = REMOTE
    ? auth.user
      ? `<span class="who">${esc(auth.user.email)} · <a href="#" data-global="signOut">Déconnexion</a></span>`
      : ''
    : '<span class="who">Mode local (démo)</span>';
  return `<div class="demobar"><span>Vue</span><nav aria-label="Changer de vue">${links
    .map(([k, href, label]) => `<a href="${href}" class="${area === k ? 'on' : ''}">${label}</a>`)
    .join('')}</nav>${who}</div>`;
}

function render() {
  pending = false;
  if (!auth.ready) {
    root.innerHTML = '<p class="loading">Connexion à Proval Drive…</p>';
    return;
  }
  if (auth.error) {
    root.innerHTML = `<div class="wrap page"><div class="card warnbox"><h2>Impossible de joindre la base de données</h2><p>${esc(auth.error)}</p><p>Vérifiez la connexion Internet et le fichier <code>public/js/config.js</code>.</p></div></div>`;
    return;
  }
  current = route();
  // Conserve le focus et la position du curseur (ex. la recherche) d'un rendu à l'autre.
  const active = document.activeElement;
  const focusId = active && active.id;
  let sel = null;
  try {
    if (active && typeof active.selectionStart === 'number') sel = [active.selectionStart, active.selectionEnd];
  } catch { /* type sans sélection */ }
  root.innerHTML = demoBar(current.area) + current.view.render(current.params);
  document.body.dataset.area = current.area;
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) {
      el.focus({ preventScroll: true });
      try { if (sel) el.setSelectionRange(sel[0], sel[1]); } catch { /* ignore */ }
    }
  }
}

// Un rendu déclenché par un autre onglet ou appareil ne doit pas effacer un formulaire en cours de saisie.
function editingForm() {
  const a = document.activeElement;
  return Boolean(a && a.closest && a.closest('form') && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName));
}

document.addEventListener('focusout', () => {
  setTimeout(() => { if (pending && !editingForm()) render(); }, 0);
});

// ---------- Délégation des événements ----------

document.addEventListener('click', async (e) => {
  const g = e.target.closest('[data-global]');
  if (g && g.dataset.global === 'signOut') {
    e.preventDefault();
    await signOut();
    toast('Vous êtes déconnecté');
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el || !current) return;
  const fn = current.view.actions?.[el.dataset.action];
  if (fn) {
    e.preventDefault();
    fn(el, e);
  }
});

for (const kind of ['input', 'change', 'submit']) {
  document.addEventListener(kind, (e) => {
    const el = e.target.closest(`[data-${kind}]`);
    if (!el || !current) return;
    const fn = current.view.actions?.[el.dataset[kind]];
    if (fn) {
      if (kind === 'submit') e.preventDefault();
      fn(el, e);
    }
  });
}

// ---------- Notifications ----------

const snap = () => {
  const orders = getState().orders;
  return {
    received: orders.filter((o) => o.status === 'recue').length,
    arrived: orders.filter((o) => o.status === 'arrive').length,
    statuses: Object.fromEntries(orders.map((o) => [o.id, o.status])),
  };
};
let last = snap();

subscribe((source) => {
  const now = snap();
  if (source === 'remote' && current) {
    if (current.area === 'prep' && current.view === prep) {
      if (now.arrived > last.arrived) { beep(); toast('Un client est arrivé sur le parking'); }
      else if (now.received > last.received) { beep(); toast('Nouvelle commande reçue'); }
    }
    if (current.area === 'client') {
      for (const [id, status] of Object.entries(now.statuses)) {
        if (!(id in last.statuses) || last.statuses[id] === status) continue;
        if (status === 'preparation') toast(`Commande ${id} : préparation en cours`);
        if (status === 'prete') { beep(); toast(`Commande ${id} prête ! Vous pouvez venir la retirer.`); }
        if (status === 'retiree') toast(`Commande ${id} retirée. Merci !`);
      }
    }
  }
  last = now;
  if (source === 'remote' && editingForm()) {
    pending = true;
    return;
  }
  render();
});

window.addEventListener('hashchange', () => {
  window.scrollTo(0, 0);
  render();
});

render();
init().then(() => {
  last = snap();
  render();
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
