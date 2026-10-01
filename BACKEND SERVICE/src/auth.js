import jwt from 'jsonwebtoken';
import { query } from './db.js';

export function signerJeton(u) {
  return jwt.sign({ sub: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_DUREE || '12h' });
}

// Réservé aux chefs de service. Toutes les routes travaillent ensuite sur req.chef.service_id :
// un service ne voit et ne modifie que ses propres agents, tâches et encaissements.
export async function exigerChef(req, res, next) {
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
    `SELECT u.id, u.identifiant, u.nom, u.prenoms, u.fonction, u.service_id, s.sigle, s.nom AS service_nom
     FROM utilisateurs u JOIN services s ON s.id = u.service_id
     WHERE u.id = $1 AND u.role = 'CHEF_SERVICE' AND u.actif AND s.actif`, [charge.sub]);
  // 401 : l'application renvoie vers la page de connexion (compte supprimé, désactivé, ou service désactivé)
  if (!rows.length) return res.status(401).json({ message: 'Compte introuvable ou désactivé' });
  req.chef = rows[0];
  next();
}
