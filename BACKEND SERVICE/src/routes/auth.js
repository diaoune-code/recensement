import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, journaliser } from '../db.js';
import { signerJeton, exigerChef } from '../auth.js';
import { asynchrone } from '../outils.js';

const router = Router();

router.post('/login', asynchrone(async (req, res) => {
  const { identifiant, mot_de_passe: motDePasse } = req.body || {};
  if (!identifiant || !motDePasse) return res.status(400).json({ message: 'Identifiant et mot de passe requis' });
  const { rows: [u] } = await query(
    `SELECT u.*, s.sigle, s.nom AS service_nom, s.actif AS service_actif
     FROM utilisateurs u LEFT JOIN services s ON s.id = u.service_id
     WHERE lower(u.identifiant) = lower($1)`, [identifiant.trim()]);
  if (!u || !(await bcrypt.compare(motDePasse, u.mot_de_passe_hash))) {
    return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect' });
  }
  if (u.role !== 'CHEF_SERVICE') return res.status(403).json({ message: 'Ce compte n\'est pas un compte de responsable de service' });
  if (!u.actif) return res.status(403).json({ message: 'Compte désactivé' });
  if (!u.service_actif) return res.status(403).json({ message: 'Ce service est désactivé par la Mairie' });

  await query('UPDATE utilisateurs SET derniere_connexion = now() WHERE id = $1', [u.id]);
  await journaliser({ query }, { utilisateurId: u.id, serviceId: u.service_id, action: 'CONNEXION', entite: 'utilisateur', entiteId: u.id });
  res.json({
    jeton: signerJeton(u),
    utilisateur: {
      id: u.id, identifiant: u.identifiant, nom: u.nom, prenoms: u.prenoms, fonction: u.fonction,
      service: { id: u.service_id, sigle: u.sigle, nom: u.service_nom },
    },
  });
}));

router.get('/moi', exigerChef, (req, res) => {
  const c = req.chef;
  res.json({ id: c.id, identifiant: c.identifiant, nom: c.nom, prenoms: c.prenoms, fonction: c.fonction,
    service: { id: c.service_id, sigle: c.sigle, nom: c.service_nom } });
});

export default router;
