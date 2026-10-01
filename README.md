# Commune de Lambanyi — Recensement et collecte des recettes

Prototype réalisé à partir de `DOCS/Proposition_architecture_Lambanyi.docx` (Petit Cœur Technologie).
Une application mobile pour les agents de terrain et deux applications web (Mairie, Service), toutes
branchées sur **une base PostgreSQL unique**.

```
 FRONTEND APPLICATION MOBILE  (React Native / Expo + SQLite local)
        │  synchronisation (envoi / réception)
        ▼
 BACKEND APPLICATION MOBILE  :4001 ─┐
 BACKEND MAIRIE              :4002 ─┼──►  PostgreSQL « lambanyi_db »  (BASE DE DONNEES)
 BACKEND SERVICE             :4003 ─┘
        ▲                    ▲
 FRONTEND MAIRIE :5173   FRONTEND SERVICE :5174   (React + Vite)
```

| Dossier | Rôle |
|---|---|
| `BASE DE DONNEES` | Schéma SQL, import du classeur des lignes de recettes, comptes et données de démonstration |
| `BACKEND APPLICATION MOBILE` | Connexion des agents, configuration du service, synchronisation hors ligne |
| `BACKEND MAIRIE` | Tableau de bord consolidé, prévu/collecté, contribuables, carte, services, référentiel, contrôle |
| `BACKEND SERVICE` | Agents, tâches (taxes), formulaire mobile, encaissements, clôtures de caisse |
| `FRONTEND MAIRIE` / `FRONTEND SERVICE` | Interfaces web correspondantes |
| `FRONTEND APPLICATION MOBILE` | Application des agents : espaces Recensement et Collecte |

## Comment les applications sont reliées

- La **Mairie** crée les services et le compte de leur responsable.
- Le **Service** inscrit ses agents, paramètre ses tâches (montant, tarif × base ou barème, fréquence)
  et les champs propres à son formulaire. Ces paramètres descendent sur le mobile à chaque synchronisation.
- L'**agent** se connecte : l'application reconnaît son service et n'affiche que ses taxes. Il recense et
  encaisse ; chaque fiche et chaque paiement est rattaché automatiquement à son service.
- Le contribuable est **unique** : tous les services complètent la même fiche (bloc `complements` par service).
- Le Service valide chaque soir la **clôture de caisse** de ses agents ; la Mairie voit tout, vérifie les reçus
  et consulte le journal des actions.

## Fonctionnement hors ligne (mobile)

1. Toute saisie (recensement, encaissement, reçu) est écrite **d'abord dans SQLite** sur le téléphone, avec l'état `EN_ATTENTE`.
2. Les identifiants (UUID) et les numéros de reçu (`<AGENT>-<AAAAMMJJ>-<n°>`) sont générés sur le téléphone : pas besoin du serveur pour remettre un reçu.
3. L'envoi se déclenche tout seul : au retour du réseau (NetInfo), après chaque saisie, au retour de l'application au premier plan, et toutes les 30 s tant qu'il reste des éléments en attente.
4. Le serveur traite chaque élément de façon **idempotente** : un lot renvoyé après une coupure ne crée pas de doublon.
5. Le téléphone reçoit ensuite les fiches des autres agents et services, les paiements de son service et les tarifs à jour : la recherche fonctionne hors ligne.
6. Après une première connexion en ligne, l'agent peut se reconnecter **sans réseau**.

## En ligne (Render, espace « Rencesement », région Francfort, offre gratuite)

| Élément | Adresse |
|---|---|
| Tableau de bord Mairie | https://lambanyi-mairie.onrender.com |
| Tableau de bord Service | https://lambanyi-service.onrender.com |
| API de l'application mobile | https://lambanyi-api-mobile.onrender.com (adresse par défaut de l'application) |
| Base PostgreSQL | `lambanyi-db` (accès externe limité à l'adresse IP de l'administrateur) |

- Code : dépôt public https://github.com/diaoune-code/recensement (sans le dossier `DOCS`). Chaque envoi sur `main` redéploie les trois services.
- Chaque tableau de bord est un seul service : l'API Express sert aussi les pages React compilées. Configuration décrite dans `render.yaml`.
- **Offre gratuite** : la base **expire le 31/10/2026** (30 jours, puis 14 jours de grâce) ; passer au plan payant avant pour garder les données. Les services s'endorment après 15 min sans visite (≈ 1 min au réveil).
- Accès direct à la base depuis un nouveau poste : ajouter son adresse IP dans Render → lambanyi-db → Networking.

## Installation et démarrage (en local)

Prérequis : Node.js 20+, PostgreSQL (mot de passe configuré dans les fichiers `.env`), l'application **Expo Go** sur le téléphone.

```powershell
# 1. Base de données (crée lambanyi_db, importe le référentiel ; --demo ajoute des données d'exemple)
cd "BASE DE DONNEES";             npm install; npm run init:demo

# 2. Les trois API (un terminal chacune)
cd "BACKEND APPLICATION MOBILE";  npm install; npm run dev
cd "BACKEND MAIRIE";              npm install; npm run dev
cd "BACKEND SERVICE";             npm install; npm run dev

# 3. Les deux applications web
cd "FRONTEND MAIRIE";             npm install; npm run dev    # http://localhost:5173
cd "FRONTEND SERVICE";            npm install; npm run dev    # http://localhost:5174

# 4. L'application mobile
cd "FRONTEND APPLICATION MOBILE"; npm install; npx expo start
```

Scannez le QR code avec Expo Go (téléphone sur le même Wi-Fi que l'ordinateur). L'adresse du serveur est
déduite automatiquement ; sinon, modifiez-la dans l'écran « Serveur » (`http://<IP du PC>:4001`).
Autorisez le port 4001 dans le pare-feu Windows si le téléphone n'arrive pas à joindre le serveur.

Scripts de `BASE DE DONNEES` :

| Commande | Effet |
|---|---|
| `npm run init` | Base réelle : 17 services et 123 lignes de recettes du classeur, compte administrateur `maire` |
| `npm run reset` | **Efface tout** et recharge uniquement la base réelle ci-dessus |
| `npm run init:demo` / `reset:demo` | Ajoute des comptes, quartiers, tâches, contribuables et paiements **fictifs** (tests uniquement) |

Après un `reset`, les téléphones effacent automatiquement leur copie locale à la connexion suivante.

## Démarrer avec les vraies données

1. **Mairie** (`maire`, mot de passe `MOT_DE_PASSE_ADMIN` de `BASE DE DONNEES/.env`) :
   Référentiel → saisir les **quartiers** ; Services → créer le compte du **responsable** de chaque service.
2. **Service** (compte du responsable) : Tâches → saisir les **taxes et tarifs officiels** ;
   Formulaire mobile → ajuster les champs ; Agents → **inscrire les agents**.
3. **Mobile** : chaque agent se connecte avec l'identifiant reçu (ex. `CAD-001`) et commence à recenser et encaisser.

## À valider avec la commune

- **Tarifs** des tâches : ceux chargés sont des exemples (`BASE DE DONNEES/donnees/referentiel.js`).
- **Quartiers** : liste de démonstration, modifiable dans Mairie → Référentiel.
- **Lignes sans service** : 7304 fourrière (police routière, pas de code de service), 7323 (le code 15 est attribué à deux services dans le classeur), 72009, 7306.
- Règle **un agent, un service** appliquée ; l'habilitation sur un second service n'est pas encore faite.
- **SMS** : les reçus sont enregistrés (Mairie → Contrôle → Reçus SMS) mais aucun opérateur n'est branché.
- Pas encore faits : import KoboToolbox, mobile money, portail contribuable.
