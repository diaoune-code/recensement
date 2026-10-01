import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, journaliser } from '../db.js';
import { signerJeton, exigerMairie } from '../auth.js';
import { asynchrone } from '../outils.js';

const router = Router();

router.post('/login', asynchrone(async (req, res) => {
  const { identifiant, mot_de_passe: motDePasse } = req.body || {};
  if (!identifiant || !motDePasse) return res.status(400).json({ message: 'Identifiant et mot de passe requis' });
  const { rows: [u] } = await query('SELECT * FROM utilisateurs WHERE lower(identifiant) = lower($1)', [identifiant.trim()]);
  if (!u || !(await bcrypt.compare(motDePasse, u.mot_de_passe_hash))) {
    return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect' });
  }
  if (u.role !== 'MAIRIE') return res.status(403).json({ message: 'Ce compte n\'a pas accès à l\'application de la Mairie' });
  if (!u.actif) return res.status(403).json({ message: 'Compte désactivé' });

  await query('UPDATE utilisateurs SET derniere_connexion = now() WHERE id = $1', [u.id]);
  await journaliser({ query }, { utilisateurId: u.id, action: 'CONNEXION', entite: 'utilisateur', entiteId: u.id });
  res.json({
    jeton: signerJeton(u),
    utilisateur: { id: u.id, identifiant: u.identifiant, nom: u.nom, prenoms: u.prenoms, fonction: u.fonction },
  });
}));

router.get('/moi', exigerMairie, (req, res) => res.json(req.utilisateur));

export default router;
