// Accès aux données locales : contribuables et paiements
import * as Crypto from 'expo-crypto';
import { base, CHAMPS_CONTRIBUABLE } from './base';
import { jourIso, normaliser, prefixeRecu, texteRecherche } from '../metier/calcul';

const versObjet = (ligne) => (ligne ? { ...ligne, complements: JSON.parse(ligne.complements || '{}') } : null);
const vide = (v) => (v === '' || v === undefined ? null : v);

// ---------------------------------------------------------------------------
// Contribuables
// ---------------------------------------------------------------------------

// Recherche locale (fonctionne hors ligne) : chaque mot doit apparaître dans nom, téléphone, n° d'étal…
// `quartier` (facultatif) limite la recherche à un quartier
export async function rechercherContribuables(texte, limite = 40, quartier = null) {
  const db = await base();
  const mots = normaliser(texte).split(/\s+/).filter(Boolean);
  if (!mots.length) return [];
  const conditions = mots.map(() => 'recherche LIKE ?');
  const params = mots.map((m) => `%${m}%`);
  if (quartier) { conditions.push('quartier = ?'); params.push(quartier); }
  const lignes = await db.getAllAsync(
    `SELECT id, numero, nom, prenoms, raison_sociale, telephone, quartier, nom_marche, numero_etal, numero_porte,
            activite_principale, etat_synchro, complements
     FROM contribuables WHERE ${conditions.join(' AND ')} ORDER BY nom, prenoms LIMIT ?`,
    [...params, limite]);
  return lignes.map(versObjet);
}

const COLONNES_LISTE = `id, numero, nom, prenoms, raison_sociale, telephone, quartier, nom_marche, numero_etal, numero_porte,
  activite_principale, etat_synchro, complements, created_at`;

// Liste complète (écran Collecte), les plus récents d'abord, par pages, éventuellement pour un seul quartier
export async function listerContribuables(limite = 50, decalage = 0, quartier = null) {
  const db = await base();
  const filtre = quartier ? 'WHERE quartier = ?' : '';
  const lignes = await db.getAllAsync(
    `SELECT ${COLONNES_LISTE} FROM contribuables ${filtre} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    quartier ? [quartier, limite, decalage] : [limite, decalage]);
  return lignes.map(versObjet);
}

// Nombre de contribuables par quartier (pastilles du filtre de l'écran Collecte)
export async function compterParQuartier() {
  const db = await base();
  const lignes = await db.getAllAsync('SELECT quartier, count(*) AS n FROM contribuables GROUP BY quartier');
  return Object.fromEntries(lignes.map((l) => [l.quartier || '', l.n]));
}

// Recensements faits sur ce téléphone et pas encore transmis (écran Recensement).
// Une fiche disparaît de cette liste dès que le serveur l'a acceptée.
export async function recensementsNonTransmis() {
  const db = await base();
  const lignes = await db.getAllAsync(
    `SELECT ${COLONNES_LISTE}, erreur_synchro FROM contribuables
     WHERE etat_synchro IN ('EN_ATTENTE', 'ERREUR') ORDER BY created_at DESC`);
  return lignes.map(versObjet);
}

// Doublons probables avant un nouveau recensement : même téléphone, ou mêmes nom et prénoms dans le même quartier
export async function doublonsProbables({ telephone, nom, prenoms, quartier }) {
  const db = await base();
  const trouves = new Map();
  if (telephone) {
    const lignes = await db.getAllAsync(`SELECT ${COLONNES_LISTE} FROM contribuables WHERE telephone = ? OR telephone2 = ? LIMIT 5`, [telephone, telephone]);
    lignes.forEach((c) => trouves.set(c.id, { ...versObjet(c), motif: 'même téléphone' }));
  }
  if (nom && quartier) {
    const lignes = await db.getAllAsync(`SELECT ${COLONNES_LISTE} FROM contribuables WHERE quartier = ? LIMIT 2000`, [quartier]);
    const cible = normaliser(`${nom} ${prenoms || ''}`);
    lignes.filter((c) => normaliser(`${c.nom} ${c.prenoms || ''}`) === cible)
      .forEach((c) => { if (!trouves.has(c.id)) trouves.set(c.id, { ...versObjet(c), motif: 'même nom dans le même quartier' }); });
  }
  return [...trouves.values()];
}

export async function lireContribuable(id) {
  const db = await base();
  return versObjet(await db.getFirstAsync('SELECT * FROM contribuables WHERE id = ?', [id]));
}

export async function compterContribuables() {
  const db = await base();
  return (await db.getFirstAsync('SELECT count(*) AS n FROM contribuables')).n;
}

// Recensement ou modification sur le terrain : enregistré localement, marqué « à envoyer »
export async function enregistrerContribuable(saisie, { serviceId, photoModifiee }) {
  const db = await base();
  const maintenant = new Date().toISOString();
  const id = saisie.id || Crypto.randomUUID();
  const existant = saisie.id ? await lireContribuable(saisie.id) : null;
  const c = { ...existant, ...saisie, id };
  const valeurs = CHAMPS_CONTRIBUABLE.map((k) => vide(c[k]));

  await db.runAsync(
    `INSERT INTO contribuables (id, ${CHAMPS_CONTRIBUABLE.join(', ')}, complements, service_id, created_at, updated_at,
                                photo, a_photo, photo_a_envoyer, recherche, etat_synchro, erreur_synchro)
     VALUES (?, ${CHAMPS_CONTRIBUABLE.map(() => '?').join(', ')}, ?, ?, ?, ?, ?, ?, ?, ?, 'EN_ATTENTE', NULL)
     ON CONFLICT(id) DO UPDATE SET
       ${CHAMPS_CONTRIBUABLE.map((k) => `${k} = excluded.${k}`).join(', ')},
       complements = excluded.complements, updated_at = excluded.updated_at,
       photo = coalesce(excluded.photo, contribuables.photo),
       a_photo = max(contribuables.a_photo, excluded.a_photo),
       photo_a_envoyer = max(contribuables.photo_a_envoyer, excluded.photo_a_envoyer),
       recherche = excluded.recherche, etat_synchro = 'EN_ATTENTE', erreur_synchro = NULL`,
    [id, ...valeurs, JSON.stringify(c.complements || {}), existant?.service_id ?? serviceId,
      existant?.created_at ?? maintenant, maintenant,
      photoModifiee ? c.photo : null, c.photo ? 1 : 0, photoModifiee ? 1 : 0, texteRecherche(c)]);
  return id;
}

export async function contribuablesAEnvoyer(limite) {
  const db = await base();
  const lignes = await db.getAllAsync(
    "SELECT * FROM contribuables WHERE etat_synchro = 'EN_ATTENTE' ORDER BY updated_at LIMIT ?", [limite]);
  return lignes.map(versObjet);
}

export async function marquerContribuable(id, { etat, numero, erreur, photoEnvoyee }) {
  const db = await base();
  await db.runAsync(
    `UPDATE contribuables SET etat_synchro = ?, numero = coalesce(?, numero), erreur_synchro = ?,
       photo_a_envoyer = CASE WHEN ? THEN 0 ELSE photo_a_envoyer END
     WHERE id = ?`, [etat, numero ?? null, erreur ?? null, photoEnvoyee ? 1 : 0, id]);
}

// Fusion des fiches reçues du serveur. Une fiche modifiée localement et pas encore envoyée
// n'est jamais écrasée par une version plus ancienne du serveur.
export async function fusionnerContribuables(liste) {
  if (!liste.length) return;
  const db = await base();
  await db.withTransactionAsync(async () => {
    for (const c of liste) {
      const local = await db.getFirstAsync('SELECT etat_synchro, updated_at FROM contribuables WHERE id = ?', [c.id]);
      if (local && local.etat_synchro !== 'SYNCHRONISE' && new Date(local.updated_at) > new Date(c.updated_at)) {
        await db.runAsync('UPDATE contribuables SET numero = coalesce(numero, ?) WHERE id = ?', [c.numero, c.id]);
        continue;
      }
      const valeurs = CHAMPS_CONTRIBUABLE.map((k) => vide(c[k]));
      await db.runAsync(
        `INSERT INTO contribuables (id, numero, ${CHAMPS_CONTRIBUABLE.join(', ')}, complements, service_id, created_at, updated_at,
                                    a_photo, recherche, etat_synchro, erreur_synchro)
         VALUES (?, ?, ${CHAMPS_CONTRIBUABLE.map(() => '?').join(', ')}, ?, ?, ?, ?, ?, ?, 'SYNCHRONISE', NULL)
         ON CONFLICT(id) DO UPDATE SET numero = excluded.numero,
           ${CHAMPS_CONTRIBUABLE.map((k) => `${k} = excluded.${k}`).join(', ')},
           complements = excluded.complements, updated_at = excluded.updated_at, a_photo = excluded.a_photo,
           recherche = excluded.recherche, etat_synchro = 'SYNCHRONISE', erreur_synchro = NULL`,
        [c.id, c.numero, ...valeurs, JSON.stringify(c.complements || {}), c.service_id, c.created_at, c.updated_at,
          c.a_photo ? 1 : 0, texteRecherche(c)]);
    }
  });
}

export async function enregistrerPhotoTelechargee(id, photo) {
  const db = await base();
  await db.runAsync('UPDATE contribuables SET photo = ?, a_photo = 1 WHERE id = ?', [photo, id]);
}

// ---------------------------------------------------------------------------
// Paiements
// ---------------------------------------------------------------------------
export async function creerPaiement(p, agent) {
  const db = await base();
  const maintenant = new Date();
  const prefixe = prefixeRecu(agent.identifiant, maintenant);
  // Compteur du jour : on repart du plus grand numéro déjà connu (y compris ceux revenus du serveur)
  const dernier = await db.getFirstAsync(
    'SELECT numero_recu FROM paiements WHERE numero_recu LIKE ? ORDER BY numero_recu DESC LIMIT 1', [`${prefixe}%`]);
  const rang = dernier ? Number(dernier.numero_recu.slice(prefixe.length)) + 1 : 1;
  const paiement = {
    id: Crypto.randomUUID(),
    numero_recu: `${prefixe}${String(rang).padStart(4, '0')}`,
    agent_id: agent.id,
    date_paiement: maintenant.toISOString(),
    statut: 'VALIDE',
    ...p,
  };
  await db.runAsync(
    `INSERT INTO paiements (id, numero_recu, contribuable_id, tache_id, agent_id, montant, base_valeur, categorie, periode,
                            mode_paiement, telephone_sms, latitude, longitude, date_paiement, statut, etat_synchro)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'EN_ATTENTE')`,
    [paiement.id, paiement.numero_recu, paiement.contribuable_id, paiement.tache_id, paiement.agent_id, paiement.montant,
      vide(paiement.base_valeur), vide(paiement.categorie), paiement.periode, paiement.mode_paiement, vide(paiement.telephone_sms),
      vide(paiement.latitude), vide(paiement.longitude), paiement.date_paiement, paiement.statut]);
  return paiement;
}

export async function lirePaiement(id) {
  const db = await base();
  return db.getFirstAsync('SELECT * FROM paiements WHERE id = ?', [id]);
}

export async function paiementsDuContribuable(contribuableId) {
  const db = await base();
  return db.getAllAsync('SELECT * FROM paiements WHERE contribuable_id = ? ORDER BY date_paiement DESC', [contribuableId]);
}

export async function paiementsDuJour(agentId, jour = jourIso()) {
  const db = await base();
  const lignes = await db.getAllAsync(
    `SELECT p.*, c.nom, c.prenoms, c.numero AS contribuable_numero
     FROM paiements p LEFT JOIN contribuables c ON c.id = p.contribuable_id
     WHERE p.agent_id = ? ORDER BY p.date_paiement DESC LIMIT 500`, [agentId]);
  // Filtre sur la date locale du téléphone (date_paiement est stockée en UTC)
  return lignes.filter((p) => jourIso(new Date(p.date_paiement)) === jour);
}

export async function recensesDuJour(jour = jourIso()) {
  const db = await base();
  const lignes = await db.getAllAsync(
    "SELECT id, created_at FROM contribuables WHERE created_at >= ?", [new Date(Date.now() - 2 * 86400000).toISOString()]);
  return lignes.filter((c) => jourIso(new Date(c.created_at)) === jour).length;
}

export async function paiementsAEnvoyer(limite) {
  const db = await base();
  return db.getAllAsync("SELECT * FROM paiements WHERE etat_synchro = 'EN_ATTENTE' ORDER BY date_paiement LIMIT ?", [limite]);
}

export async function marquerPaiement(id, { etat, erreur }) {
  const db = await base();
  await db.runAsync('UPDATE paiements SET etat_synchro = ?, erreur_synchro = ? WHERE id = ?', [etat, erreur ?? null, id]);
}

export async function fusionnerPaiements(liste) {
  if (!liste.length) return;
  const db = await base();
  await db.withTransactionAsync(async () => {
    for (const p of liste) {
      await db.runAsync(
        `INSERT INTO paiements (id, numero_recu, contribuable_id, tache_id, agent_id, montant, base_valeur, categorie, periode,
                                mode_paiement, date_paiement, statut, etat_synchro)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'SYNCHRONISE')
         ON CONFLICT(id) DO UPDATE SET statut = excluded.statut, etat_synchro = 'SYNCHRONISE', erreur_synchro = NULL`,
        [p.id, p.numero_recu, p.contribuable_id, p.tache_id, p.agent_id, p.montant, p.base_valeur, p.categorie, p.periode,
          p.mode_paiement, new Date(p.date_paiement).toISOString(), p.statut]);
    }
  });
}

// ---------------------------------------------------------------------------
// État de la file d'envoi
// ---------------------------------------------------------------------------
export async function etatFile() {
  const db = await base();
  const r = await db.getFirstAsync(
    `SELECT
       (SELECT count(*) FROM contribuables WHERE etat_synchro = 'EN_ATTENTE') AS contribuables,
       (SELECT count(*) FROM paiements WHERE etat_synchro = 'EN_ATTENTE') AS paiements,
       (SELECT count(*) FROM contribuables WHERE etat_synchro = 'ERREUR') +
       (SELECT count(*) FROM paiements WHERE etat_synchro = 'ERREUR') AS erreurs`);
  return { ...r, total: r.contribuables + r.paiements };
}

export async function elementsEnErreur() {
  const db = await base();
  const c = await db.getAllAsync(
    "SELECT id, nom, prenoms, erreur_synchro, 'contribuable' AS type FROM contribuables WHERE etat_synchro = 'ERREUR'");
  const p = await db.getAllAsync(
    "SELECT id, numero_recu AS nom, NULL AS prenoms, erreur_synchro, 'paiement' AS type FROM paiements WHERE etat_synchro = 'ERREUR'");
  return [...c, ...p];
}

// Remet en file les éléments refusés (après correction de la fiche ou du paramétrage côté service)
export async function reessayerErreurs() {
  const db = await base();
  await db.execAsync(
    "UPDATE contribuables SET etat_synchro = 'EN_ATTENTE' WHERE etat_synchro = 'ERREUR'; UPDATE paiements SET etat_synchro = 'EN_ATTENTE' WHERE etat_synchro = 'ERREUR';");
}
