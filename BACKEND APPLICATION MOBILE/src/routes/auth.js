import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, journaliser, lireBaseId } from '../db.js';
import { signerJeton } from '../auth.js';
import { asynchrone } from '../outils.js';

const router = Router();

// Connexion d'un agent : l'application reconnaît son service et en charge la configuration.
router.post('/login', asynchrone(async (req, res) => {
  const { identifiant, mot_de_passe: motDePasse } = req.body || {};
  if (!identifiant || !motDePasse) return res.status(400).json({ message: 'Identifiant et mot de passe requis' });

  const { rows } = await query(
    `SELECT u.*, s.sigle, s.nom AS service_nom, s.actif AS service_actif
     FROM utilisateurs u LEFT JOIN services s ON s.id = u.service_id
     WHERE upper(u.identifiant) = upper($1)`, [identifiant.trim()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(motDePasse, u.mot_de_passe_hash))) {
    return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect' });
  }
  if (u.role !== 'AGENT') return res.status(403).json({ message: 'Ce compte n\'est pas un compte d\'agent de terrain' });
  if (!u.actif) return res.status(403).json({ message: 'Compte désactivé : contactez votre chef de service' });
  if (!u.service_actif) return res.status(403).json({ message: 'Votre service est désactivé par la Mairie' });

  await query('UPDATE utilisateurs SET derniere_connexion = now() WHERE id = $1', [u.id]);
  await journaliser({ query }, { utilisateurId: u.id, serviceId: u.service_id, action: 'CONNEXION', entite: 'utilisateur', entiteId: u.id });

  res.json({
    jeton: signerJeton(u),
    base_id: await lireBaseId(),
    agent: {
      id: u.id, identifiant: u.identifiant, nom: u.nom, prenoms: u.prenoms, telephone: u.telephone,
      service: { id: u.service_id, sigle: u.sigle, nom: u.service_nom },
    },
  });
}));

export default router;
