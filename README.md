# Proval Drive — prototype

Prototype de l'application **Proval Drive** pour Proval Market (Metz-Vallières) : le client commande en ligne, l'équipe prépare le panier, et le client le récupère sur le parking sans sortir de sa voiture.

Il suit le cahier des charges (V1) et sert à montrer le parcours complet au responsable du marché avant le vrai développement.

## Lancer le prototype

Il faut seulement [Node.js](https://nodejs.org) 18 ou plus récent. Aucune installation de paquet n'est nécessaire.

```powershell
node server.js
```

Puis ouvrir dans le navigateur :

| Vue | Adresse | Pour qui |
| --- | --- | --- |
| Client | http://localhost:5173/#/ | Les clients (sur téléphone) |
| Préparation | http://localhost:5173/#/preparation | L'équipe (sur tablette) |
| Back-office | http://localhost:5173/#/admin | Le responsable |

**Astuce démo :** ouvrez la vue Client et la vue Préparation dans deux onglets côte à côte. Une commande passée côté client apparaît aussitôt côté préparation, avec un signal sonore, et inversement.

## Deux modes

- **Mode local** (par défaut) : tout fonctionne dans un seul navigateur, sans compte. Idéal pour une démonstration.
- **Mode Supabase** : vraie base de données en Europe, comptes clients (lien par email) et équipe (mot de passe), synchronisation en temps réel entre téléphones et tablette. Suivez [supabase/GUIDE.md](supabase/GUIDE.md), puis remplissez `public/js/config.js`.

## Ce que fait le prototype

- **Client** : catalogue par rayons, recherche, produits au poids, panier avec remplacements acceptés ou refusés par article, minimum de commande, choix d'un créneau (capacité, délai minimum, jours fermés), validation, suivi de commande, bouton « Je suis arrivé » avec numéro de place, code de retrait, recommande d'un ancien panier.
- **Préparation** : file des commandes par créneau, liste triée dans l'ordre des rayons, pris, manquant ou remplacé (produit du même rayon, au même prix ou moins cher), saisie du poids réel, numéro de bac, commande prête avec calcul du montant réel, alerte d'arrivée, remise vérifiée par code.
- **Back-office** : commandes (annulation, remboursement), catalogue (prix, disponibilité, ajout, suppression, import et export CSV), réglages des créneaux, statistiques, commandes de démo, remise à zéro.
- **PWA** : installable sur l'écran d'accueil du téléphone.

## Ce qui est simulé

| Élément | Dans le prototype | Dans la version finale |
| --- | --- | --- |
| Paiement | Aucune carte demandée | Stripe : empreinte puis débit du montant réel |
| Données | Stockées dans le navigateur (localStorage) | Base de données Supabase (UE) |
| Synchronisation | Entre onglets du même navigateur | Temps réel entre tous les appareils |
| Comptes | Aucun, les vues sont ouvertes à tous | Connexion client, préparateur, administrateur |
| Notifications | Messages et son dans la page | Notifications push et emails |
| Catalogue | 32 produits fictifs | Import depuis le logiciel de caisse |

Les données restent dans le navigateur utilisé. Le bouton « Réinitialiser la démo » (Back-office → Statistiques) remet tout à zéro.

## Structure

```
server.js                 serveur statique (Node, sans dépendance)
public/index.html         page unique
public/css/styles.css     styles (mobile d'abord)
public/js/app.js          routage, événements, notifications entre onglets
public/js/store.js        état, créneaux, commandes, calculs de montants
public/js/data.js         catalogue et clients de démonstration
public/js/ui.js           formatage et utilitaires
public/js/views/          client.js, prep.js, admin.js
public/manifest.webmanifest, public/sw.js   PWA
```

## Format CSV du catalogue

Séparateur `;`, décimales avec virgule, encodage UTF-8 :

```csv
id;nom;rayon;prix;unite;format;origine;temperature;disponible;emoji
tomate;Tomates grappe;fruits-legumes;3,49;kg;;France;sec;oui;🍅
```

`unite` vaut `piece` ou `kg`, `temperature` vaut `sec`, `frais` ou `surgele`. Une ligne sans `id` crée un nouveau produit, une ligne avec un `id` existant le met à jour.
