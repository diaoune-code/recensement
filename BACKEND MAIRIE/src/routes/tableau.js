import { Router } from 'express';
import { query } from '../db.js';
import { asynchrone, periode } from '../outils.js';

const router = Router();

// Tableau de bord consolidé : comparer les services et repérer ceux qui décrochent
router.get('/tableau-de-bord', asynchrone(async (req, res) => {
  const { du, au } = periode(req);
  const p = [du, au];

  const [totaux, parService, evolution, parQuartier, recents] = await Promise.all([
    query(
      `SELECT
         (SELECT coalesce(sum(montant),0) FROM paiements WHERE statut='VALIDE' AND date_paiement BETWEEN $1 AND $2) AS montant,
         (SELECT count(*)::int FROM paiements WHERE statut='VALIDE' AND date_paiement BETWEEN $1 AND $2) AS nb_paiements,
         (SELECT count(*)::int FROM contribuables WHERE created_at BETWEEN $1 AND $2) AS nb_recenses,
         (SELECT count(*)::int FROM contribuables) AS nb_contribuables,
         (SELECT count(*)::int FROM utilisateurs WHERE role='AGENT' AND actif) AS nb_agents,
         (SELECT count(DISTINCT agent_id)::int FROM paiements WHERE date_paiement BETWEEN $1 AND $2) AS nb_agents_actifs,
         (SELECT count(*)::int FROM contribuables WHERE doublon_suspect_de IS NOT NULL) AS nb_doublons`, p),
    query(
      `SELECT s.id, s.sigle, s.nom, s.actif,
              coalesce(pa.montant,0) AS montant, coalesce(pa.nb,0)::int AS nb_paiements,
              coalesce(co.nb,0)::int AS nb_recenses, coalesce(ag.nb,0)::int AS nb_agents,
              coalesce(ta.nb,0)::int AS nb_taxes
       FROM services s
       LEFT JOIN (SELECT service_id, sum(montant) AS montant, count(*) AS nb FROM paiements
                  WHERE statut='VALIDE' AND date_paiement BETWEEN $1 AND $2 GROUP BY 1) pa ON pa.service_id = s.id
       LEFT JOIN (SELECT service_id, count(*) AS nb FROM contribuables WHERE created_at BETWEEN $1 AND $2 GROUP BY 1) co ON co.service_id = s.id
       LEFT JOIN (SELECT service_id, count(*) AS nb FROM utilisateurs WHERE role='AGENT' AND actif GROUP BY 1) ag ON ag.service_id = s.id
       LEFT JOIN (SELECT service_id, count(*) AS nb FROM taches WHERE actif GROUP BY 1) ta ON ta.service_id = s.id
       ORDER BY montant DESC, s.code`, p),
    query(
      `SELECT to_char(d, 'YYYY-MM-DD') AS jour, coalesce(sum(pa.montant),0) AS montant, count(pa.id)::int AS nb
       FROM generate_series($1::date, $2::date, interval '1 day') d
       LEFT JOIN paiements pa ON pa.date_paiement::date = d::date AND pa.statut = 'VALIDE'
       GROUP BY d ORDER BY d`, p),
    query(
      `SELECT q.quartier, q.nb_contribuables, coalesce(m.montant,0) AS montant
       FROM (SELECT coalesce(quartier,'Non renseigné') AS quartier, count(*)::int AS nb_contribuables
             FROM contribuables GROUP BY 1) q
       LEFT JOIN (SELECT coalesce(c.quartier,'Non renseigné') AS quartier, sum(pa.montant) AS montant
                  FROM paiements pa JOIN contribuables c ON c.id = pa.contribuable_id
                  WHERE pa.statut='VALIDE' AND pa.date_paiement BETWEEN $1 AND $2 GROUP BY 1) m ON m.quartier = q.quartier
       ORDER BY montant DESC`, p),
    query(
      `SELECT pa.numero_recu, pa.montant, pa.date_paiement, s.sigle, t.libelle AS tache,
              c.nom || coalesce(' ' || c.prenoms, '') AS contribuable
       FROM paiements pa JOIN services s ON s.id = pa.service_id JOIN taches t ON t.id = pa.tache_id
       JOIN contribuables c ON c.id = pa.contribuable_id
       ORDER BY pa.date_paiement DESC LIMIT 8`),
  ]);

  res.json({
    periode: { du, au },
    totaux: totaux.rows[0],
    par_service: parService.rows,
    evolution: evolution.rows,
    par_quartier: parQuartier.rows,
    derniers_paiements: recents.rows,
  });
}));

// Prévu / collecté : écart entre les prévisions primitives du budget 2025 et les encaissements de l'année
router.get('/prevu-collecte', asynchrone(async (req, res) => {
  const annee = Number(req.query.annee) || new Date().getFullYear();
  // Prévision calculée (vue previsions_taxes) : montant de la taxe × contribuables recensés qui doivent la payer
  const { rows: taxes } = await query(
    `SELECT t.id, t.libelle, t.ligne_code, l.libelle AS ligne_libelle, t.frequence, t.mode_calcul, t.montant,
            t.tarif_unitaire, t.base_libelle, t.bareme, t.actif, s.id AS service_id, s.sigle, s.nom AS service,
            coalesce(v.nb_contribuables, 0) AS nb_contribuables, coalesce(v.prevision, 0) AS prevision,
            coalesce(p.collecte, 0) AS collecte
     FROM taches t
     JOIN services s ON s.id = t.service_id
     LEFT JOIN lignes_recettes l ON l.code = t.ligne_code
     LEFT JOIN previsions_taxes v ON v.taxe_id = t.id
     LEFT JOIN (SELECT tache_id, sum(montant) AS collecte FROM paiements
                WHERE statut = 'VALIDE' AND extract(year FROM date_paiement) = $1 GROUP BY 1) p ON p.tache_id = t.id
     WHERE t.actif OR p.collecte > 0
     ORDER BY s.sigle, t.libelle`, [annee]);

  const parService = new Map();
  for (const t of taxes) {
    const s = parService.get(t.sigle) || { sigle: t.sigle, service: t.service, nb_taxes: 0, nb_contribuables: 0, prevision: 0, collecte: 0 };
    s.nb_taxes += 1;
    s.nb_contribuables += t.nb_contribuables;
    s.prevision += t.prevision;
    s.collecte += t.collecte;
    parService.set(t.sigle, s);
  }
  const total = taxes.reduce((a, t) => ({ prevision: a.prevision + t.prevision, collecte: a.collecte + t.collecte }),
    { prevision: 0, collecte: 0 });

  res.json({
    annee,
    total,
    par_service: [...parService.values()].sort((a, b) => b.prevision - a.prevision),
    taxes,
  });
}));

export default router;
