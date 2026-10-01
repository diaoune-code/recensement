import { Router } from 'express';
import { query } from '../db.js';
import { asynchrone, UUID_RE } from '../outils.js';

const router = Router();

// Fiches contribuables, tous services confondus : connaître l'assiette fiscale de la commune
router.get('/contribuables', asynchrone(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const taille = Math.min(100, Number(req.query.taille) || 25);
  const conditions = [];
  const params = [];
  if (req.query.q) {
    params.push(`%${req.query.q.trim()}%`);
    const i = params.length;
    conditions.push(`(c.nom ILIKE $${i} OR c.prenoms ILIKE $${i} OR c.raison_sociale ILIKE $${i} OR c.telephone ILIKE $${i}
                      OR c.numero ILIKE $${i} OR c.numero_etal ILIKE $${i} OR c.numero_porte ILIKE $${i})`);
  }
  if (req.query.quartier) {
    params.push(req.query.quartier);
    conditions.push(`c.quartier = $${params.length}`);
  }
  if (req.query.service_id) {
    params.push(Number(req.query.service_id));
    conditions.push(`(c.service_id = $${params.length} OR EXISTS (SELECT 1 FROM paiements x WHERE x.contribuable_id = c.id AND x.service_id = $${params.length}))`);
  }
  if (req.query.doublons === '1') conditions.push('c.doublon_suspect_de IS NOT NULL');
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [liste, total] = await Promise.all([
    query(
      `SELECT c.id, c.numero, c.type_contribuable, c.nom, c.prenoms, c.raison_sociale, c.telephone, c.quartier,
              c.activite_principale, c.nom_marche, c.numero_etal, c.created_at, c.doublon_suspect_de,
              s.sigle AS service_sigle, u.identifiant AS agent,
              coalesce((SELECT sum(montant) FROM paiements p WHERE p.contribuable_id = c.id AND p.statut='VALIDE'),0) AS total_paye
       FROM contribuables c JOIN services s ON s.id = c.service_id JOIN utilisateurs u ON u.id = c.agent_id
       ${where} ORDER BY c.created_at DESC
       LIMIT ${taille} OFFSET ${(page - 1) * taille}`, params),
    query(`SELECT count(*)::int AS n FROM contribuables c ${where}`, params),
  ]);
  res.json({ elements: liste.rows, total: total.rows[0].n, page, taille });
}));

router.get('/contribuables/:id', asynchrone(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide' });
  const { rows: [c] } = await query(
    `SELECT c.*, s.sigle AS service_sigle, s.nom AS service_nom,
            u.identifiant AS agent, u.nom || coalesce(' ' || u.prenoms, '') AS agent_nom,
            m.identifiant AS modifie_par_identifiant, d.numero AS doublon_numero,
            ph.image_base64 AS photo
     FROM contribuables c
     JOIN services s ON s.id = c.service_id
     JOIN utilisateurs u ON u.id = c.agent_id
     LEFT JOIN utilisateurs m ON m.id = c.modifie_par
     LEFT JOIN contribuables d ON d.id = c.doublon_suspect_de
     LEFT JOIN contribuable_photos ph ON ph.contribuable_id = c.id
     WHERE c.id = $1`, [req.params.id]);
  if (!c) return res.status(404).json({ message: 'Contribuable introuvable' });

  const { rows: paiements } = await query(
    `SELECT p.id, p.numero_recu, p.montant, p.periode, p.mode_paiement, p.date_paiement, p.statut,
            t.libelle AS tache, t.ligne_code, s.sigle, s.nom AS service, u.identifiant AS agent
     FROM paiements p JOIN taches t ON t.id = p.tache_id JOIN services s ON s.id = p.service_id
     JOIN utilisateurs u ON u.id = p.agent_id
     WHERE p.contribuable_id = $1 ORDER BY p.date_paiement DESC`, [req.params.id]);
  res.json({ ...c, paiements });
}));

// Carte : contribuables géolocalisés et couverture par quartier
router.get('/carte', asynchrone(async (req, res) => {
  const params = [];
  let filtre = '';
  if (req.query.service_id) {
    params.push(Number(req.query.service_id));
    filtre = 'AND c.service_id = $1';
  }
  const [points, quartiers] = await Promise.all([
    query(
      `SELECT c.id, c.numero, c.nom, c.prenoms, c.quartier, c.activite_principale,
              c.latitude::float AS lat, c.longitude::float AS lon, s.sigle,
              coalesce((SELECT sum(montant) FROM paiements p WHERE p.contribuable_id = c.id AND p.statut='VALIDE'),0) AS total_paye
       FROM contribuables c JOIN services s ON s.id = c.service_id
       WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL ${filtre}`, params),
    query(
      `SELECT q.nom, q.latitude::float AS lat, q.longitude::float AS lon,
              (SELECT count(*)::int FROM contribuables c WHERE c.quartier = q.nom) AS nb_contribuables
       FROM quartiers q WHERE q.actif ORDER BY q.nom`),
  ]);
  res.json({ points: points.rows, quartiers: quartiers.rows });
}));

export default router;
