// Données de départ du référentiel.
// Les services et leurs codes viennent du classeur « Services Concernees Par ligne de Recettes ».
// Les tarifs des tâches sont des EXEMPLES à remplacer par les tarifs officiels de la commune.

export const services = [
  { code: 1,  sigle: 'IMP', nom: 'Service des impôts' },
  { code: 2,  sigle: 'EC',  nom: 'État civil' },
  { code: 3,  sigle: 'ELV', nom: 'Service élevage',
    champs: [
      { cle: 'espece', libelle: 'Espèce principale', type: 'choix', options: ['Bovins', 'Ovins', 'Caprins', 'Volaille', 'Porcins'] },
      { cle: 'nb_tetes', libelle: 'Nombre de têtes', type: 'nombre' },
    ] },
  { code: 4,  sigle: 'OGP', nom: 'OGP (publicité)',
    champs: [
      { cle: 'type_support', libelle: 'Type de support', type: 'choix', options: ['Panneau', 'Enseigne', 'Banderole', 'Écran'] },
      { cle: 'surface_support', libelle: 'Surface du support (m²)', type: 'nombre' },
    ] },
  { code: 5,  sigle: 'HYG', nom: 'Hygiène et salubrité' },
  { code: 6,  sigle: 'QUA', nom: 'Service qualité' },
  { code: 7,  sigle: 'CAD', nom: 'Habitat et cadastre',
    champs: [
      { cle: 'type_bien', libelle: 'Type de bien', type: 'choix', options: ['Terrain nu', 'Bâtiment achevé', 'Bâtiment en construction', 'Agrandissement'] },
      { cle: 'usage', libelle: 'Usage', type: 'choix', options: ['Habitation', 'Commerce', 'Mixte', 'Équipement'] },
      { cle: 'surface_parcelle', libelle: 'Surface de la parcelle (m²)', type: 'nombre' },
      { cle: 'surface_batie', libelle: 'Surface bâtie (m²)', type: 'nombre' },
      { cle: 'nb_niveaux', libelle: 'Nombre de niveaux', type: 'nombre' },
      { cle: 'titre', libelle: 'Titre d\'occupation', type: 'choix', options: ['Titre foncier', 'Permis d\'occuper', 'Lettre d\'attribution', 'Aucun'] },
      { cle: 'numero_permis', libelle: 'N° permis de construire', type: 'texte' },
    ] },
  { code: 8,  sigle: 'JEU', nom: 'Service jeunesse' },
  { code: 9,  sigle: 'PEC', nom: 'Service pêche',
    champs: [
      { cle: 'nb_pirogues', libelle: 'Nombre de pirogues', type: 'nombre' },
    ] },
  { code: 10, sigle: 'TRA', nom: 'Service transport',
    champs: [
      { cle: 'type_engin', libelle: 'Type d\'engin', type: 'choix', options: ['Taxi-moto', 'Tricycle', 'Charrette', 'Taxi', 'Minibus', 'Camion', 'Embarcation à moteur'] },
      { cle: 'nb_engins', libelle: 'Nombre d\'engins', type: 'nombre' },
      { cle: 'immatriculation', libelle: 'Immatriculation(s)', type: 'texte' },
    ] },
  { code: 11, sigle: 'PF',  nom: 'Pool financier',
    champs: [
      { cle: 'type_emplacement', libelle: 'Type d\'emplacement', type: 'choix', options: ['Étal / table', 'Kiosque', 'Stand', 'Boutique', 'Ambulant'] },
      { cle: 'produits', libelle: 'Produits vendus', type: 'texte' },
    ] },
  { code: 12, sigle: 'TOU', nom: 'Hôtellerie et tourisme' },
  { code: 13, sigle: 'MIN', nom: 'Mines et géologie' },
  { code: 14, sigle: 'ENV', nom: 'Service environnement' },
  { code: 15, sigle: 'LIC', nom: 'Ligue islamique communale' },
  { code: 16, sigle: 'DRH', nom: 'Ressources humaines' },
  { code: 17, sigle: 'GC',  nom: 'Garde communale' },
];

// Liste de démonstration : à vérifier et compléter depuis l'écran « Référentiel » de la Mairie.
export const quartiers = [
  { nom: 'Lambanyi',    latitude: 9.6440, longitude: -13.6120 },
  { nom: 'Kobaya',      latitude: 9.6510, longitude: -13.6330 },
  { nom: 'Simambossia', latitude: 9.6380, longitude: -13.5990 },
  { nom: 'Sonfonia',    latitude: 9.6610, longitude: -13.5930 },
  { nom: 'Koloma 1',    latitude: 9.6300, longitude: -13.6200 },
  { nom: 'Koloma 2',    latitude: 9.6340, longitude: -13.6070 },
];

// Tâches de départ (services pilotes suggérés : Pool financier et Cadastre, puis Transport et Élevage)
export const taches = [
  { sigle: 'PF', ligne: '7300', libelle: 'Droits de place de marché', mode_calcul: 'TARIF_BASE',
    tarif_unitaire: 2000, base_libelle: 'étal', base_champ: 'nb_etals', frequence: 'JOURNALIERE' },
  { sigle: 'PF', ligne: '7301', libelle: 'Location de kiosques et stands', mode_calcul: 'BAREME', frequence: 'MENSUELLE',
    bareme: [{ categorie: 'Kiosque', montant: 150000 }, { categorie: 'Stand', montant: 100000 }, { categorie: 'Boutique', montant: 250000 }] },
  { sigle: 'PF', ligne: '7503', libelle: 'Parking et aires de stationnement', mode_calcul: 'FORFAIT', montant: 5000, frequence: 'JOURNALIERE' },
  { sigle: 'PF', ligne: '74001', libelle: 'Revenu des latrines publiques', mode_calcul: 'FORFAIT', montant: 50000, frequence: 'MENSUELLE' },

  { sigle: 'CAD', ligne: '72061', libelle: 'Taxe sur les nouvelles constructions', mode_calcul: 'TARIF_BASE',
    tarif_unitaire: 10000, base_libelle: 'm² bâti', base_champ: 'c:surface_batie', frequence: 'UNIQUE' },
  { sigle: 'CAD', ligne: '72062', libelle: 'Taxe sur les agrandissements et agencements', mode_calcul: 'TARIF_BASE',
    tarif_unitaire: 7500, base_libelle: 'm² bâti', base_champ: 'c:surface_batie', frequence: 'UNIQUE' },
  { sigle: 'CAD', ligne: '7322', libelle: 'Redevance sur permis de construire', mode_calcul: 'BAREME', frequence: 'UNIQUE',
    bareme: [{ categorie: 'Habitation', montant: 500000 }, { categorie: 'Commerce', montant: 1000000 }, { categorie: 'Mixte', montant: 750000 }] },
  { sigle: 'CAD', ligne: '7313', libelle: 'Occupation privative du domaine public', mode_calcul: 'TARIF_BASE',
    tarif_unitaire: 5000, base_libelle: 'm²', base_champ: 'surface_m2', frequence: 'MENSUELLE' },
  { sigle: 'CAD', ligne: '7314', libelle: 'Redevance topographique', mode_calcul: 'FORFAIT', montant: 300000, frequence: 'UNIQUE' },

  { sigle: 'TRA', ligne: '7211', libelle: 'Taxe sur les charrettes et tricycles', mode_calcul: 'TARIF_BASE',
    tarif_unitaire: 50000, base_libelle: 'engin', base_champ: 'c:nb_engins', frequence: 'ANNUELLE' },
  { sigle: 'TRA', ligne: '7303', libelle: 'Stationnement de véhicules à moteur', mode_calcul: 'FORFAIT', montant: 3000, frequence: 'JOURNALIERE' },
  { sigle: 'TRA', ligne: '7502', libelle: 'Gare routière', mode_calcul: 'BAREME', frequence: 'JOURNALIERE',
    bareme: [{ categorie: 'Taxi', montant: 5000 }, { categorie: 'Minibus', montant: 10000 }, { categorie: 'Camion', montant: 20000 }] },

  { sigle: 'ELV', ligne: '7302', libelle: 'Stationnement du bétail', mode_calcul: 'TARIF_BASE',
    tarif_unitaire: 1000, base_libelle: 'tête', base_champ: 'c:nb_tetes', frequence: 'JOURNALIERE' },
  { sigle: 'ELV', ligne: '7201', libelle: 'Taxe d\'abattage', mode_calcul: 'BAREME', frequence: 'UNIQUE',
    bareme: [{ categorie: 'Bovin', montant: 25000 }, { categorie: 'Ovin / caprin', montant: 10000 }] },
];

// Comptes de démonstration (mot de passe commun indiqué dans le README)
export const utilisateurs = [
  { identifiant: 'maire',      nom: 'Maire',      prenoms: 'Commune de Lambanyi', role: 'MAIRIE', fonction: 'Maire' },
  { identifiant: 'vice.maire', nom: 'Vice-Maire', prenoms: 'Finances',            role: 'MAIRIE', fonction: 'Vice-Maire' },
  { identifiant: 'pool.mairie', nom: 'Pool',      prenoms: 'Financier',           role: 'MAIRIE', fonction: 'Pool financier' },

  { identifiant: 'chef.pf',  nom: 'Camara',  prenoms: 'Mamadou',   role: 'CHEF_SERVICE', sigle: 'PF',  fonction: 'Chef du Pool financier' },
  { identifiant: 'chef.cad', nom: 'Diallo',  prenoms: 'Aïssatou',  role: 'CHEF_SERVICE', sigle: 'CAD', fonction: 'Chef du service Cadastre' },
  { identifiant: 'chef.tra', nom: 'Soumah',  prenoms: 'Ibrahima',  role: 'CHEF_SERVICE', sigle: 'TRA', fonction: 'Chef du service Transport' },
  { identifiant: 'chef.elv', nom: 'Bah',     prenoms: 'Oumar',     role: 'CHEF_SERVICE', sigle: 'ELV', fonction: 'Chef du service Élevage' },

  { identifiant: 'PF-001',  nom: 'Sylla',   prenoms: 'Fatoumata', telephone: '620000101', role: 'AGENT', sigle: 'PF' },
  { identifiant: 'PF-002',  nom: 'Condé',   prenoms: 'Sékou',     telephone: '620000102', role: 'AGENT', sigle: 'PF' },
  { identifiant: 'CAD-001', nom: 'Barry',   prenoms: 'Alpha',     telephone: '620000201', role: 'AGENT', sigle: 'CAD' },
  { identifiant: 'TRA-001', nom: 'Keïta',   prenoms: 'Mariama',   telephone: '620000301', role: 'AGENT', sigle: 'TRA' },
  { identifiant: 'ELV-001', nom: 'Touré',   prenoms: 'Lansana',   telephone: '620000401', role: 'AGENT', sigle: 'ELV' },
];
