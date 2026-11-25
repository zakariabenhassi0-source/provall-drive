# Brancher Proval Drive sur Supabase

Environ 15 minutes. À la fin, les commandes passées sur un téléphone apparaissent en temps réel sur la tablette du magasin.

## 1. Créer le compte et le projet

1. Allez sur [supabase.com](https://supabase.com) et créez un compte (gratuit).
2. Cliquez sur **New project** :
   - Nom : `proval-drive`
   - Mot de passe de la base : générez-le et **gardez-le en lieu sûr** (gestionnaire de mots de passe).
   - Région : **Europe**, par exemple *West EU (Paris)* ou *Central EU (Frankfurt)*, pour le RGPD.
3. Attendez environ 2 minutes que le projet soit prêt.

## 2. Créer la base

1. Dans le menu de gauche, ouvrez **SQL Editor**, puis **New query**.
2. Copiez tout le contenu de [`schema.sql`](schema.sql), collez-le et cliquez sur **Run**. Le message attendu est « Success. No rows returned ».
3. Nouvelle requête : copiez [`seed.sql`](seed.sql) et cliquez sur **Run**. Cela ajoute les 7 rayons et les 32 produits de démonstration.

## 3. Régler la connexion par email

Dans **Authentication** :

1. **URL Configuration** :
   - *Site URL* : `http://localhost:5173`
   - *Redirect URLs* : ajoutez `http://localhost:5173` (puis plus tard l'adresse définitive du site).
2. **Sign In / Providers** > **Email** : laissez activé.

> Le service d'email intégré à Supabase n'envoie que quelques emails par heure. C'est suffisant pour tester. Avant le lancement, il faudra brancher un vrai service d'envoi (Brevo, Resend…) dans **Authentication > Emails > SMTP Settings**.

## 4. Créer les comptes de l'équipe

1. **Authentication > Users > Add user > Create new user** : saisissez l'email et un mot de passe, et cochez *Auto Confirm User*.
2. Faites-le pour le responsable et pour chaque préparateur.
3. Donnez-leur leur rôle dans **SQL Editor** (remplacez les adresses) :

```sql
update public.profiles set role = 'admin' where email = 'responsable@exemple.fr';
update public.profiles set role = 'staff' where email in ('preparateur1@exemple.fr', 'preparateur2@exemple.fr');
```

Les rôles :

| Rôle | Accès |
| --- | --- |
| `client` (par défaut) | Commander, suivre ses propres commandes |
| `staff` | Écran de préparation : toutes les commandes |
| `admin` | Préparation + back-office (catalogue, prix, réglages, remboursements) |

## 5. Relier l'application

1. **Project Settings > API** : copiez la *Project URL* et la clé **anon public**.
2. Collez-les dans [`public/js/config.js`](../public/js/config.js) :

```js
export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...';
```

> La clé *anon* est faite pour être publique : les règles de sécurité de la base protègent les données. Ne mettez **jamais** la clé *service_role* dans ce fichier.

3. Relancez `node server.js` et rechargez la page. La barre du haut affiche alors votre email une fois connecté, au lieu de « Mode local ».

## 6. Tester

1. **Client** (par exemple sur votre téléphone, sur le même réseau, ou dans un autre navigateur) : remplissez un panier, choisissez un créneau, connectez-vous avec le lien reçu par email, puis validez.
2. **Préparation** : connectez-vous avec un compte `staff`. La commande apparaît avec un signal sonore.
3. Préparez la commande et passez-la « prête ». Le client est prévenu, il clique « Je suis arrivé », l'équipe reçoit l'alerte, puis valide la remise avec le code.

Pour revenir au mode local, videz les deux valeurs de `config.js`.

## Ce que la base protège

- Les prix, le minimum de commande, les jours d'ouverture et la capacité des créneaux sont **vérifiés par le serveur** (fonction `place_order`) : un client ne peut pas modifier un prix ni dépasser la capacité.
- Un client ne voit que **ses** commandes. Il ne peut que signaler son arrivée ou annuler avant la préparation.
- Seule l'équipe voit toutes les commandes. Seul le responsable modifie le catalogue et les réglages.
- Le remplissage des créneaux est affiché aux clients sans aucune donnée personnelle.

## Limites connues de cette étape

- **Paiement** : toujours simulé. Stripe sera la prochaine étape.
- **Lien de connexion** : il doit être ouvert dans le navigateur où il a été demandé (sécurité PKCE).
- **Montant final** : il est calculé par la tablette de l'équipe, qui fait confiance aux préparateurs. Avec Stripe, il sera recalculé côté serveur avant le débit.
- **Suppression de compte (RGPD)** : les commandes restent pour la comptabilité, sans lien avec le compte. Un bouton « supprimer mon compte » reste à ajouter.
