// Reçu numérique : numéro unique et QR code vérifiable par la Mairie
import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { useSession } from '../contexte/Session';
import { lireContribuable, lirePaiement } from '../db/depots';
import { Badge, Bouton, Carte, Ecran, LigneInfo, Message } from '../composants/Ui';
import { dateHeure, gnf, libellePeriode, nomComplet } from '../metier/calcul';
import { contenuQr, enregistrerPdf, imprimerRecu, partagerPdf } from '../metier/recuPdf';
import { couleurs, styles } from '../theme';

export default function RecuEcran({ navigation, route }) {
  const { id, nouveau } = route.params;
  const { config, agent } = useSession();
  const [p, setP] = useState(null);
  const [c, setC] = useState(null);
  const [action, setAction] = useState(null); // 'partager' | 'enregistrer' | 'imprimer' pendant la génération du PDF

  useFocusEffect(useCallback(() => {
    (async () => {
      const paiement = await lirePaiement(id);
      setP(paiement);
      if (paiement) setC(await lireContribuable(paiement.contribuable_id));
    })();
  }, [id]));

  if (!p) return <Ecran><Text style={styles.texteDoux}>Chargement…</Text></Ecran>;
  const t = config?.taches?.find((x) => x.id === p.tache_id);
  const qr = contenuQr(p);
  // Service concerné : configuration reçue du serveur, sinon le service du compte de l'agent (connu dès la connexion)
  const service = config?.service || agent?.service;
  const donneesPdf = { paiement: p, contribuable: c, tache: t, service, agent };

  async function executer(nom, fn) {
    setAction(nom);
    try {
      const resultat = await fn(donneesPdf);
      if (nom === 'enregistrer' && resultat) Alert.alert('Reçu enregistré', `Le fichier ${resultat} a été enregistré dans le dossier choisi.`);
    } catch (e) {
      Alert.alert('Reçu PDF', e.message || 'Impossible de générer le PDF');
    } finally {
      setAction(null);
    }
  }

  return (
    <Ecran>
      {nouveau && <Message type="succes" texte="Encaissement enregistré. Remettez le reçu au contribuable." />}
      <Carte style={{ gap: 6, padding: 20 }}>
        <View style={{ alignItems: 'center', gap: 2, marginBottom: 8 }}>
          <Text style={styles.texteDoux}>République de Guinée</Text>
          <Text style={[styles.titre, { color: couleurs.primaire }]}>Commune de Lambanyi</Text>
          <Text style={styles.texteDoux}>{service?.nom}</Text>
          <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 1, marginTop: 6 }}>REÇU DE PAIEMENT</Text>
          <Text style={{ fontFamily: 'monospace', fontSize: 15, marginTop: 2 }}>{p.numero_recu}</Text>
        </View>
        <LigneInfo cle="Date" valeur={dateHeure(p.date_paiement)} />
        <LigneInfo cle="Contribuable" valeur={nomComplet(c)} />
        <LigneInfo cle="N° contribuable" valeur={c?.numero || 'attribué à la synchronisation'} />
        <LigneInfo cle="Service concerné" valeur={service?.nom} />
        <LigneInfo cle="Objet" valeur={t?.libelle} />
        <LigneInfo cle="Code budgétaire" valeur={t?.ligne_code} />
        <LigneInfo cle="Période" valeur={t ? libellePeriode(t.frequence, p.periode) : p.periode} />
        {p.base_valeur ? <LigneInfo cle="Base" valeur={`${p.base_valeur} ${t?.base_libelle || ''}`} /> : null}
        {p.categorie ? <LigneInfo cle="Catégorie" valeur={p.categorie} /> : null}
        <LigneInfo cle="Mode" valeur={p.mode_paiement === 'ESPECES' ? 'Espèces' : 'Mobile money'} />
        <LigneInfo cle="Agent" valeur={`${agent?.identifiant} — ${agent?.nom} ${agent?.prenoms || ''}`} />
        <View style={{ borderTopWidth: 1, borderColor: couleurs.bordure, marginTop: 8, paddingTop: 10, alignItems: 'center', gap: 4 }}>
          <Text style={styles.texteDoux}>Montant payé</Text>
          <Text style={styles.montant}>{gnf(p.montant)}</Text>
        </View>
        <View style={{ alignItems: 'center', marginTop: 12, gap: 8 }}>
          <QRCode value={qr} size={150} />
          <Text style={[styles.texteDoux, { textAlign: 'center' }]}>Vérifiable par la Mairie avec le numéro ou ce QR code</Text>
        </View>
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          {p.statut === 'ANNULE' ? <Badge texte="Annulé par le service" type="danger" />
            : p.etat_synchro === 'SYNCHRONISE' ? <Badge texte="Transmis à la commune" type="succes" />
              : p.etat_synchro === 'ERREUR' ? <Badge texte={`Refusé : ${p.erreur_synchro}`} type="danger" />
                : <Badge texte="Sur le téléphone — envoi automatique dès que le réseau revient" type="alerte" />}
        </View>
        {p.telephone_sms ? <Text style={[styles.texteDoux, { textAlign: 'center' }]}>SMS envoyé au {p.telephone_sms} à la transmission</Text> : null}
      </Carte>
      <Bouton titre="Partager le reçu en PDF" icone="share-social-outline" variante="bleu"
        onPress={() => executer('partager', partagerPdf)} chargement={action === 'partager'} desactive={!!action} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Bouton titre="Télécharger PDF" icone="download-outline" variante="secondaire" style={{ flex: 1 }}
          onPress={() => executer('enregistrer', enregistrerPdf)} chargement={action === 'enregistrer'} desactive={!!action} />
        <Bouton titre="Imprimer" icone="print-outline" variante="secondaire" style={{ flex: 1 }}
          onPress={() => executer('imprimer', imprimerRecu)} chargement={action === 'imprimer'} desactive={!!action} />
      </View>
      <Bouton titre="Terminer" icone="checkmark" onPress={() => navigation.popToTop()} />
    </Ecran>
  );
}
