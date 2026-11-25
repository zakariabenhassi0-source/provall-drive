// Connexion de l'équipe (préparateurs et responsable), en mode Supabase.
import { auth, staffSignIn, signOut } from '../store.js';
import { esc, toast } from '../ui.js';

let busy = false;

export function render([area]) {
  const title = area === 'admin' ? 'Back-office' : 'Préparation';
  const wrong = auth.user
    ? `<div class="card warnbox"><p>Le compte <b>${esc(auth.user.email)}</b> n'a pas accès à cet espace${area === 'admin' ? ' (réservé au responsable)' : ''}.</p>
       <button class="btn ghost" data-action="signOutHere">Changer de compte</button></div>`
    : '';
  return `<header class="top staff"><div class="wrap top-in">
      <div class="brand"><span class="logo" aria-hidden="true">P</span><span><b>${title}</b><small>Proval Drive · équipe</small></span></div>
    </div></header>
    <main class="wrap page">
      ${wrong || `<form class="card form narrow" data-submit="staffLogin">
        <h2>Connexion équipe</h2>
        <label>Email<input id="staff-email" name="email" type="email" required autocomplete="username"></label>
        <label>Mot de passe<input id="staff-password" name="password" type="password" required autocomplete="current-password"></label>
        <button class="btn block" ${busy ? 'disabled' : ''}>${busy ? 'Connexion…' : 'Se connecter'}</button>
        <p class="note">Les comptes de l'équipe sont créés par le responsable dans Supabase.</p>
      </form>`}
    </main>`;
}

export const actions = {
  async staffLogin(form) {
    const fd = new FormData(form);
    busy = true;
    form.querySelector('button').disabled = true;
    try {
      await staffSignIn(String(fd.get('email')).trim(), String(fd.get('password')));
    } catch (e) {
      toast(e.message);
    } finally {
      busy = false;
    }
  },
  async signOutHere() {
    await signOut();
  },
};
