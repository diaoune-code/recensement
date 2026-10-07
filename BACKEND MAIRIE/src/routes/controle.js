import { Router } from 'express';
import { query } from '../db.js';
import { asynchrone } from '../outils.js';

const router = Router();

// La vérification des reçus se fait désormais dans l'application Service (BACKEND SERVICE, GET /api/recus/:numero)

// Journal des actions : traçabilité et contrôle interne
router.get('/journal', asynchrone(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const taille = 50;
  const conditions = [];
  const params = [];
  if (req.query.application) { params.push(req.query.application); conditions.push(`j.application = $${params.length}`); }
  if (req.query.action) { params.push(req.query.action); conditions.push(`j.action = $${params.length}`); }
  if (req.query.service_id) { params.push(Number(req.query.service_id)); conditions.push(`j.service_id = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [liste, total] = await Promise.all([
    query(
      `SELECT j.id, j.application, j.action, j.entite, j.entite_id, j.details, j.created_at,
              u.identifiant, u.nom || coalesce(' ' || u.prenoms, '') AS utilisateur, s.sigle
       FROM journal j LEFT JOIN utilisateurs u ON u.id = j.utilisateur_id LEFT JOIN services s ON s.id = j.service_id
       ${where} ORDER BY j.created_at DESC LIMIT ${taille} OFFSET ${(page - 1) * taille}`, params),
    query(`SELECT count(*)::int AS n FROM journal j ${where}`, params),
  ]);
  res.json({ elements: liste.rows, total: total.rows[0].n, page, taille });
}));

// Reçus SMS (simulés : aucun opérateur branché dans le prototype)
router.get('/sms', asynchrone(async (_req, res) => {
  const { rows } = await query('SELECT * FROM sms_envoyes ORDER BY created_at DESC LIMIT 200');
  res.json(rows);
}));

// Clôtures de caisse de tous les services
router.get('/clotures', asynchrone(async (_req, res) => {
  const { rows } = await query(
    `SELECT cl.*, s.sigle, u.identifiant AS agent, u.nom || coalesce(' ' || u.prenoms, '') AS agent_nom,
            v.identifiant AS valide_par_identifiant
     FROM clotures cl JOIN services s ON s.id = cl.service_id JOIN utilisateurs u ON u.id = cl.agent_id
     JOIN utilisateurs v ON v.id = cl.validee_par
     ORDER BY cl.jour DESC, s.sigle LIMIT 300`);
  res.json(rows);
}));

export default router;
