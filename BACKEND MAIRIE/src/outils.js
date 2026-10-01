// Express 4 ne transmet pas les erreurs des fonctions async : on les relaie au gestionnaire d'erreurs.
export const asynchrone = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Période d'analyse : ?du=AAAA-MM-JJ&au=AAAA-MM-JJ (par défaut : 30 derniers jours, bornes incluses)
export function periode(req) {
  const au = req.query.au ? new Date(`${req.query.au}T23:59:59.999`) : new Date();
  const du = req.query.du ? new Date(`${req.query.du}T00:00:00`) : new Date(au.getTime() - 29 * 86400000);
  if (!req.query.du) du.setHours(0, 0, 0, 0);
  return { du, au };
}

export class ErreurMetier extends Error {
  constructor(statut, message) {
    super(message);
    this.statut = statut;
  }
}
