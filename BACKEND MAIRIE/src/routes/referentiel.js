import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, transaction, journaliser } from '../db.js';
import { asynchrone, ErreurMetier } from '../outils.js';

const router = Router();

// ---------------------------------------------------------------------------
// Services : la Mairie garde la main sur la liste des services et nomme leurs responsables
// ---------------------------------------------------------------------------
router.get('/services', asynchrone(async (_req, res) => {
  const { rows } = await query(
    `SELECT s.id, s.code, s.sigle, s.nom, s.actif,
            (SELECT count(*)::int FROM utilisateurs u WHERE u.service_id = s.id AND u.role='AGENT' AND u.actif) AS nb_agents,
            (SELECT count(*)::int FROM taches t WHERE t.service_id = s.id AND t.actif) AS nb_taches,
            (SELECT count(*)::int FROM lignes_recettes l WHERE l.service_id = s.id) AS nb_lignes,
            (SELECT json_agg(json_build_object('id', u.id, 'identifiant', u.identifiant, 'nom', u.nom, 'prenoms', u.prenoms,
                                               'telephone', u.telephone, 'fonction', u.fonction, 'actif', u.actif) ORDER BY u.nom)
             FROM utilisateurs u WHERE u.service_id = s.id AND u.role = 'CHEF_SERVICE') AS responsables
     FROM services s ORDER BY s.code`);
  res.json(rows);
}));

router.post('/services', asynchrone(async (req, res) => {
  const { code, sigle, nom } = req.body || {};
  if (!code || !sigle || !nom) return res.status(400).json({ message: 'Code, sigle et nom obligatoires' });
  const { rows: [s] } = await query(
    'INSERT INTO services (code, sigle, nom) VALUES ($1, upper($2), $3) RETURNING *', [code, sigle.trim(), nom.trim()]);
  await journaliser({ query }, { utilisateurId: req.utilisateur.id, serviceId: s.id, action: 'CREATION_SERVICE', entite: 'service', entiteId: String(s.id), details: { sigle: s.sigle, nom } });
  res.status(201).json(s);
}));

router.put('/services/:id', asynchrone(async (req, res) => {
  const { sigle, nom, actif } = req.body || {};
  const { rows: [s] } = await query(
    `UPDATE services SET sigle = coalesce(upper($1), sigle), nom = coalesce($2, nom), actif = coalesce($3, actif), updated_at = now()
     WHERE id = $4 RETURNING *`, [sigle || null, nom || null, actif ?? null, req.params.id]);
  if (!s) return res.status(404).json({ message: 'Service introuvable' });
  await journaliser({ query }, { utilisateurId: req.utilisateur.id, serviceId: s.id, action: 'MODIFICATION_SERVICE', entite: 'service', entiteId: String(s.id), details: req.body });
  res.json(s);
}));

// Création du compte du chef de service, qui inscrira ensuite ses agents depuis l'application Service
router.post('/services/:id/responsables', asynchrone(async (req, res) => {
  const { identifiant, nom, prenoms, telephone, fonction, mot_de_passe: mdp } = req.body || {};
  if (!identifiant || !nom || !mdp) return res.status(400).json({ message: 'Identifiant, nom et mot de passe obligatoires' });
  if (mdp.length < 6) return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
  const hash = await bcrypt.hash(mdp, 10);
  const { rows: [u] } = await query(
    `INSERT INTO utilisateurs (identifiant, nom, prenoms, telephone, fonction, role, service_id, mot_de_passe_hash, cree_par)
     VALUES (lower($1),$2,$3,$4,$5,'CHEF_SERVICE',$6,$7,$8) RETURNING id, identifiant, nom, prenoms, telephone, fonction, actif`,
    [identifiant.trim(), nom, prenoms || null, telephone || null, fonction || null, req.params.id, hash, req.utilisateur.id]);
  await journaliser({ query }, { utilisateurId: req.utilisateur.id, serviceId: Number(req.params.id), action: 'CREATION_RESPONSABLE', entite: 'utilisateur', entiteId: u.id, details: { identifiant: u.identifiant } });
  res.status(201).json(u);
}));

router.patch('/responsables/:id', asynchrone(async (req, res) => {
  const { actif, mot_de_passe: mdp } = req.body || {};
  if (mdp !== undefined && mdp.length < 6) return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
  const hash = mdp ? await bcrypt.hash(mdp, 10) : null;
  const { rows: [u] } = await query(
    `UPDATE utilisateurs SET actif = coalesce($1, actif), mot_de_passe_hash = coalesce($2, mot_de_passe_hash)
     WHERE id = $3 AND role = 'CHEF_SERVICE' RETURNING id, identifiant, actif, service_id`, [actif ?? null, hash, req.params.id]);
  if (!u) return res.status(404).json({ message: 'Responsable introuvable' });
  await journaliser({ query }, { utilisateurId: req.utilisateur.id, serviceId: u.service_id, action: mdp ? 'REINIT_MOT_DE_PASSE' : 'STATUT_RESPONSABLE', entite: 'utilisateur', entiteId: u.id, details: { actif: u.actif } });
  res.json(u);
}));

// ---------------------------------------------------------------------------
// Lignes de recettes : cadre commun à tous les services
// ---------------------------------------------------------------------------
router.get('/lignes-recettes', asynchrone(async (_req, res) => {
  const { rows } = await query(
    `SELECT l.code, l.libelle, l.niveau, l.parent_code, l.service_id, l.service_indique, l.prevision_2025,
            s.sigle, s.nom AS service,
            NOT EXISTS (SELECT 1 FROM lignes_recettes e WHERE e.parent_code = l.code) AS feuille,
            (SELECT count(*)::int FROM taches t WHERE t.ligne_code = l.code AND t.actif) AS nb_taches
     FROM lignes_recettes l LEFT JOIN services s ON s.id = l.service_id
     ORDER BY l.code`);
  res.json(rows);
}));

// Modification d'une ligne : service attribué et/ou prévision.
// Seules les lignes de détail (sans sous-ligne) portent une prévision saisie ;
// celles des niveaux supérieurs sont recalculées comme la somme de leurs sous-lignes.
router.put('/lignes-recettes/:code', asynchrone(async (req, res) => {
  const corps = req.body || {};
  const resultat = await transaction(async (db) => {
    const { rows: [avant] } = await db.query('SELECT * FROM lignes_recettes WHERE code = $1 FOR UPDATE', [req.params.code]);
    if (!avant) throw new ErreurMetier(404, 'Ligne introuvable');

    if ('service_id' in corps) {
      const serviceId = corps.service_id ? Number(corps.service_id) : null;
      await db.query('UPDATE lignes_recettes SET service_id = $1 WHERE code = $2', [serviceId, avant.code]);
      await journaliser(db, { utilisateurId: req.utilisateur.id, serviceId, action: 'ATTRIBUTION_LIGNE', entite: 'ligne_recette', entiteId: avant.code });
    }

    if ('prevision_2025' in corps) {
      const { rows: [{ n }] } = await db.query('SELECT count(*)::int AS n FROM lignes_recettes WHERE parent_code = $1', [avant.code]);
      if (n > 0) throw new ErreurMetier(400, 'La prévision de cette ligne est la somme de ses sous-lignes : modifiez les sous-lignes');
      const valeur = corps.prevision_2025 === '' || corps.prevision_2025 === null ? 0 : Number(corps.prevision_2025);
      if (!Number.isFinite(valeur) || valeur < 0) throw new ErreurMetier(400, 'Montant de prévision invalide');
      await db.query('UPDATE lignes_recettes SET prevision_2025 = $1 WHERE code = $2', [Math.round(valeur), avant.code]);

      // Recalcul des totaux des niveaux supérieurs (paragraphe, article, chapitre)
      let parent = avant.parent_code;
      while (parent) {
        const { rows: [p] } = await db.query(
          `UPDATE lignes_recettes SET prevision_2025 =
             (SELECT coalesce(sum(prevision_2025), 0) FROM lignes_recettes WHERE parent_code = $1)
           WHERE code = $1 RETURNING parent_code`, [parent]);
        parent = p?.parent_code;
      }
      await journaliser(db, { utilisateurId: req.utilisateur.id, serviceId: avant.service_id, action: 'MODIFICATION_PREVISION', entite: 'ligne_recette', entiteId: avant.code,
        details: { libelle: avant.libelle, ancienne: avant.prevision_2025, nouvelle: Math.round(valeur) } });
    }

    const { rows } = await db.query('SELECT * FROM lignes_recettes WHERE code = $1', [avant.code]);
    return rows[0];
  });
  res.json(resultat);
}));

// ---------------------------------------------------------------------------
// Quartiers
// ---------------------------------------------------------------------------
router.get('/quartiers', asynchrone(async (_req, res) => {
  const { rows } = await query(
    `SELECT q.*, (SELECT count(*)::int FROM contribuables c WHERE c.quartier = q.nom) AS nb_contribuables
     FROM quartiers q ORDER BY q.nom`);
  res.json(rows);
}));

router.post('/quartiers', asynchrone(async (req, res) => {
  const { nom, latitude, longitude } = req.body || {};
  if (!nom) return res.status(400).json({ message: 'Nom obligatoire' });
  const { rows: [q] } = await query(
    'INSERT INTO quartiers (nom, latitude, longitude) VALUES ($1,$2,$3) RETURNING *', [nom.trim(), latitude || null, longitude || null]);
  await journaliser({ query }, { utilisateurId: req.utilisateur.id, action: 'CREATION_QUARTIER', entite: 'quartier', entiteId: String(q.id), details: { nom } });
  res.status(201).json(q);
}));

router.put('/quartiers/:id', asynchrone(async (req, res) => {
  const { nom, latitude, longitude, actif } = req.body || {};
  const { rows: [q] } = await query(
    `UPDATE quartiers SET nom = coalesce($1, nom), latitude = $2, longitude = $3, actif = coalesce($4, actif)
     WHERE id = $5 RETURNING *`, [nom || null, latitude || null, longitude || null, actif ?? null, req.params.id]);
  if (!q) return res.status(404).json({ message: 'Quartier introuvable' });
  res.json(q);
}));

export default router;
