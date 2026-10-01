const nombre = new Intl.NumberFormat('fr-FR');

export const gnf = (n) => `${nombre.format(Math.round(Number(n) || 0))} GNF`;

// Montant abrégé pour les graphiques et cartes : 1,2 Md / 350 M / 12 k
export function gnfCourt(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Md`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} k`;
  return nombre.format(v);
}

export const entier = (n) => nombre.format(Number(n) || 0);

export const date = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
export const dateHeure = (d) => (d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const jourCourt = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '');

export const pourcentage = (part, total) => (total ? Math.round((part / total) * 100) : 0);

export const FREQUENCES = { JOURNALIERE: 'Journalière', MENSUELLE: 'Mensuelle', ANNUELLE: 'Annuelle', UNIQUE: 'Paiement unique' };
export const MODES_CALCUL = { FORFAIT: 'Forfait', TARIF_BASE: 'Tarif × base', BAREME: 'Barème par catégorie' };
export const MODES_PAIEMENT = { ESPECES: 'Espèces', MOBILE_MONEY: 'Mobile money' };

export const nomComplet = (c) => [c?.nom, c?.prenoms].filter(Boolean).join(' ') || c?.raison_sociale || '—';

export const isoJour = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
