// Ma journée : ce que l'agent a encaissé aujourd'hui, à reverser au chef de service à la clôture
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSession } from '../contexte/Session';
import { paiementsDuJour, recensesDuJour } from '../db/depots';
import { BandeauHorsLigne } from '../composants/IndicateurSynchro';
import { BadgeSynchro, Bouton, Carte, Ecran, TitreSection } from '../composants/Ui';
import { gnf, jourIso, nomComplet } from '../metier/calcul';
import { couleurs, styles } from '../theme';

export default function JourneeEcran({ navigation }) {
  const { agent, config, deconnecter } = useSession();
  const [paiements, setPaiements] = useState([]);
  const [recenses, setRecenses] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!agent) return;
    paiementsDuJour(agent.id).then(setPaiements);
    recensesDuJour().then(setRecenses);
  }, [agent]));

  const valides = paiements.filter((p) => p.statut === 'VALIDE');
  const total = valides.reduce((a, p) => a + p.montant, 0);
  const especes = valides.filter((p) => p.mode_paiement === 'ESPECES').reduce((a, p) => a + p.montant, 0);
  const [a, m, j] = jourIso().split('-');

  return (
    <View style={styles.ecran}>
      <BandeauHorsLigne />
      <Ecran>
        <Carte style={{ gap: 4 }}>
          <Text style={styles.texteDoux}>{agent?.identifiant} · {config?.service?.nom}</Text>
          <Text style={styles.titre}>{agent?.nom} {agent?.prenoms}</Text>
          <Text style={styles.texteDoux}>Journée du {j}/{m}/{a}</Text>
        </Carte>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Carte style={{ flex: 1, gap: 2 }}>
            <Text style={styles.texteDoux}>Encaissé</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: couleurs.primaire }}>{gnf(total)}</Text>
            <Text style={styles.texteDoux}>{valides.length} reçu(s)</Text>
          </Carte>
          <Carte style={{ flex: 1, gap: 2 }}>
            <Text style={styles.texteDoux}>Espèces à reverser</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: couleurs.texte }}>{gnf(especes)}</Text>
            <Text style={styles.texteDoux}>{recenses} recensé(s)</Text>
          </Carte>
        </View>
        <Text style={styles.texteDoux}>
          En fin de journée, reversez les espèces à votre chef de service : il valide la clôture de votre caisse dans l'application Service.
        </Text>

        <TitreSection>Reçus du jour</TitreSection>
        <Carte style={{ gap: 6 }}>
          {paiements.length ? paiements.map((p) => (
            <Pressable key={p.id} onPress={() => navigation.navigate('Recu', { id: p.id })} style={{ paddingVertical: 6, gap: 2 }}>
              <View style={styles.ligne}>
                <Text style={[styles.texte, { flex: 1 }]}>{nomComplet(p)}</Text>
                <Text style={[styles.texte, { fontWeight: '700' }]}>{gnf(p.montant)}</Text>
              </View>
              <View style={styles.ligne}>
                <Text style={[styles.texteDoux, { flex: 1 }]}>{p.numero_recu} · {config?.taches?.find((t) => t.id === p.tache_id)?.libelle}</Text>
                <BadgeSynchro etat={p.etat_synchro} />
              </View>
            </Pressable>
          )) : <Text style={styles.texteDoux}>Aucun encaissement aujourd'hui.</Text>}
        </Carte>

        <Bouton titre="Paramètres du serveur" icone="server-outline" variante="secondaire" onPress={() => navigation.navigate('Parametres')} />
        <Bouton titre="Se déconnecter" icone="log-out-outline" variante="danger" onPress={deconnecter} />
      </Ecran>
    </View>
  );
}
