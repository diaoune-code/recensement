// Fiche de recensement : UNIQUEMENT les champs de la « Fiche de collecte indiquée par le service de collecte »,
// dans son ordre et ses rubriques. L'enregistrement est toujours local d'abord (fonctionne sans réseau).
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useSession } from '../contexte/Session';
import { useSynchro } from '../contexte/Synchro';
import { doublonsProbables, enregistrerContribuable, lireContribuable } from '../db/depots';
import { Bouton, Carte, Champ, Ecran, ListeDeroulante, Message, TitreSection } from '../composants/Ui';
import { nomComplet } from '../metier/calcul';
import { couleurs, styles } from '../theme';

// Deux types de contribuable seulement
const TYPES_CONTRIBUABLE = [
  { valeur: 'PERSONNE_PHYSIQUE', libelle: 'Personne physique' },
  { valeur: 'PERSONNE_MORALE', libelle: 'Personne morale (entreprise)' },
];
const ACTIVITE_F_NF =[{ valeur: 'FORMEL', libelle: 'Formelle (F)' }, { valeur: 'INFORMEL', libelle: 'Informelle (NF)' }];
const HABITATS = ['Villa', 'Immeuble'];
const ACTIVITES = ['Commerce de détail', 'Commerce de gros', 'Restauration / débit de boissons', 'Artisanat', 'Coiffure / esthétique',
  'Réparation / maintenance', 'Transport', 'Services', 'Hébergement', 'Agriculture / élevage', 'Autre'];
const TYPES_BIEN = ['Terrain nu', 'Bâtiment', 'Boutique', 'Magasin', 'Kiosque', 'Étal / emplacement de marché', 'Autre'];
const USAGES_BIEN = ['Habitation', 'Commerce', 'Mixte', 'Bureau / service', 'Autre'];
const DOCUMENTS_FONCIERS = ['Titre foncier', 'Permis d\'occuper', 'Lettre d\'attribution', 'Acte de vente', 'Aucun document'];
const LIENS_BIEN = ['Propriétaire', 'Locataire', 'Gérant / exploitant', 'Membre de la famille', 'Mandataire', 'Occupant sans titre', 'Autre'];
const PIECES = ['CNI', 'Carte d\'électeur', 'Passeport', 'Carte consulaire', 'Récépissé', 'Aucune'];
const OUI_NON = [{ valeur: 'OUI', libelle: 'Oui' }, { valeur: 'NON', libelle: 'Non' }];
const CONTROLES = [{ valeur: 'PIECE_VERIFIEE', libelle: 'Pièce vérifiée' }, { valeur: 'DECLARATIF', libelle: 'Déclaratif, non vérifié' }];

const nombreOuNull = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(String(v).replace(',', '.'))) ? null : Number(String(v).replace(',', '.')));

export default function FormulaireContribuableEcran({ navigation, route }) {
  const { id, prefill } = route.params || {};
  const { config } = useSession();
  const { signalerSaisie } = useSynchro();
  const sigle = config?.service?.sigle;

  const [f, setF] = useState({ type_contribuable: 'PERSONNE_PHYSIQUE', ...prefill });
  const [taxes, setTaxes] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const position = useRef(null);

  useEffect(() => {
    navigation.setOptions({ title: id ? 'Compléter la fiche' : 'Nouveau recensement' });
    if (id) {
      lireContribuable(id).then((c) => {
        if (!c) return;
        setF(c);
        setTaxes(c.complements?.[sigle]?.taxes_applicables || []);
      });
    }
  }, [id, sigle, navigation]);

  // Position relevée automatiquement en arrière-plan (ce n'est pas un champ de la fiche) : sert à la carte de la Mairie
  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (actif) position.current = pos.coords;
      } catch { /* sans GPS, la fiche s'enregistre quand même */ }
    })();
    return () => { actif = false; };
  }, []);

  const maj = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  async function enregistrer() {
    setErreur(null);
    const estEntreprise = f.type_contribuable && f.type_contribuable !== 'PERSONNE_PHYSIQUE';
    if (!f.nom?.trim()) { setErreur(estEntreprise ? 'Le nom de l\'entreprise est obligatoire.' : 'Le nom est obligatoire.'); return; }
    if (!f.quartier) { setErreur('Le quartier est obligatoire.'); return; }
    if (f.telephone && !/^\+?\d{8,15}$/.test(f.telephone.replace(/\s/g, ''))) { setErreur('Numéro de téléphone invalide.'); return; }
    if (!f.consentement) { setErreur('Indiquez le consentement du contribuable (rubrique Pièces, consentement et contrôle qualité).'); return; }

    setEnregistrement(true);
    try {
      // Contrôle anti-doublon sur le téléphone : même téléphone, ou même nom et prénom dans le même quartier
      if (!id) {
        const memes = await doublonsProbables({
          telephone: f.telephone?.replace(/\s/g, '') || null, nom: f.nom.trim(), prenoms: estEntreprise ? null : f.prenoms, quartier: f.quartier,
        });
        if (memes.length) {
          const continuer = await new Promise((resoudre) => Alert.alert(
            'Personne peut-être déjà recensée',
            `${nomComplet(memes[0])} (${memes[0].numero || 'n° en attente'}, ${memes[0].quartier || 'quartier inconnu'}) : ${memes[0].motif}.`
              + `${memes.length > 1 ? ` (${memes.length} fiches proches)` : ''}\n\nEnregistrer quand même une nouvelle fiche ?`,
            [{ text: 'Ouvrir la fiche existante', onPress: () => resoudre(false) }, { text: 'Créer quand même', style: 'destructive', onPress: () => resoudre(true) }],
          ));
          if (!continuer) { navigation.replace('Fiche', { id: memes[0].id }); return; }
        }
      }

      const gps = position.current;
      const saisie = {
        ...f,
        type_contribuable: estEntreprise ? 'PERSONNE_MORALE' : 'PERSONNE_PHYSIQUE',
        nom: f.nom.trim().toUpperCase(),
        // Personne morale : le nom saisi est la raison sociale, sans prénom
        prenoms: estEntreprise ? null : f.prenoms,
        raison_sociale: estEntreprise ? f.nom.trim().toUpperCase() : null,
        telephone: f.telephone?.replace(/\s/g, '') || null,
        nb_etages: f.type_habitat === 'Immeuble' ? nombreOuNull(f.nb_etages) : null,
        dernier_paiement_montant: nombreOuNull(f.dernier_paiement_montant),
        piece_numero: f.piece_type && f.piece_type !== 'Aucune' ? f.piece_numero : null,
        ...(gps && !f.latitude ? {
          latitude: Number(gps.latitude.toFixed(6)), longitude: Number(gps.longitude.toFixed(6)),
          precision_gps: gps.accuracy ? Math.round(gps.accuracy) : null,
        } : {}),
        // Liste des taxes et redevances : propre au service de l'agent
        complements: { ...(f.complements || {}), ...(sigle ? { [sigle]: { ...(f.complements?.[sigle] || {}), taxes_applicables: taxes } } : {}) },
      };
      const nouvelId = await enregistrerContribuable(saisie, { serviceId: config?.service?.id, photoModifiee: false });
      signalerSaisie();
      if (id) navigation.goBack();
      else navigation.replace('Fiche', { id: nouvelId, nouveau: true });
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrement(false);
    }
  }

  // Anciennes fiches (association, établissement…) : traitées comme des personnes morales
  const entreprise = f.type_contribuable && f.type_contribuable !== 'PERSONNE_PHYSIQUE';
  const quartiers = (config?.quartiers || []).map((q) => q.nom);
  const valeurTexte = (v) => (v === null || v === undefined ? '' : String(v));
  const taxesService = (config?.taches || []).map((t) => ({ valeur: t.id, libelle: t.libelle }));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Ecran>
        <TitreSection>Identification et localisation</TitreSection>
        <Carte style={{ gap: 12 }}>
          <ListeDeroulante libelle="Type de contribuable" obligatoire options={TYPES_CONTRIBUABLE} valeur={entreprise ? 'PERSONNE_MORALE' : 'PERSONNE_PHYSIQUE'}
            onChange={(v) => setF((x) => ({ ...x, type_contribuable: v }))} />
          {entreprise ? (
            <Champ libelle="Nom de l'entreprise (raison sociale)" obligatoire autoCapitalize="characters" value={valeurTexte(f.nom)} onChangeText={maj('nom')} />
          ) : (
            <>
              <Champ libelle="Nom" obligatoire autoCapitalize="characters" value={valeurTexte(f.nom)} onChangeText={maj('nom')} />
              <Champ libelle="Prénom" value={valeurTexte(f.prenoms)} onChangeText={maj('prenoms')} />
            </>
          )}
          <View style={{ gap: 6 }}>
            <ListeDeroulante libelle="Quartier / Marché" obligatoire options={quartiers} valeur={f.quartier} onChange={maj('quartier')} placeholder="Choisir le quartier…" />
            <Champ libelle="" placeholder="Marché (si applicable)" value={valeurTexte(f.nom_marche)} onChangeText={maj('nom_marche')} />
          </View>
          <Champ libelle="Secteur" value={valeurTexte(f.secteur)} onChangeText={maj('secteur')} />
          <Champ libelle="Rue / Emprise" value={valeurTexte(f.rue)} onChangeText={maj('rue')}
            aide="Emprise : surface appartenant à la localité, occupée temporairement par un contribuable." />
          <Champ libelle="N° de concession / Boutique / Magasin / Kiosque" value={valeurTexte(f.numero_porte)} onChangeText={maj('numero_porte')} />
          <ListeDeroulante libelle="Type d'habitat" options={HABITATS} valeur={f.type_habitat} onChange={maj('type_habitat')} />
          {f.type_habitat === 'Immeuble' && (
            <Champ libelle="Nombre d'étages" keyboardType="number-pad" value={valeurTexte(f.nb_etages)} onChangeText={maj('nb_etages')} />
          )}
          <ListeDeroulante libelle="Activité : formelle ou informelle (F / NF)" options={ACTIVITE_F_NF} valeur={f.statut_fiscal} onChange={maj('statut_fiscal')} />
          <Champ libelle="Numéro de téléphone" keyboardType="phone-pad" value={valeurTexte(f.telephone)} onChangeText={maj('telephone')} />
          <ListeDeroulante libelle="Activité" options={ACTIVITES} valeur={f.activite_principale} onChange={maj('activite_principale')} />
          {taxesService.length > 0 ? (
            <ListeDeroulante multiple libelle="Liste des taxes et redevances" options={taxesService} valeur={taxes} onChange={setTaxes}
              placeholder="Choisir une ou plusieurs taxes…" aide="Plusieurs choix possibles." />
          ) : (
            <Text style={styles.texteDoux}>Liste des taxes et redevances : aucune taxe n'est encore paramétrée pour votre service.</Text>
          )}
        </Carte>

        <TitreSection>Bien et documents</TitreSection>
        <Carte style={{ gap: 12 }}>
          <ListeDeroulante libelle="Type de bien" options={TYPES_BIEN} valeur={f.type_bien} onChange={maj('type_bien')} />
          <ListeDeroulante libelle="Usage principal du bien" options={USAGES_BIEN} valeur={f.usage_bien} onChange={maj('usage_bien')} />
          <ListeDeroulante libelle="Documents fonciers" options={DOCUMENTS_FONCIERS} valeur={f.documents_fonciers} onChange={maj('documents_fonciers')} />
          <ListeDeroulante libelle="Lien entre le répondant et le bien" options={LIENS_BIEN} valeur={f.lien_repondant_bien} onChange={maj('lien_repondant_bien')} />
        </Carte>

        <TitreSection>Paiements et suivi</TitreSection>
        <Carte style={{ gap: 6 }}>
          <Champ libelle="Dernier paiement déclaré" placeholder="Date ou période, ex. 03/2026" value={valeurTexte(f.dernier_paiement_date)} onChangeText={maj('dernier_paiement_date')} />
          <Champ libelle="" placeholder="Montant (GNF)" keyboardType="number-pad" value={valeurTexte(f.dernier_paiement_montant)} onChangeText={maj('dernier_paiement_montant')} />
        </Carte>

        <TitreSection>Pièces, consentement et contrôle qualité</TitreSection>
        <Carte style={{ gap: 12 }}>
          <ListeDeroulante libelle="Pièce" options={PIECES} valeur={f.piece_type} onChange={maj('piece_type')} />
          {f.piece_type && f.piece_type !== 'Aucune' && (
            <Champ libelle="" placeholder="N° de la pièce" value={valeurTexte(f.piece_numero)} onChangeText={maj('piece_numero')} />
          )}
          <ListeDeroulante libelle="Consentement" obligatoire options={OUI_NON} valeur={f.consentement} onChange={maj('consentement')} />
          <ListeDeroulante libelle="Contrôle qualité" options={CONTROLES} valeur={f.controle_qualite} onChange={maj('controle_qualite')} />
        </Carte>

        <Message texte={erreur} type="erreur" />
        <Bouton titre="Enregistrer la fiche" icone="save-outline" onPress={enregistrer} chargement={enregistrement} />
        <Text style={[styles.texteDoux, { textAlign: 'center', color: couleurs.texteDoux }]}>
          La fiche est enregistrée sur le téléphone puis envoyée automatiquement à la base de la commune.
        </Text>
      </Ecran>
    </KeyboardAvoidingView>
  );
}
