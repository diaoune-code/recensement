// Express 4 ne transmet pas les erreurs des fonctions async : on les relaie au gestionnaire d'erreurs.
export const asynchrone = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Colonnes de la fiche contribuable que le mobile peut saisir ou compléter.
export const CHAMPS_CONTRIBUABLE = [
  'type_contribuable', 'nom', 'prenoms', 'raison_sociale', 'sexe', 'date_naissance', 'nationalite',
  'piece_type', 'piece_numero', 'telephone', 'telephone2', 'email', 'statut_fiscal', 'nif', 'rccm',
  'type_site', 'quartier', 'secteur', 'rue', 'numero_porte', 'nom_marche', 'numero_etal',
  'latitude', 'longitude', 'precision_gps', 'repere',
  'activite_principale', 'description_activite', 'forme_point', 'occupation', 'surface_m2', 'nb_etals', 'nb_personnes',
  // Rubriques de la fiche de collecte du service de collecte
  'sur_emprise', 'type_habitat', 'nb_etages', 'type_bien', 'usage_bien', 'documents_fonciers', 'lien_repondant_bien',
  'dernier_paiement_date', 'dernier_paiement_montant', 'consentement', 'controle_qualite', 'observations',
];

// Chaîne vide -> null, pour ne pas stocker de valeurs vides dans les colonnes typées.
export const nettoyer = (v) => (v === '' || v === undefined ? null : v);
