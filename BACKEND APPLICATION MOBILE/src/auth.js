import jwt from 'jsonwebtoken';
import { query } from './db.js';

export function signerJeton(agent) {
  return jwt.sign({ sub: agent.id, role: 'AGENT' }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_DUREE || '30d' });
}

// Vérifie le jeton puis recharge l'agent : un agent désactivé par son service perd l'accès immédiatement.
export async function exigerAgent(req, res, next) {
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
    `SELECT u.id, u.identifiant, u.nom, u.prenoms, u.service_id, s.sigle, s.nom AS service_nom
     FROM utilisateurs u JOIN services s ON s.id = u.service_id
     WHERE u.id = $1 AND u.role = 'AGENT' AND u.actif AND s.actif`, [charge.sub]);
  // 401 : le téléphone redemande la connexion (compte supprimé, désactivé, ou base réinitialisée)
  if (!rows.length) return res.status(401).json({ message: 'Compte agent introuvable ou désactivé' });
  req.agent = rows[0];
  next();
}
