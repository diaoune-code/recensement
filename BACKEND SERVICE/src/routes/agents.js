import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, journaliser } from '../db.js';
import { asynchrone, periode } from '../outils.js';

const router = Router();

// Suivi des agents : recensés et montants encaissés par agent sur la période
router.get('/agents', asynchrone(async (req, res) => {
  const { du, au } = periode(req);
  const { rows } = await query(
    `SELECT u.id, u.identifiant, u.nom, u.prenoms, u.telephone, u.actif, u.derniere_connexion, u.created_at,
            coalesce(p.montant,0) AS montant, coalesce(p.nb,0)::int AS nb_paiements, p.dernier AS dernier_encaissement,
            coalesce(c.nb,0)::int AS nb_recenses
     FROM utilisateurs u
     LEFT JOIN (SELECT agent_id, sum(montant) AS montant, count(*) AS nb, max(date_paiement) AS dernier
                FROM paiements WHERE statut='VALIDE' AND date_paiement BETWEEN $2 AND $3 GROUP BY 1) p ON p.agent_id = u.id
     LEFT JOIN (SELECT agent_id, count(*) AS nb FROM contribuables WHERE created_at BETWEEN $2 AND $3 GROUP BY 1) c ON c.agent_id = u.id
     WHERE u.service_id = $1 AND u.role = 'AGENT'
     ORDER BY u.actif DESC, montant DESC, u.identifiant`, [req.chef.service_id, du, au]);
  res.json(rows);
}));

// Inscription d'un agent : il sera rattaché automatiquement à ce service (règle « un agent, un service »)
router.post('/agents', asynchrone(async (req, res) => {
  const { nom, prenoms, telephone, mot_de_passe: mdp } = req.body || {};
  let { identifiant } = req.body || {};
  if (!nom || !mdp) return res.status(400).json({ message: 'Nom et mot de passe obligatoires' });
  if (mdp.length < 6) return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });

  if (!identifiant) {
    // Identifiant automatique : <SIGLE>-<numéro sur 3 chiffres>, ex. CAD-004
    const { rows: [{ max }] } = await query(
      `SELECT coalesce(max(substring(identifiant FROM '-(\\d+)$')::int), 0) AS max
       FROM utilisateurs WHERE identifiant ~ ('^' || $1 || '-\\d+$')`, [req.chef.sigle]);
    identifiant = `${req.chef.sigle}-${String(max + 1).padStart(3, '0')}`;
  }
  const hash = await bcrypt.hash(mdp, 10);
  const { rows: [u] } = await query(
    `INSERT INTO utilisateurs (identifiant, nom, prenoms, telephone, role, service_id, mot_de_passe_hash, cree_par)
     VALUES (upper($1),$2,$3,$4,'AGENT',$5,$6,$7)
     RETURNING id, identifiant, nom, prenoms, telephone, actif, created_at`,
    [identifiant.trim(), nom.trim(), prenoms || null, telephone || null, req.chef.service_id, hash, req.chef.id]);
  await journaliser({ query }, { utilisateurId: req.chef.id, serviceId: req.chef.service_id, action: 'INSCRIPTION_AGENT', entite: 'utilisateur', entiteId: u.id, details: { identifiant: u.identifiant } });
  res.status(201).json(u);
}));

router.put('/agents/:id', asynchrone(async (req, res) => {
  const { nom, prenoms, telephone, actif, mot_de_passe: mdp } = req.body || {};
  if (mdp && mdp.length < 6) return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
  const hash = mdp ? await bcrypt.hash(mdp, 10) : null;
  const { rows: [u] } = await query(
    `UPDATE utilisateurs SET nom = coalesce($1, nom), prenoms = coalesce($2, prenoms), telephone = coalesce($3, telephone),
            actif = coalesce($4, actif), mot_de_passe_hash = coalesce($5, mot_de_passe_hash)
     WHERE id = $6 AND service_id = $7 AND role = 'AGENT'
     RETURNING id, identifiant, nom, prenoms, telephone, actif`,
    [nom || null, prenoms || null, telephone || null, actif ?? null, hash, req.params.id, req.chef.service_id]);
  if (!u) return res.status(404).json({ message: 'Agent introuvable dans ce service' });
  const action = mdp ? 'REINIT_MOT_DE_PASSE' : (actif !== undefined ? (actif ? 'ACTIVATION_AGENT' : 'DESACTIVATION_AGENT') : 'MODIFICATION_AGENT');
  await journaliser({ query }, { utilisateurId: req.chef.id, serviceId: req.chef.service_id, action, entite: 'utilisateur', entiteId: u.id, details: { identifiant: u.identifiant } });
  res.json(u);
}));

export default router;
