// Base SQLite locale du téléphone : tout est enregistré ici d'abord, puis envoyé au serveur
// dès que le réseau le permet. L'agent peut ainsi travailler sans connexion.
import * as SQLite from 'expo-sqlite';

// Colonnes de la fiche contribuable (identiques à la base PostgreSQL de la commune)
export const CHAMPS_CONTRIBUABLE = [
  'type_contribuable', 'nom', 'prenoms', 'raison_sociale', 'sexe', 'date_naissance', 'nationalite',
  'piece_type', 'piece_numero', 'telephone', 'telephone2', 'email', 'statut_fiscal', 'nif', 'rccm',
  'type_site', 'quartier', 'secteur', 'rue', 'numero_porte', 'nom_marche', 'numero_etal',
  'latitude', 'longitude', 'precision_gps', 'repere',
  'activite_principale', 'description_activite', 'forme_point', 'occupation', 'surface_m2', 'nb_etals', 'nb_personnes',
];

const NUMERIQUES = new Set(['latitude', 'longitude', 'precision_gps', 'surface_m2', 'nb_etals', 'nb_personnes']);

const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS meta (
  cle    TEXT PRIMARY KEY,
  valeur TEXT
);

CREATE TABLE IF NOT EXISTS contribuables (
  id TEXT PRIMARY KEY,
  numero TEXT,
  ${CHAMPS_CONTRIBUABLE.map((c) => `${c} ${NUMERIQUES.has(c) ? 'REAL' : 'TEXT'}`).join(',\n  ')},
  complements TEXT NOT NULL DEFAULT '{}',
  service_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  photo TEXT,
  a_photo INTEGER NOT NULL DEFAULT 0,
  photo_a_envoyer INTEGER NOT NULL DEFAULT 0,
  recherche TEXT NOT NULL DEFAULT '',
  -- EN_ATTENTE : saisi ou modifié sur le téléphone, pas encore accepté par le serveur
  -- SYNCHRONISE : identique au serveur ; ERREUR : refusé par le serveur (voir erreur_synchro)
  etat_synchro TEXT NOT NULL DEFAULT 'SYNCHRONISE',
  erreur_synchro TEXT
);
CREATE INDEX IF NOT EXISTS idx_c_recherche ON contribuables(recherche);
CREATE INDEX IF NOT EXISTS idx_c_etat ON contribuables(etat_synchro);

CREATE TABLE IF NOT EXISTS paiements (
  id TEXT PRIMARY KEY,
  numero_recu TEXT NOT NULL UNIQUE,
  contribuable_id TEXT NOT NULL,
  tache_id INTEGER NOT NULL,
  agent_id TEXT,
  montant REAL NOT NULL,
  base_valeur REAL,
  categorie TEXT,
  periode TEXT NOT NULL,
  mode_paiement TEXT NOT NULL DEFAULT 'ESPECES',
  telephone_sms TEXT,
  latitude REAL,
  longitude REAL,
  date_paiement TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'VALIDE',
  etat_synchro TEXT NOT NULL DEFAULT 'SYNCHRONISE',
  erreur_synchro TEXT
);
CREATE INDEX IF NOT EXISTS idx_p_contrib ON paiements(contribuable_id, tache_id, periode);
CREATE INDEX IF NOT EXISTS idx_p_etat ON paiements(etat_synchro);
`;

let promesse = null;

export function base() {
  if (!promesse) {
    promesse = (async () => {
      const db = await SQLite.openDatabaseAsync('lambanyi_collecte.db');
      await db.execAsync(SCHEMA);
      return db;
    })();
  }
  return promesse;
}

// ---- Petites valeurs clé / valeur (session, configuration du service, dernière synchro) ----
export async function lireMeta(cle, defaut = null) {
  const db = await base();
  const r = await db.getFirstAsync('SELECT valeur FROM meta WHERE cle = ?', [cle]);
  return r ? JSON.parse(r.valeur) : defaut;
}

export async function ecrireMeta(cle, valeur) {
  const db = await base();
  if (valeur === null || valeur === undefined) await db.runAsync('DELETE FROM meta WHERE cle = ?', [cle]);
  else await db.runAsync('INSERT OR REPLACE INTO meta (cle, valeur) VALUES (?, ?)', [cle, JSON.stringify(valeur)]);
}

// La base du serveur a été réinitialisée : la copie locale ne correspond plus à rien et est effacée.
// La session de l'agent et l'adresse du serveur sont conservées.
export async function viderCopieLocale() {
  const db = await base();
  await db.execAsync("DELETE FROM contribuables; DELETE FROM paiements; DELETE FROM meta WHERE cle IN ('dernier_pull', 'config', 'derniere_synchro');");
}

// Efface toutes les données locales (changement d'agent sur le téléphone)
export async function viderDonnees() {
  const db = await base();
  await db.execAsync("DELETE FROM contribuables; DELETE FROM paiements; DELETE FROM meta WHERE cle NOT IN ('serveur');");
}
