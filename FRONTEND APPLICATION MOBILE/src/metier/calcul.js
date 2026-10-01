// Règles métier partagées par les écrans : périodes, montants dus, numéros de reçu, recherche.

const deux = (n) => String(n).padStart(2, '0');

export const jourIso = (d = new Date()) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;

// Période couverte par un paiement selon la fréquence de la tâche
export function periodeCourante(frequence, d = new Date()) {
  if (frequence === 'JOURNALIERE') return jourIso(d);
  if (frequence === 'MENSUELLE') return `${d.getFullYear()}-${deux(d.getMonth() + 1)}`;
  if (frequence === 'ANNUELLE') return String(d.getFullYear());
  return 'UNIQUE';
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function libellePeriode(frequence, periode) {
  if (periode === 'UNIQUE') return 'paiement unique';
  if (frequence === 'JOURNALIERE') { const [a, m, j] = periode.split('-'); return `le ${j}/${m}/${a}`; }
  if (frequence === 'MENSUELLE') { const [a, m] = periode.split('-'); return `${MOIS[Number(m) - 1]} ${a}`; }
  return `année ${periode}`;
}

export const FREQUENCES = { JOURNALIERE: 'par jour', MENSUELLE: 'par mois', ANNUELLE: 'par an', UNIQUE: 'une fois' };

// Valeur de la base proposée à l'agent, lue dans la fiche du contribuable
export function valeurBase(tache, contribuable, sigle) {
  if (!tache.base_champ || !contribuable) return null;
  if (tache.base_champ.startsWith('c:')) {
    const v = contribuable.complements?.[sigle]?.[tache.base_champ.slice(2)];
    return v === undefined || v === null || v === '' ? null : Number(v);
  }
  const v = contribuable[tache.base_champ];
  return v === undefined || v === null ? null : Number(v);
}

// Montant dû pour une tâche : forfait, tarif × base, ou barème selon la catégorie
export function calculerMontant(tache, { base, categorie } = {}) {
  if (tache.mode_calcul === 'FORFAIT') return Number(tache.montant) || 0;
  if (tache.mode_calcul === 'TARIF_BASE') return Math.round((Number(base) || 0) * (Number(tache.tarif_unitaire) || 0));
  const ligne = (tache.bareme || []).find((b) => b.categorie === categorie);
  return ligne ? Number(ligne.montant) : 0;
}

export function descriptionTarif(tache) {
  if (tache.mode_calcul === 'FORFAIT') return `${gnf(tache.montant)} ${FREQUENCES[tache.frequence]}`;
  if (tache.mode_calcul === 'TARIF_BASE') return `${gnf(tache.tarif_unitaire)} par ${tache.base_libelle}, ${FREQUENCES[tache.frequence]}`;
  return `selon catégorie, ${FREQUENCES[tache.frequence]}`;
}

// Numéro de reçu unique, généré hors ligne : <IDENTIFIANT AGENT>-<AAAAMMJJ>-<compteur du jour>
export const prefixeRecu = (identifiant, d = new Date()) => `${identifiant}-${jourIso(d).replace(/-/g, '')}-`;

export function gnf(n) {
  const v = Math.round(Number(n) || 0);
  return `${v < 0 ? '-' : ''}${String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} GNF`;
}

// Recherche insensible à la casse et aux accents
export const normaliser = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const texteRecherche = (c) => normaliser([
  c.nom, c.prenoms, c.raison_sociale, c.telephone, c.telephone2, c.numero, c.numero_etal, c.numero_porte, c.nom_marche,
].filter(Boolean).join(' '));

export const nomComplet = (c) => [c?.nom, c?.prenoms].filter(Boolean).join(' ') || c?.raison_sociale || '—';

export const dateHeure = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()} ${deux(d.getHours())}:${deux(d.getMinutes())}`;
};
