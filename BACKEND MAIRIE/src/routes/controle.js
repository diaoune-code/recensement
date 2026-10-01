import { Router } from 'express';
import { query } from '../db.js';
import { asynchrone } from '../outils.js';

const router = Router();

// Vérification d'un reçu (numéro saisi ou lu dans le QR code du reçu)
router.get('/recus/:numero', asynchrone(async (req, res) => {
  // Le QR code contient « LAMBANYI|<numéro>|<montant>|<date> » : on accepte aussi ce format.
  const numero = decodeURIComponent(req.params.numero).split('|').length > 1
    ? decodeURIComponent(req.params.numero).split('|')[1]
    : decodeURIComponent(req.params.numero);
  const { rows: [r] } = await query(
    `SELECT p.numero_recu, p.montant, p.periode, p.mode_paiement, p.date_paiement, p.recu_le, p.statut,
            p.base_valeur, p.categorie, t.libelle AS tache, t.ligne_code, s.sigle, s.nom AS service,
            u.identifiant AS agent, u.nom || coalesce(' ' || u.prenoms, '') AS agent_nom,
            c.id AS contribuable_id, c.numero AS contribuable_numero, c.nom || coalesce(' ' || c.prenoms, '') AS contribuable,
            cl.statut AS cloture_statut, cl.jour AS cloture_jour
     FROM paiements p JOIN taches t ON t.id = p.tache_id JOIN services s ON s.id = p.service_id
     JOIN utilisateurs u ON u.id = p.agent_id JOIN contribuables c ON c.id = p.contribuable_id
     LEFT JOIN clotures cl ON cl.id = p.cloture_id
     WHERE upper(p.numero_recu) = upper($1)`, [numero.trim()]);
  if (!r) return res.status(404).json({ message: `Aucun encaissement enregistré sous le numéro ${numero}` });
  res.json(r);
}));

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
