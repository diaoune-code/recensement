import jwt from 'jsonwebtoken';
import { query } from './db.js';

export function signerJeton(u) {
  return jwt.sign({ sub: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_DUREE || '12h' });
}

// Réservé aux comptes MAIRIE (Maire, Vice-Maires, pool financier de la Mairie)
export async function exigerMairie(req, res, next) {
  const entete = req.headers.authorization || '';
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7) : null;
  if (!jeton) return res.status(401).json({ message: 'Authentification requise' });
  let charge;
  try {
    charge = jwt.verify(jeton, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Session expirée, reconnectez-vous' });
  }
  const { rows } = await query(
    `SELECT id, identifiant, nom, prenoms, fonction FROM utilisateurs WHERE id = $1 AND role = 'MAIRIE' AND actif`, [charge.sub]);
  // 401 : l'application renvoie vers la page de connexion (compte supprimé ou désactivé)
  if (!rows.length) return res.status(401).json({ message: 'Compte introuvable ou désactivé' });
  req.utilisateur = rows[0];
  next();
}
