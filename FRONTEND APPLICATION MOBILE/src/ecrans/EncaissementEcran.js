// Encaissement d'une taxe : le montant est calculé à partir des paramètres définis par le service
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Switch, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useSession } from '../contexte/Session';
import { useSynchro } from '../contexte/Synchro';
import { creerPaiement, lireContribuable, paiementsDuContribuable } from '../db/depots';
import { Bouton, Carte, Champ, Choix, Ecran, LigneInfo, Message } from '../composants/Ui';
import { calculerMontant, gnf, libellePeriode, nomComplet, periodeCourante, valeurBase } from '../metier/calcul';
import { couleurs, styles } from '../theme';

const MODES = [{ valeur: 'ESPECES', libelle: 'Espèces' }, { valeur: 'MOBILE_MONEY', libelle: 'Mobile money' }];

export default function EncaissementEcran({ navigation, route }) {
  const { contribuableId, tacheId } = route.params;
  const { config, agent } = useSession();
  const { signalerSaisie } = useSynchro();
  const [c, setC] = useState(null);
  const [dejaPaye, setDejaPaye] = useState(false);
  const [tacheChoisie, setTacheChoisie] = useState(tacheId ?? config?.taches?.[0]?.id);
  const [base, setBase] = useState('');
  const [categorie, setCategorie] = useState(null);
  const [mode, setMode] = useState('ESPECES');
  const [sms, setSms] = useState(true);
  const [telephoneSms, setTelephoneSms] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const taches = config?.taches || [];
  const t = taches.find((x) => x.id === tacheChoisie);
  const periode = t ? periodeCourante(t.frequence) : null;

  useEffect(() => {
    lireContribuable(contribuableId).then((fiche) => {
      setC(fiche);
      setTelephoneSms(fiche?.telephone || '');
    });
  }, [contribuableId]);

  useEffect(() => {
    if (!t || !c) return;
    const b = valeurBase(t, c, config?.service?.sigle);
    setBase(b === null ? '' : String(b));
    setCategorie(null);
    paiementsDuContribuable(contribuableId).then((ps) => {
      setDejaPaye(ps.some((p) => p.statut === 'VALIDE' && p.tache_id === t.id && p.periode === periode));
    });
  }, [t, c, contribuableId, periode, config]);

  if (!c) return <Ecran><Text style={styles.texteDoux}>Chargement…</Text></Ecran>;

  const baseNum = Number(String(base).replace(',', '.')) || 0;
  const montant = t ? calculerMontant(t, { base: baseNum, categorie }) : 0;
  const pret = t && montant > 0 && (!sms || /^\+?\d{8,15}$/.test(telephoneSms.replace(/\s/g, '')));

  async function valider() {
    const confirme = await new Promise((resoudre) => Alert.alert(
      'Confirmer l\'encaissement',
      `${gnf(montant)} reçus de ${nomComplet(c)} pour « ${t.libelle} » (${libellePeriode(t.frequence, periode)}) ?`,
      [{ text: 'Annuler', style: 'cancel', onPress: () => resoudre(false) }, { text: 'Confirmer', onPress: () => resoudre(true) }],
    ));
    if (!confirme) return;

    setEnvoi(true);
    try {
      // Position de l'encaissement si disponible rapidement (sans bloquer l'agent)
      let position = null;
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.granted) position = await Location.getLastKnownPositionAsync();
      } catch { /* facultatif */ }

      const p = await creerPaiement({
        contribuable_id: c.id,
        tache_id: t.id,
        montant,
        base_valeur: t.mode_calcul === 'TARIF_BASE' ? baseNum : null,
        categorie: t.mode_calcul === 'BAREME' ? categorie : null,
        periode,
        mode_paiement: mode,
        telephone_sms: sms ? telephoneSms.replace(/\s/g, '') : null,
        latitude: position?.coords.latitude ?? null,
        longitude: position?.coords.longitude ?? null,
      }, agent);
      signalerSaisie();
      navigation.replace('Recu', { id: p.id, nouveau: true });
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Ecran>
        <Carte style={{ gap: 4 }}>
          <Text style={styles.texteDoux}>Contribuable</Text>
          <Text style={styles.titre}>{nomComplet(c)}</Text>
          <Text style={styles.texteDoux}>{[c.numero || 'n° en attente', c.telephone, c.quartier].filter(Boolean).join(' · ')}</Text>
        </Carte>

        <Carte style={{ gap: 12 }}>
          <Choix libelle="Taxe ou redevance" options={taches.map((x) => ({ valeur: x.id, libelle: x.libelle }))} valeur={tacheChoisie} onChange={(v) => v && setTacheChoisie(v)} />
          {t && (
            <>
              <LigneInfo cle="Code budgétaire" valeur={t.ligne_code} />
              <LigneInfo cle="Période" valeur={libellePeriode(t.frequence, periode)} />
              {dejaPaye && <Message type="alerte" texte="Déjà payé pour cette période. Un nouvel encaissement créera un second paiement." />}
              {t.mode_calcul === 'FORFAIT' && <LigneInfo cle="Montant forfaitaire" valeur={gnf(t.montant)} />}
              {t.mode_calcul === 'TARIF_BASE' && (
                <Champ libelle={`Nombre de ${t.base_libelle} (tarif : ${gnf(t.tarif_unitaire)} par ${t.base_libelle})`}
                  keyboardType="decimal-pad" value={base} onChangeText={setBase}
                  aide={t.base_champ ? 'Pré-rempli depuis la fiche du contribuable' : undefined} />
              )}
              {t.mode_calcul === 'BAREME' && (
                <Choix libelle="Catégorie" obligatoire valeur={categorie} onChange={setCategorie}
                  options={(t.bareme || []).map((b) => ({ valeur: b.categorie, libelle: `${b.categorie} — ${gnf(b.montant)}` }))} />
              )}
            </>
          )}
        </Carte>

        <Carte style={{ alignItems: 'center', gap: 4, backgroundColor: couleurs.primaireClair, borderColor: couleurs.primaireClair }}>
          <Text style={styles.texteDoux}>Montant à encaisser</Text>
          <Text style={styles.montant}>{gnf(montant)}</Text>
        </Carte>

        <Carte style={{ gap: 12 }}>
          <Choix libelle="Mode de paiement" options={MODES} valeur={mode} onChange={(v) => v && setMode(v)} />
          <View style={[styles.ligne, { justifyContent: 'space-between' }]}>
            <Text style={styles.texte}>Envoyer le reçu par SMS</Text>
            <Switch value={sms} onValueChange={setSms} trackColor={{ true: couleurs.primaire }} />
          </View>
          {sms && <Champ libelle="Téléphone du contribuable" keyboardType="phone-pad" value={telephoneSms} onChangeText={setTelephoneSms} />}
        </Carte>

        <Bouton titre={`Encaisser ${gnf(montant)}`} icone="cash-outline" onPress={valider} desactive={!pret} chargement={envoi} />
        <Text style={[styles.texteDoux, { textAlign: 'center' }]}>Le reçu est créé immédiatement, même sans réseau.</Text>
      </Ecran>
    </KeyboardAvoidingView>
  );
}
