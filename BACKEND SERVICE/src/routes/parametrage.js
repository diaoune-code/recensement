import { Router } from 'express';
import { query, journaliser } from '../db.js';
import { asynchrone, ErreurMetier } from '../outils.js';

const router = Router();

const MODES = ['FORFAIT', 'TARIF_BASE', 'BAREME'];
const FREQUENCES = ['JOURNALIERE', 'MENSUELLE', 'ANNUELLE', 'UNIQUE'];
const BASES_FICHE = ['surface_m2', 'nb_etals', 'nb_personnes'];

// Contrôle la cohérence d'une tâche selon sa règle de calcul ; renvoie les valeurs à enregistrer.
function validerTache(b, champsService) {
  if (!b.libelle?.trim()) throw new ErreurMetier(400, 'Le libellé est obligatoire');
  if (!MODES.includes(b.mode_calcul)) throw new ErreurMetier(400, 'Règle de calcul invalide');
  if (!FREQUENCES.includes(b.frequence)) throw new ErreurMetier(400, 'Fréquence invalide');
  const t = {
    libelle: b.libelle.trim(), ligne_code: b.ligne_code || null, mode_calcul: b.mode_calcul, frequence: b.frequence,
    montant: null, tarif_unitaire: null, base_libelle: null, base_champ: null, bareme: [],
  };
  if (b.mode_calcul === 'FORFAIT') {
    if (!(Number(b.montant) > 0)) throw new ErreurMetier(400, 'Le montant forfaitaire doit être positif');
    t.montant = Number(b.montant);
  } else if (b.mode_calcul === 'TARIF_BASE') {
    if (!(Number(b.tarif_unitaire) > 0)) throw new ErreurMetier(400, 'Le tarif unitaire doit être positif');
    if (!b.base_libelle?.trim()) throw new ErreurMetier(400, 'Précisez l\'unité de la base (m², étal, engin…)');
    t.tarif_unitaire = Number(b.tarif_unitaire);
    t.base_libelle = b.base_libelle.trim();
    if (b.base_champ) {
      const champsNombre = champsService.filter((c) => c.type === 'nombre').map((c) => `c:${c.cle}`);
      if (![...BASES_FICHE, ...champsNombre].includes(b.base_champ)) throw new ErreurMetier(400, 'Donnée de base inconnue');
      t.base_champ = b.base_champ;
    }
  } else {
    const bareme = (b.bareme || []).filter((l) => l.categorie?.trim());
    if (!bareme.length) throw new ErreurMetier(400, 'Le barème doit contenir au moins une catégorie');
    if (bareme.some((l) => !(Number(l.montant) > 0))) throw new ErreurMetier(400, 'Chaque catégorie du barème doit avoir un montant positif');
    t.bareme = bareme.map((l) => ({ categorie: l.categorie.trim(), montant: Number(l.montant) }));
  }
  return t;
}

async function champsDuService(serviceId) {
  const { rows: [s] } = await query('SELECT champs FROM services WHERE id = $1', [serviceId]);
  return s?.champs || [];
}

// ---------------------------------------------------------------------------
// Tâches : chaque taxe ou redevance perçue par le service. Ces paramètres descendent vers le mobile.
// ---------------------------------------------------------------------------
router.get('/taches', asynchrone(async (req, res) => {
  const { rows } = await query(
    `SELECT t.*, l.libelle AS ligne_libelle, l.prevision_2025,
            coalesce(p.montant,0) AS montant_collecte, coalesce(p.nb,0)::int AS nb_paiements
     FROM taches t LEFT JOIN lignes_recettes l ON l.code = t.ligne_code
     LEFT JOIN (SELECT tache_id, sum(montant) AS montant, count(*) AS nb FROM paiements
                WHERE statut='VALIDE' AND date_paiement >= date_trunc('year', now()) GROUP BY 1) p ON p.tache_id = t.id
     WHERE t.service_id = $1 ORDER BY t.actif DESC, t.libelle`, [req.chef.service_id]);
  res.json(rows);
}));

router.post('/taches', asynchrone(async (req, res) => {
  const t = validerTache(req.body || {}, await champsDuService(req.chef.service_id));
  const { rows: [cree] } = await query(
    `INSERT INTO taches (service_id, ligne_code, libelle, mode_calcul, montant, tarif_unitaire, base_libelle, base_champ, bareme, frequence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.chef.service_id, t.ligne_code, t.libelle, t.mode_calcul, t.montant, t.tarif_unitaire, t.base_libelle, t.base_champ,
      JSON.stringify(t.bareme), t.frequence]);
  await journaliser({ query }, { utilisateurId: req.chef.id, serviceId: req.chef.service_id, action: 'CREATION_TACHE', entite: 'tache', entiteId: String(cree.id), details: t });
  res.status(201).json(cree);
}));

router.put('/taches/:id', asynchrone(async (req, res) => {
  const t = validerTache(req.body || {}, await champsDuService(req.chef.service_id));
  const { rows: [maj] } = await query(
    `UPDATE taches SET ligne_code=$1, libelle=$2, mode_calcul=$3, montant=$4, tarif_unitaire=$5, base_libelle=$6, base_champ=$7,
            bareme=$8, frequence=$9, actif = coalesce($10, actif), updated_at = now()
     WHERE id = $11 AND service_id = $12 RETURNING *`,
    [t.ligne_code, t.libelle, t.mode_calcul, t.montant, t.tarif_unitaire, t.base_libelle, t.base_champ, JSON.stringify(t.bareme),
      t.frequence, req.body.actif ?? null, req.params.id, req.chef.service_id]);
  if (!maj) return res.status(404).json({ message: 'Tâche introuvable dans ce service' });
  await journaliser({ query }, { utilisateurId: req.chef.id, serviceId: req.chef.service_id, action: 'MODIFICATION_TACHE', entite: 'tache', entiteId: String(maj.id), details: t });
  res.json(maj);
}));

router.patch('/taches/:id', asynchrone(async (req, res) => {
  const { rows: [maj] } = await query(
    'UPDATE taches SET actif = $1, updated_at = now() WHERE id = $2 AND service_id = $3 RETURNING *',
    [Boolean(req.body?.actif), req.params.id, req.chef.service_id]);
  if (!maj) return res.status(404).json({ message: 'Tâche introuvable dans ce service' });
  await journaliser({ query }, { utilisateurId: req.chef.id, serviceId: req.chef.service_id, action: maj.actif ? 'ACTIVATION_TACHE' : 'DESACTIVATION_TACHE', entite: 'tache', entiteId: String(maj.id) });
  res.json(maj);
}));

// Lignes de recettes : celles attribuées au service en premier, pour choisir le code budgétaire d'une tâche
router.get('/lignes-recettes', asynchrone(async (req, res) => {
  const { rows } = await query(
    `SELECT code, libelle, niveau, prevision_2025, (service_id = $1) AS du_service
     FROM lignes_recettes WHERE niveau IN ('paragraphe','sous_paragraphe')
     ORDER BY (service_id = $1) DESC NULLS LAST, code`, [req.chef.service_id]);
  res.json(rows);
}));

// ---------------------------------------------------------------------------
// Formulaire mobile : champs propres au service ajoutés à la fiche commune du contribuable
// ---------------------------------------------------------------------------
router.get('/formulaire', asynchrone(async (req, res) => {
  res.json(await champsDuService(req.chef.service_id));
}));

// Questions déjà posées par la fiche commune de recensement : un service ne peut pas les reposer
const DEJA_DANS_LA_FICHE = {
  type_bien: 'Type de bien', type_de_bien: 'Type de bien', usage: 'Usage principal du bien', usage_bien: 'Usage principal du bien',
  usage_principal_du_bien: 'Usage principal du bien', titre: 'Documents fonciers', titre_d_occupation: 'Documents fonciers',
  documents_fonciers: 'Documents fonciers', nb_niveaux: 'Nombre d\'étages', nombre_de_niveaux: 'Nombre d\'étages',
  nb_etages: 'Nombre d\'étages', nombre_d_etages: 'Nombre d\'étages', type_habitat: 'Type d\'habitat', type_d_habitat: 'Type d\'habitat',
  type_emplacement: 'Type de bien', type_d_emplacement: 'Type de bien', lien_repondant_bien: 'Lien entre le répondant et le bien',
  occupation: 'Lien entre le répondant et le bien', quartier: 'Quartier', secteur: 'Secteur', telephone: 'Numéro de téléphone',
  nom: 'Nom', prenoms: 'Prénom(s)', prenom: 'Prénom(s)', activite: 'Activité principale', surface: 'Surface occupée (m²)',
  dernier_paiement: 'Dernier paiement déclaré', consentement: 'Consentement', emprise: 'Occupe une emprise de la localité',
  nif: 'NIF', rccm: 'RCCM', numero_de_telephone: 'Numéro de téléphone', produits: 'Description de l\'activité / produits',
  produits_vendus: 'Description de l\'activité / produits',
};

router.put('/formulaire', asynchrone(async (req, res) => {
  const champs = Array.isArray(req.body) ? req.body : [];
  const cles = new Set();
  const propres = champs.map((c) => {
    const cle = String(c.cle || c.libelle || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (!cle || !c.libelle?.trim()) throw new ErreurMetier(400, 'Chaque champ doit avoir un libellé');
    const cleLibelle = c.libelle.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const doublon = DEJA_DANS_LA_FICHE[cle] || DEJA_DANS_LA_FICHE[cleLibelle];
    if (doublon) throw new ErreurMetier(400, `« ${c.libelle} » est déjà demandé dans la fiche commune (« ${doublon} ») : inutile de l'ajouter`);
    if (cles.has(cle)) throw new ErreurMetier(400, `Champ en double : ${c.libelle}`);
    cles.add(cle);
    if (!['texte', 'nombre', 'choix'].includes(c.type)) throw new ErreurMetier(400, `Type invalide pour ${c.libelle}`);
    const options = c.type === 'choix' ? (c.options || []).map((o) => String(o).trim()).filter(Boolean) : undefined;
    if (c.type === 'choix' && !options.length) throw new ErreurMetier(400, `Ajoutez des options au champ ${c.libelle}`);
    return { cle, libelle: c.libelle.trim(), type: c.type, ...(options ? { options } : {}) };
  });
  await query('UPDATE services SET champs = $1, updated_at = now() WHERE id = $2', [JSON.stringify(propres), req.chef.service_id]);
  await journaliser({ query }, { utilisateurId: req.chef.id, serviceId: req.chef.service_id, action: 'MODIFICATION_FORMULAIRE', entite: 'service', entiteId: String(req.chef.service_id), details: { nb_champs: propres.length } });
  res.json(propres);
}));

export default router;
