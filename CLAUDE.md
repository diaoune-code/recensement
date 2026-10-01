# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Taxpayer census and tax collection system for the **Commune de Lambanyi** (Guinea), built by Petit Cœur Technologie (PCT). All domain language, UI, identifiers and comments are in **French**; keep it that way. The spec is `DOCS/Proposition_architecture_Lambanyi.docx` (same content as the PDF). `README.md` has setup, demo accounts and open questions.

Not a git repository at the root (the Expo template created a nested `.git` inside `FRONTEND APPLICATION MOBILE`).

## Layout and commands

Seven folders, each an independent npm project (folder names contain spaces: quote paths).

| Folder | Stack | Commands |
|---|---|---|
| `BASE DE DONNEES` | `schema.sql` + `init.js` (pg) | `npm run init` (real reference data + `maire` admin only) / `reset` (drops everything) / `init:demo`, `reset:demo` (adds fictitious accounts, quartiers, tâches, contribuables) |
| `BACKEND APPLICATION MOBILE` | Express, port 4001 | `npm run dev` |
| `BACKEND MAIRIE` | Express, port 4002 | `npm run dev` |
| `BACKEND SERVICE` | Express, port 4003 | `npm run dev` |
| `FRONTEND MAIRIE` | React + Vite, port 5173, proxies `/api` → 4002 | `npm run dev`, `npm run build` |
| `FRONTEND SERVICE` | React + Vite, port 5174, proxies `/api` → 4003 | `npm run dev`, `npm run build` |
| `FRONTEND APPLICATION MOBILE` | Expo SDK 57 / React Native 0.86, plain JS | `npx expo start`, `npx expo-doctor`, `npx expo export --platform android` (compile check) |

There is no test suite or linter configured. Verification so far: `vite build` for web, `expo-doctor` + `expo export` for mobile, and ad-hoc Node scripts against the running APIs. Each backend reads its own `.env` (local PostgreSQL user `postgres`, DB `lambanyi_db`). The database currently holds **real data only** (the user asked for demo data to be removed): do not run `--demo` on it without asking. The admin `maire` password is `MOT_DE_PASSE_ADMIN` in `BASE DE DONNEES/.env`.

`parametres.base_id` is regenerated on every reset; the mobile compares it (in `/api/sante` and the login response) and wipes its local SQLite copy when it changes. Backends return 401 (not 403) when the token's user no longer exists, so clients go back to the login screen.

## Deployment (Render)

Deployed on Render (workspace "Rencesement", Frankfurt, free plan) from the public repo `github.com/diaoune-code/recensement` (branch `main`). Render is not linked to GitHub, so pushes do NOT auto-deploy: trigger `POST /v1/services/{id}/deploys` (Render API) or "Manual Deploy" for each service after pushing. `DOCS/` is git-ignored and must never be pushed. Services: `lambanyi-mairie`, `lambanyi-service` (each Express backend also serves its built React `dist/`, so the web app and API share one origin), `lambanyi-api-mobile`, plus Postgres `lambanyi-db` (free tier, expires 2026-10-31). `render.yaml` documents the setup. Backends read `DATABASE_URL` when set (SSL for external Render hosts), otherwise the local `PG*` variables. The mobile app defaults to `https://lambanyi-api-mobile.onrender.com`; run Expo with `EXPO_PUBLIC_SERVEUR=local` to target a LAN machine instead. The production database is not the local one: they diverged after the initial copy.

## Architecture

- **One PostgreSQL database shared by three backends.** No backend calls another; the apps are connected only through the shared tables. Each backend has its own JWT secret and only accepts one role (`AGENT`, `MAIRIE`, `CHEF_SERVICE` in `utilisateurs.role`), so tokens are not interchangeable.
- The three backends duplicate small helpers on purpose (`src/db.js`, `src/outils.js`, `src/auth.js`); `db.js` differs only in the `application` value written to `journal`. When changing one, check the others. `pg` type parsers turn NUMERIC/BIGINT into JS numbers and leave DATE as `YYYY-MM-DD` strings.
- **Multi-service scoping**: Service-backend routes always filter on `req.chef.service_id`; the mobile backend forces `service_id`/`agent_id` from the token, never from the payload. The rule is one agent, one service.
- **Unique taxpayer**: `contribuables` has one row per person for all services. Service-specific data lives in `contribuables.complements` JSONB keyed by service `sigle`; a service only overwrites its own key (`complements || {sigle: …}`). The fields themselves are defined per service in `services.champs`, edited in the Service web app and rendered dynamically on the mobile.
- **Tâches** (taxes) carry the amount rule: `FORFAIT` (`montant`), `TARIF_BASE` (`tarif_unitaire` × base, base pre-filled from `base_champ`: a contribuable column or `c:<complement key>`), or `BAREME` (category list). The period paid is derived from `frequence` (`YYYY-MM-DD`, `YYYY-MM`, `YYYY`, `UNIQUE`). The mobile computes amounts in `src/metier/calcul.js`; the server stores what the phone sends.
- `lignes_recettes` was imported from the revenue workbook (`BASE DE DONNEES/donnees/lignes_recettes.json`, generated once from the xlsx). Its `prevision_2025` drives the Mairie "prévu / collecté" view, joined to payments through `taches.ligne_code`.

### Offline sync (mobile ↔ `BACKEND APPLICATION MOBILE`)

- The phone writes to SQLite first (`src/db/`), with `etat_synchro` = `EN_ATTENTE` / `SYNCHRONISE` / `ERREUR`. Contribuable and payment IDs are UUIDs made on the phone, and receipt numbers are `<IDENTIFIANT>-<YYYYMMDD>-<seq>`, so receipts work without network.
- `POST /api/sync/envoi` is idempotent per item (contribuables before payments). Statuses returned are `OK`, `DEJA_A_JOUR`, `DOUBLON_SUSPECT`, `DEJA_RECU`, `EN_ATTENTE` (payment whose contribuable has not arrived yet; retried) and `ERREUR`. Contribuable conflicts are resolved by the newest `updated_at`.
- `GET /api/sync/reception?depuis=` returns every contribuable (for offline search), the service's payments and the current config. It is incremental on the `recu_le` column, which must be bumped to `now()` on **every** server-side write that phones should see (for example payment cancellation).
- Triggers live in `src/contexte/Synchro.js`: NetInfo reconnect, right after each local save, app foregrounded, and a 15 s timer (sends if anything is pending for 30 s, otherwise pulls every 5 min). Offline re-login checks a salted SHA-256 hash stored in `meta.session`. Logging in as a different agent wipes local data and is refused while items are pending.

### Mobile conventions

The mobile app uses React Navigation (stack + bottom tabs in `App.js`), not Expo Router, despite the template's `AGENTS.md`. Install native packages with `npx expo install`, and check the SDK 57 docs before using an Expo API, since names change between SDKs (for example `ImageManipulator.manipulate(...).renderAsync()` and `mediaTypes: ['images']`). All modules used work in Expo Go.
