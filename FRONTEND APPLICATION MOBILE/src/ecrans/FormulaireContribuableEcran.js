// Fiche de recensement : sections de la fiche officielle + champs propres au service de l'agent.
// L'enregistrement est toujours local d'abord (fonctionne sans réseau).
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useSession } from '../contexte/Session';
import { useSynchro } from '../contexte/Synchro';
import { doublonsProbables, enregistrerContribuable, lireContribuable } from '../db/depots';
import { Bouton, Carte, Champ, Ecran, ListeDeroulante, Message, TitreSection } from '../composants/Ui';
import { nomComplet } from '../metier/calcul';
import { couleurs, styles } from '../theme';

const TYPES = [
  { valeur: 'PERSONNE_PHYSIQUE', libelle: 'Personne physique' },
  { valeur: 'PERSONNE_MORALE', libelle: 'Entreprise' },
  { valeur: 'ASSOCIATION', libelle: 'Association / coopérative' },
  { valeur: 'ETABLISSEMENT', libelle: 'Établissement' },
];
const PIECES = ['CNI', 'Carte d\'électeur', 'Passeport', 'Carte consulaire', 'Récépissé', 'Aucune'];
const STATUTS = [{ valeur: 'FORMEL', libelle: 'Formelle (F)' }, { valeur: 'INFORMEL', libelle: 'Informelle (NF)' }, { valeur: 'NON_VERIFIE', libelle: 'Non vérifié' }];
// Rubriques de la « Fiche de collecte indiquée par le service de collecte »
const OUI_NON = [{ valeur: 'OUI', libelle: 'Oui' }, { valeur: 'NON', libelle: 'Non' }];
const HABITATS = ['Villa', 'Immeuble', 'Maison simple', 'Autre'];
// Une seule question par information : « Type de bien » remplace aussi l'ancienne « Forme du point d'activité »
// et « Type de site » ; « Lien avec le bien » remplace aussi l'ancienne « Occupation du local ».
const TYPES_BIEN = ['Terrain nu', 'Bâtiment (habitation)', 'Boutique / magasin', 'Kiosque', 'Étal / table de marché', 'Hangar / atelier',
  'Dépôt / entrepôt', 'Activité à domicile', 'Activité ambulante (sans local)', 'Autre'];
const USAGES_BIEN = ['Habitation', 'Commerce', 'Mixte', 'Bureau / service', 'Autre'];
const DOCUMENTS_FONCIERS = ['Titre foncier', 'Permis d\'occuper', 'Lettre d\'attribution', 'Acte de vente', 'Aucun document'];
const LIENS_BIEN = ['Propriétaire', 'Locataire', 'Gérant / exploitant', 'Membre de la famille', 'Mandataire', 'Occupant sans titre', 'Autre'];
const CONTROLES = [{ valeur: 'PIECE_VERIFIEE', libelle: 'Pièce vérifiée' }, { valeur: 'DECLARATIF', libelle: 'Déclaratif, non vérifié' }];
const ACTIVITES = ['Commerce de détail', 'Commerce de gros', 'Restauration / débit de boissons', 'Artisanat', 'Coiffure / esthétique',
  'Réparation / maintenance', 'Transport', 'Services', 'Hébergement', 'Agriculture / élevage', 'Autre'];

// Champs propres à un service qui reposeraient une question de la fiche commune : jamais affichés en double
const CLES_DEJA_DEMANDEES = new Set(['type_bien', 'usage', 'usage_bien', 'titre', 'documents_fonciers', 'nb_niveaux', 'nb_etages',
  'type_emplacement', 'type_habitat', 'lien_repondant_bien', 'occupation', 'quartier', 'secteur', 'telephone', 'nom', 'prenoms',
  'nif', 'rccm', 'produits', 'numero_de_telephone', 'type_de_bien', 'usage_principal_du_bien', 'nombre_d_etages', 'nombre_de_niveaux']);

const nombreOuNull = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(String(v).replace(',', '.'))) ? null : Number(String(v).replace(',', '.')));

export default function FormulaireContribuableEcran({ navigation, route }) {
  const { id, prefill } = route.params || {};
  const { config } = useSession();
  const { signalerSaisie } = useSynchro();
  const sigle = config?.service?.sigle;
  const champsService = (config?.service?.champs || []).filter((ch) => !CLES_DEJA_DEMANDEES.has(ch.cle));

  const [f, setF] = useState({ type_contribuable: 'PERSONNE_PHYSIQUE', ...prefill });
  const [complement, setComplement] = useState({});
  const [photoModifiee, setPhotoModifiee] = useState(false);
  const [gpsEnCours, setGpsEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: id ? 'Compléter la fiche' : 'Nouveau recensement' });
    if (id) {
      lireContribuable(id).then((c) => {
        if (!c) return;
        setF(c);
        setComplement(c.complements?.[sigle] || {});
      });
    }
  }, [id, sigle, navigation]);

  const maj = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  async function capturerGps() {
    setGpsEnCours(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Autorisation de localisation refusée');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setF((x) => ({
        ...x,
        latitude: Number(pos.coords.latitude.toFixed(6)),
        longitude: Number(pos.coords.longitude.toFixed(6)),
        precision_gps: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
      }));
    } catch (e) {
      Alert.alert('GPS', e.message || 'Position indisponible');
    } finally {
      setGpsEnCours(false);
    }
  }

  async function prendrePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Caméra', 'Autorisation de la caméra refusée'); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (r.canceled) return;
    // Photo réduite (800 px, JPEG compressé) : légère à stocker et à envoyer sur un réseau faible
    const rendu = await ImageManipulator.manipulate(r.assets[0].uri).resize({ width: 800, height: null }).renderAsync();
    const image = await rendu.saveAsync({ format: SaveFormat.JPEG, compress: 0.5, base64: true });
    setF((x) => ({ ...x, photo: image.base64 }));
    setPhotoModifiee(true);
  }

  async function enregistrer() {
    setErreur(null);
    if (!f.nom?.trim() && !f.raison_sociale?.trim()) { setErreur('Le nom (ou la raison sociale) est obligatoire.'); return; }
    if (!f.quartier) { setErreur('Le quartier est obligatoire.'); return; }
    if (f.telephone && !/^\+?\d{8,15}$/.test(f.telephone.replace(/\s/g, ''))) { setErreur('Numéro de téléphone invalide.'); return; }
    if (!f.consentement) { setErreur('Indiquez si le contribuable consent à l\'enregistrement de ses informations (rubrique Pièces, consentement et contrôle qualité).'); return; }

    setEnregistrement(true);
    try {
      // Contrôle anti-doublon sur le téléphone : même téléphone, ou même nom et prénoms dans le même quartier
      if (!id) {
        const memes = await doublonsProbables({
          telephone: f.telephone?.replace(/\s/g, '') || null,
          nom: (f.nom || f.raison_sociale || '').trim(),
          prenoms: f.prenoms,
          quartier: f.quartier,
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

      const complementsTypes = {};
      for (const ch of champsService) {
        const v = complement[ch.cle];
        if (v !== undefined && v !== null && v !== '') complementsTypes[ch.cle] = ch.type === 'nombre' ? nombreOuNull(v) : v;
      }
      // Taxes et redevances concernées : propres au service de l'agent
      if (complement.taxes_applicables?.length) complementsTypes.taxes_applicables = complement.taxes_applicables;
      const saisie = {
        ...f,
        nom: (f.nom || f.raison_sociale || '').trim().toUpperCase(),
        telephone: f.telephone?.replace(/\s/g, '') || null,
        surface_m2: nombreOuNull(f.surface_m2),
        nb_etals: nombreOuNull(f.nb_etals),
        nb_personnes: nombreOuNull(f.nb_personnes),
        nb_etages: f.type_habitat === 'Immeuble' ? nombreOuNull(f.nb_etages) : null,
        dernier_paiement_montant: nombreOuNull(f.dernier_paiement_montant),
        complements: { ...(f.complements || {}), ...(sigle ? { [sigle]: complementsTypes } : {}) },
      };
      const nouvelId = await enregistrerContribuable(saisie, { serviceId: config?.service?.id, photoModifiee });
      signalerSaisie();
      if (id) navigation.goBack();
      else navigation.replace('Fiche', { id: nouvelId, nouveau: true });
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrement(false);
    }
  }

  const quartiers = (config?.quartiers || []).map((q) => q.nom);
  const valeurTexte = (v) => (v === null || v === undefined ? '' : String(v));
  const taxesService = (config?.taches || []).map((t) => ({ valeur: t.id, libelle: t.libelle }));

  // Rubriques dans l'ordre de la « Fiche de collecte indiquée par le service de collecte »
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Ecran>
        <TitreSection>Identification</TitreSection>
        <Carte style={{ gap: 12 }}>
          <ListeDeroulante libelle="Type de contribuable" obligatoire options={TYPES} valeur={f.type_contribuable} onChange={maj('type_contribuable')} />
          <Champ libelle="Nom" obligatoire autoCapitalize="characters" value={valeurTexte(f.nom)} onChangeText={maj('nom')} />
          <Champ libelle="Prénom(s)" value={valeurTexte(f.prenoms)} onChangeText={maj('prenoms')} />
          {f.type_contribuable !== 'PERSONNE_PHYSIQUE' && (
            <Champ libelle="Raison sociale / nom commercial" value={valeurTexte(f.raison_sociale)} onChangeText={maj('raison_sociale')} />
          )}
          {f.type_contribuable === 'PERSONNE_PHYSIQUE' && <ListeDeroulante libelle="Sexe" options={['Femme', 'Homme']} valeur={f.sexe} onChange={maj('sexe')} />}
          <Champ libelle="Numéro de téléphone" keyboardType="phone-pad" value={valeurTexte(f.telephone)} onChangeText={maj('telephone')} />
          <Champ libelle="Téléphone secondaire" keyboardType="phone-pad" value={valeurTexte(f.telephone2)} onChangeText={maj('telephone2')} />
          <ListeDeroulante libelle="Activité : formelle ou informelle (F / NF)" options={STATUTS} valeur={f.statut_fiscal} onChange={maj('statut_fiscal')} />
          {f.statut_fiscal === 'FORMEL' && (
            <>
              <Champ libelle="NIF" value={valeurTexte(f.nif)} onChangeText={maj('nif')} />
              <Champ libelle="RCCM" value={valeurTexte(f.rccm)} onChangeText={maj('rccm')} />
            </>
          )}
        </Carte>

        <TitreSection>Localisation</TitreSection>
        <Carte style={{ gap: 12 }}>
          <ListeDeroulante libelle="Quartier" obligatoire options={quartiers} valeur={f.quartier} onChange={maj('quartier')} />
          <Champ libelle="Marché (si applicable)" value={valeurTexte(f.nom_marche)} onChangeText={maj('nom_marche')} />
          <Champ libelle="Secteur" value={valeurTexte(f.secteur)} onChangeText={maj('secteur')} />
          <Champ libelle="Rue / emprise" value={valeurTexte(f.rue)} onChangeText={maj('rue')} />
          <ListeDeroulante libelle="Occupe une emprise de la localité ?" options={OUI_NON} valeur={f.sur_emprise} onChange={maj('sur_emprise')}
            aide="Emprise : surface appartenant à la localité, occupée temporairement par un contribuable." />
          <Champ libelle="N° de concession" value={valeurTexte(f.numero_porte)} onChangeText={maj('numero_porte')} />
          <Champ libelle="N° de boutique / magasin / kiosque / étal" value={valeurTexte(f.numero_etal)} onChangeText={maj('numero_etal')} />
          <ListeDeroulante libelle="Type d'habitat" options={HABITATS} valeur={f.type_habitat} onChange={maj('type_habitat')} />
          {f.type_habitat === 'Immeuble' && (
            <Champ libelle="Nombre d'étages" keyboardType="number-pad" value={valeurTexte(f.nb_etages)} onChangeText={maj('nb_etages')} />
          )}
          <Champ libelle="Repères physiques" multiline value={valeurTexte(f.repere)} onChangeText={maj('repere')} />
          <View style={{ gap: 6 }}>
            <Bouton titre={f.latitude ? 'Reprendre la position GPS' : 'Capturer la position GPS'} icone="locate-outline"
              variante="bleu" onPress={capturerGps} chargement={gpsEnCours} />
            {f.latitude ? (
              <Text style={styles.texteDoux}>{f.latitude}, {f.longitude}{f.precision_gps ? ` — précision ${f.precision_gps} m` : ''}</Text>
            ) : <Text style={styles.texteDoux}>Le GPS fonctionne sans réseau.</Text>}
          </View>
        </Carte>

        <TitreSection>Activité économique</TitreSection>
        <Carte style={{ gap: 12 }}>
          <ListeDeroulante libelle="Activité principale" options={ACTIVITES} valeur={f.activite_principale} onChange={maj('activite_principale')} />
          <Champ libelle="Description de l'activité / produits" multiline value={valeurTexte(f.description_activite)} onChangeText={maj('description_activite')} />
          <Champ libelle="Surface occupée (m²)" keyboardType="decimal-pad" value={valeurTexte(f.surface_m2)} onChangeText={maj('surface_m2')} />
          <Champ libelle="Nombre de tables / étals" keyboardType="number-pad" value={valeurTexte(f.nb_etals)} onChangeText={maj('nb_etals')} />
          <Champ libelle="Personnes travaillant sur le site" keyboardType="number-pad" value={valeurTexte(f.nb_personnes)} onChangeText={maj('nb_personnes')} />
          {taxesService.length > 0 ? (
            <ListeDeroulante multiple libelle={`Taxes et redevances concernées (${config.service.sigle})`} options={taxesService}
              valeur={complement.taxes_applicables || []} onChange={(v) => setComplement((x) => ({ ...x, taxes_applicables: v }))}
              placeholder="Choisir une ou plusieurs taxes…"
              aide="Plusieurs choix possibles. Seules les taxes choisies seront proposées à l'encaissement pour ce contribuable." />
          ) : (
            <Text style={styles.texteDoux}>Aucune taxe n'est encore paramétrée pour votre service : la liste des taxes apparaîtra ici.</Text>
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
        <Carte style={{ gap: 12 }}>
          <Text style={styles.texteDoux}>Dernier paiement déclaré par le contribuable (avant l'application).</Text>
          <Champ libelle="Date ou période du dernier paiement" placeholder="ex. 03/2026" value={valeurTexte(f.dernier_paiement_date)} onChangeText={maj('dernier_paiement_date')} />
          <Champ libelle="Montant du dernier paiement (GNF)" keyboardType="number-pad" value={valeurTexte(f.dernier_paiement_montant)} onChangeText={maj('dernier_paiement_montant')} />
        </Carte>

        {champsService.length > 0 && (
          <>
            <TitreSection>{config.service.nom}</TitreSection>
            <Carte style={{ gap: 12 }}>
              {champsService.map((ch) => (ch.type === 'choix' ? (
                <ListeDeroulante key={ch.cle} libelle={ch.libelle} options={ch.options || []} valeur={complement[ch.cle]}
                  onChange={(v) => setComplement((x) => ({ ...x, [ch.cle]: v }))} />
              ) : (
                <Champ key={ch.cle} libelle={ch.libelle} keyboardType={ch.type === 'nombre' ? 'decimal-pad' : 'default'}
                  value={valeurTexte(complement[ch.cle])} onChangeText={(v) => setComplement((x) => ({ ...x, [ch.cle]: v }))} />
              )))}
            </Carte>
          </>
        )}

        <TitreSection>Pièces, consentement et contrôle qualité</TitreSection>
        <Carte style={{ gap: 12 }}>
          <ListeDeroulante libelle="Pièce présentée" options={PIECES} valeur={f.piece_type} onChange={maj('piece_type')} />
          {f.piece_type && f.piece_type !== 'Aucune' && <Champ libelle="Numéro de la pièce" value={valeurTexte(f.piece_numero)} onChangeText={maj('piece_numero')} />}
          <View style={{ alignItems: 'center', gap: 10 }}>
            {f.photo ? <Image source={{ uri: `data:image/jpeg;base64,${f.photo}` }} style={{ width: 180, height: 180, borderRadius: 8 }} />
              : <Text style={styles.texteDoux}>Photo du contribuable, de son site ou de sa pièce</Text>}
            <Bouton titre={f.photo ? 'Reprendre la photo' : 'Prendre une photo'} icone="camera-outline" variante="secondaire" onPress={prendrePhoto} style={{ alignSelf: 'stretch' }} />
          </View>
          <ListeDeroulante libelle="Le contribuable consent à l'enregistrement de ses informations" obligatoire options={OUI_NON} valeur={f.consentement} onChange={maj('consentement')} />
          <ListeDeroulante libelle="Contrôle qualité" options={CONTROLES} valeur={f.controle_qualite} onChange={maj('controle_qualite')} />
          <Champ libelle="Observations de l'agent" multiline value={valeurTexte(f.observations)} onChangeText={maj('observations')} />
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
