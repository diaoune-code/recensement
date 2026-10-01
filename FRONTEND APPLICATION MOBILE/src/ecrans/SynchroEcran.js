// État de la synchronisation : connexion, file d'attente, dernier échange, éléments refusés
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSynchro } from '../contexte/Synchro';
import { useSession } from '../contexte/Session';
import { lireServeur } from '../api/client';
import { elementsEnErreur, reessayerErreurs } from '../db/depots';
import { Bouton, Carte, Ecran, LigneInfo, Message, TitreSection } from '../composants/Ui';
import { dateHeure } from '../metier/calcul';
import { couleurs, styles } from '../theme';

export default function SynchroEcran() {
  const s = useSynchro();
  const { deconnecter } = useSession();
  const [serveur, setServeur] = useState('');
  const [erreurs, setErreurs] = useState([]);

  useFocusEffect(useCallback(() => {
    lireServeur().then(setServeur);
    elementsEnErreur().then(setErreurs);
    s.rafraichirFile();
  }, [s.file.erreurs])); // eslint-disable-line react-hooks/exhaustive-deps

  const horsLigne = !s.reseau || s.serveurJoignable === false;
  const r = s.dernierRapport;

  return (
    <Ecran>
      <Carte style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Ionicons name={horsLigne ? 'cloud-offline' : 'cloud-done'} size={36} color={horsLigne ? couleurs.alerte : couleurs.succes} />
        <View style={{ flex: 1 }}>
          <Text style={styles.titre}>{horsLigne ? 'Hors ligne' : 'Connecté au serveur'}</Text>
          <Text style={styles.texteDoux}>{serveur}</Text>
        </View>
      </Carte>

      {s.sessionExpiree && (
        <>
          <Message type="erreur" texte="Votre session a expiré. Vos saisies sont conservées : reconnectez-vous avec du réseau pour les envoyer." />
          <Bouton titre="Se reconnecter" variante="danger" icone="log-in-outline" onPress={deconnecter} />
        </>
      )}
      {s.derniereErreur && !s.sessionExpiree && <Message type="alerte" texte={s.derniereErreur} />}

      <TitreSection>En attente d'envoi</TitreSection>
      <Carte>
        <LigneInfo cle="Fiches de contribuables" valeur={String(s.file.contribuables)} />
        <LigneInfo cle="Encaissements" valeur={String(s.file.paiements)} />
        <LigneInfo cle="Refusés par le serveur" valeur={String(s.file.erreurs)} />
        <Text style={[styles.texteDoux, { marginTop: 8 }]}>
          Les saisies sont gardées dans la base du téléphone. L'envoi se fait automatiquement dès que le serveur est joignable
          (retour du réseau, ouverture de l'application, ou toutes les 30 secondes).
        </Text>
      </Carte>

      <Bouton titre={s.enCours ? 'Synchronisation…' : 'Synchroniser maintenant'} icone="sync-outline" onPress={s.lancer} chargement={s.enCours} />

      {r && (
        <>
          <TitreSection>Dernière synchronisation réussie</TitreSection>
          <Carte>
            <LigneInfo cle="Le" valeur={dateHeure(r.fin)} />
            <LigneInfo cle="Fiches envoyées" valeur={String(r.contribuablesEnvoyes)} />
            <LigneInfo cle="Encaissements envoyés" valeur={String(r.paiementsEnvoyes)} />
            <LigneInfo cle="Fiches reçues" valeur={String(r.contribuablesRecus)} />
            <LigneInfo cle="Paiements reçus" valeur={String(r.paiementsRecus)} />
            {r.doublons > 0 && <LigneInfo cle="Doublons signalés à la Mairie" valeur={String(r.doublons)} />}
          </Carte>
        </>
      )}

      {erreurs.length > 0 && (
        <>
          <TitreSection>Refusés par le serveur</TitreSection>
          <Carte style={{ gap: 8 }}>
            {erreurs.map((e) => (
              <View key={e.id}>
                <Text style={styles.texte}>{e.type === 'paiement' ? `Reçu ${e.nom}` : `Fiche ${e.nom} ${e.prenoms || ''}`}</Text>
                <Text style={[styles.texteDoux, { color: couleurs.danger }]}>{e.erreur_synchro}</Text>
              </View>
            ))}
            <Bouton titre="Renvoyer ces éléments" variante="secondaire" icone="refresh-outline"
              onPress={async () => { await reessayerErreurs(); s.lancer(); }} />
          </Carte>
        </>
      )}
    </Ecran>
  );
}
