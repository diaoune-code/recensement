import { Router } from 'express';
import { query, transaction, journaliser } from '../db.js';
import { asynchrone, periode, UUID_RE, ErreurMetier } from '../outils.js';

const router = Router();

// Tableau de bord du service : par agent, par jour, par quartier, par tâche
router.get('/tableau-de-bord', asynchrone(async (req, res) => {
  const { du, au } = periode(req);
  const p = [req.chef.service_id, du, au];
  const [totaux, parJour, parQuartier, parTache, parAgent] = await Promise.all([
    query(
      `SELECT
         (SELECT coalesce(sum(montant),0) FROM paiements WHERE service_id=$1 AND statut='VALIDE' AND date_paiement BETWEEN $2 AND $3) AS montant,
         (SELECT count(*)::int FROM paiements WHERE service_id=$1 AND statut='VALIDE' AND date_paiement BETWEEN $2 AND $3) AS nb_paiements,
         (SELECT count(*)::int FROM contribuables WHERE service_id=$1 AND created_at BETWEEN $2 AND $3) AS nb_recenses,
         (SELECT count(*)::int FROM utilisateurs WHERE service_id=$1 AND role='AGENT' AND actif) AS nb_agents,
         (SELECT coalesce(sum(montant),0) FROM paiements WHERE service_id=$1 AND statut='VALIDE' AND cloture_id IS NULL) AS a_cloturer`, p),
    query(
      `SELECT to_char(d, 'YYYY-MM-DD') AS jour, coalesce(sum(pa.montant),0) AS montant, count(pa.id)::int AS nb
       FROM generate_series($2::date, $3::date, interval '1 day') d
       LEFT JOIN paiements pa ON pa.date_paiement::date = d::date AND pa.statut='VALIDE' AND pa.service_id = $1
       GROUP BY d ORDER BY d`, p),
    query(
      `SELECT coalesce(c.quartier,'Non renseigné') AS quartier, sum(pa.montant) AS montant, count(*)::int AS nb
       FROM paiements pa JOIN contribuables c ON c.id = pa.contribuable_id
       WHERE pa.service_id=$1 AND pa.statut='VALIDE' AND pa.date_paiement BETWEEN $2 AND $3
       GROUP BY 1 ORDER BY 2 DESC`, p),
    query(
      `SELECT t.libelle, t.ligne_code, sum(pa.montant) AS montant, count(*)::int AS nb
       FROM paiements pa JOIN taches t ON t.id = pa.tache_id
       WHERE pa.service_id=$1 AND pa.statut='VALIDE' AND pa.date_paiement BETWEEN $2 AND $3
       GROUP BY 1,2 ORDER BY 3 DESC`, p),
    query(
      `SELECT u.identifiant, u.nom || coalesce(' ' || u.prenoms, '') AS nom,
              coalesce(sum(pa.montant),0) AS montant, count(pa.id)::int AS nb
       FROM utilisateurs u
       LEFT JOIN paiements pa ON pa.agent_id = u.id AND pa.statut='VALIDE' AND pa.date_paiement BETWEEN $2 AND $3
       WHERE u.service_id=$1 AND u.role='AGENT' AND u.actif
       GROUP BY u.id ORDER BY 3 DESC`, p),
  ]);
  res.json({ periode: { du, au }, totaux: totaux.rows[0], par_jour: parJour.rows, par_quartier: parQuartier.rows,
    par_tache: parTache.rows, par_agent: parAgent.rows });
}));

// Contribuables recensés par le service ou ayant payé au service
router.get('/contribuables', asynchrone(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const taille = 25;
  const params = [req.chef.service_id];
  let filtre = '';
  if (req.query.q) {
    params.push(`%${req.query.q.trim()}%`);
    filtre = `AND (c.nom ILIKE $2 OR c.prenoms ILIKE $2 OR c.telephone ILIKE $2 OR c.numero ILIKE $2 OR c.numero_etal ILIKE $2)`;
  }
  const base = `FROM contribuables c
    WHERE (c.service_id = $1 OR EXISTS (SELECT 1 FROM paiements x WHERE x.contribuable_id = c.id AND x.service_id = $1)) ${filtre}`;
  const [liste, total] = await Promise.all([
    query(
      `SELECT c.id, c.numero, c.nom, c.prenoms, c.raison_sociale, c.telephone, c.quartier, c.nom_marche, c.numero_etal,
              c.activite_principale, c.created_at, (c.service_id = $1) AS recense_par_service,
              (SELECT identifiant FROM utilisateurs WHERE id = c.agent_id) AS agent,
              coalesce((SELECT sum(montant) FROM paiements p WHERE p.contribuable_id = c.id AND p.service_id = $1 AND p.statut='VALIDE'),0) AS total_paye,
              (SELECT max(date_paiement) FROM paiements p WHERE p.contribuable_id = c.id AND p.service_id = $1) AS dernier_paiement
       ${base} ORDER BY c.created_at DESC LIMIT ${taille} OFFSET ${(page - 1) * taille}`, params),
    query(`SELECT count(*)::int AS n ${base}`, params),
  ]);
  res.json({ elements: liste.rows, total: total.rows[0].n, page, taille });
}));

router.get('/contribuables/:id', asynchrone(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide' });
  const { rows: [c] } = await query(
    `SELECT c.*, s.sigle AS service_sigle, s.nom AS service_nom, u.identifiant AS agent, ph.image_base64 AS photo
     FROM contribuables c JOIN services s ON s.id = c.service_id JOIN utilisateurs u ON u.id = c.agent_id
     LEFT JOIN contribuable_photos ph ON ph.contribuable_id = c.id WHERE c.id = $1`, [req.params.id]);
  if (!c) return res.status(404).json({ message: 'Contribuable introuvable' });
  const { rows: paiements } = await query(
    `SELECT p.id, p.numero_recu, p.montant, p.periode, p.mode_paiement, p.date_paiement, p.statut, t.libelle AS tache, u.identifiant AS agent
     FROM paiements p JOIN taches t ON t.id = p.tache_id JOIN utilisateurs u ON u.id = p.agent_id
     WHERE p.contribuable_id = $1 AND p.service_id = $2 ORDER BY p.date_paiement DESC`, [req.params.id, req.chef.service_id]);
  res.json({ ...c, paiements });
}));

// Encaissements du service
router.get('/paiements', asynchrone(async (req, res) => {
  const { du, au } = periode(req);
  const params = [req.chef.service_id, du, au];
  let filtre = '';
  if (req.query.agent_id && UUID_RE.test(req.query.agent_id)) {
    params.push(req.query.agent_id);
    filtre = `AND p.agent_id = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT p.id, p.numero_recu, p.montant, p.base_valeur, p.categorie, p.periode, p.mode_paiement, p.date_paiement, p.recu_le,
            p.statut, p.cloture_id, t.libelle AS tache, u.identifiant AS agent,
            c.id AS contribuable_id, c.numero AS contribuable_numero, c.nom || coalesce(' ' || c.prenoms, '') AS contribuable
     FROM paiements p JOIN taches t ON t.id = p.tache_id JOIN utilisateurs u ON u.id = p.agent_id
     JOIN contribuables c ON c.id = p.contribuable_id
     WHERE p.service_id = $1 AND p.date_paiement BETWEEN $2 AND $3 ${filtre}
     ORDER BY p.date_paiement DESC LIMIT 500`, params);
  res.json(rows);
}));

// Annulation d'un encaissement erroné (impossible après clôture de la caisse du jour)
router.patch('/paiements/:id/annuler', asynchrone(async (req, res) => {
  const motif = req.body?.motif?.trim();
  if (!motif) return res.status(400).json({ message: 'Le motif d\'annulation est obligatoire' });
  const { rows: [p] } = await query(
    `UPDATE paiements SET statut = 'ANNULE', recu_le = now()
     WHERE id = $1 AND service_id = $2 AND statut = 'VALIDE' AND cloture_id IS NULL RETURNING id, numero_recu, montant`,
    [req.params.id, req.chef.service_id]);
  if (!p) return res.status(409).json({ message: 'Encaissement introuvable, déjà annulé ou déjà clôturé' });
  await journaliser({ query }, { utilisateurId: req.chef.id, serviceId: req.chef.service_id, action: 'ANNULATION_PAIEMENT', entite: 'paiement', entiteId: p.id, details: { ...p, motif } });
  res.json(p);
}));

// ---------------------------------------------------------------------------
// Clôture journalière de caisse : rapprochement entre montants saisis et argent reversé
// ---------------------------------------------------------------------------
router.get('/clotures/a-traiter', asynchrone(async (req, res) => {
  const { rows } = await query(
    `SELECT p.agent_id, u.identifiant AS agent, u.nom || coalesce(' ' || u.prenoms, '') AS agent_nom,
            to_char(p.date_paiement::date, 'YYYY-MM-DD') AS jour, count(*)::int AS nb_paiements, sum(p.montant) AS montant_collecte,
            sum(p.montant) FILTER (WHERE p.mode_paiement = 'ESPECES') AS montant_especes
     FROM paiements p JOIN utilisateurs u ON u.id = p.agent_id
     WHERE p.service_id = $1 AND p.statut = 'VALIDE' AND p.cloture_id IS NULL
     GROUP BY p.agent_id, u.identifiant, u.nom, u.prenoms, p.date_paiement::date
     ORDER BY jour DESC, agent`, [req.chef.service_id]);
  res.json(rows);
}));

router.post('/clotures', asynchrone(async (req, res) => {
  const { agent_id: agentId, jour, montant_reverse: reverse, statut, commentaire } = req.body || {};
  if (!UUID_RE.test(agentId || '') || !/^\d{4}-\d{2}-\d{2}$/.test(jour || '')) return res.status(400).json({ message: 'Agent ou jour invalide' });
  if (!(Number(reverse) >= 0)) return res.status(400).json({ message: 'Montant reversé invalide' });
  if (!['VALIDEE', 'REJETEE'].includes(statut)) return res.status(400).json({ message: 'Statut invalide' });

  const cloture = await transaction(async (db) => {
    const { rows: [somme] } = await db.query(
      `SELECT count(*)::int AS nb, coalesce(sum(montant),0) AS montant FROM paiements
       WHERE agent_id = $1 AND service_id = $2 AND date_paiement::date = $3 AND statut = 'VALIDE' AND cloture_id IS NULL`,
      [agentId, req.chef.service_id, jour]);
    if (!somme.nb) throw new ErreurMetier(409, 'Aucun encaissement à clôturer pour cet agent ce jour-là');
    if (statut === 'VALIDEE' && Number(reverse) !== somme.montant && !commentaire?.trim()) {
      throw new ErreurMetier(400, 'Un commentaire est obligatoire pour valider une caisse avec écart');
    }
    const { rows: [cl] } = await db.query(
      `INSERT INTO clotures (agent_id, service_id, jour, nb_paiements, montant_collecte, montant_reverse, statut, commentaire, validee_par)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [agentId, req.chef.service_id, jour, somme.nb, somme.montant, Number(reverse), statut, commentaire || null, req.chef.id]);
    await db.query(
      `UPDATE paiements SET cloture_id = $1
       WHERE agent_id = $2 AND service_id = $3 AND date_paiement::date = $4 AND statut = 'VALIDE' AND cloture_id IS NULL`,
      [cl.id, agentId, req.chef.service_id, jour]);
    await journaliser(db, { utilisateurId: req.chef.id, serviceId: req.chef.service_id, action: 'CLOTURE_CAISSE', entite: 'cloture', entiteId: String(cl.id),
      details: { jour, montant_collecte: cl.montant_collecte, montant_reverse: cl.montant_reverse, ecart: cl.ecart, statut } });
    return cl;
  });
  res.status(201).json(cloture);
}));

router.get('/clotures', asynchrone(async (req, res) => {
  const { rows } = await query(
    `SELECT cl.*, u.identifiant AS agent, u.nom || coalesce(' ' || u.prenoms, '') AS agent_nom, v.identifiant AS valide_par_identifiant
     FROM clotures cl JOIN utilisateurs u ON u.id = cl.agent_id JOIN utilisateurs v ON v.id = cl.validee_par
     WHERE cl.service_id = $1 ORDER BY cl.jour DESC, u.identifiant LIMIT 200`, [req.chef.service_id]);
  res.json(rows);
}));

// Journal des actions du service
router.get('/journal', asynchrone(async (req, res) => {
  const { rows } = await query(
    `SELECT j.id, j.application, j.action, j.entite, j.entite_id, j.details, j.created_at, u.identifiant
     FROM journal j LEFT JOIN utilisateurs u ON u.id = j.utilisateur_id
     WHERE j.service_id = $1 ORDER BY j.created_at DESC LIMIT 300`, [req.chef.service_id]);
  res.json(rows);
}));

export default router;
