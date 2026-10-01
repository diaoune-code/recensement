// Espace Recensement : bouton d'ajout direct d'une nouvelle personne, puis les fiches
// pas encore transmises. Une fiche disparaît de la liste dès que le serveur l'a reçue.
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { recensementsNonTransmis } from '../db/depots';
import { useSession } from '../contexte/Session';
import { useSynchro } from '../contexte/Synchro';
import { BandeauHorsLigne } from '../composants/IndicateurSynchro';
import CarteContribuable from '../composants/CarteContribuable';
import { Bouton } from '../composants/Ui';
import { couleurs, styles } from '../theme';

export default function RecensementEcran({ navigation }) {
  const { config } = useSession();
  const { file, enCours } = useSynchro();
  const [enAttente, setEnAttente] = useState([]);

  const charger = useCallback(() => { recensementsNonTransmis().then(setEnAttente); }, []);
  useFocusEffect(charger);
  // Rafraîchi après chaque envoi : les fiches transmises disparaissent
  useEffect(charger, [file.contribuables, file.erreurs, enCours, charger]);

  return (
    <View style={styles.ecran}>
      <BandeauHorsLigne />
      <FlatList
        data={enAttente}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        ListHeaderComponent={(
          <View style={{ gap: 14, marginBottom: 6 }}>
            <Bouton titre="Recenser une nouvelle personne" icone="person-add" onPress={() => navigation.navigate('Formulaire')}
              style={{ paddingVertical: 18 }} />
            <Text style={styles.texteDoux}>
              Identité, localisation GPS, photo, activité{config?.service?.champs?.length ? ` et informations du service ${config.service.nom}` : ''}.
              La fiche est enregistrée sur le téléphone puis transmise automatiquement.
            </Text>
            <Text style={[styles.titreSection, { marginTop: 8 }]}>
              En attente de transmission{enAttente.length ? ` (${enAttente.length})` : ''}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={{ gap: 4 }}>
            <CarteContribuable contribuable={item} onPress={() => navigation.navigate('Fiche', { id: item.id })} />
            {item.etat_synchro === 'ERREUR' && item.erreur_synchro
              ? <Text style={[styles.texteDoux, { color: couleurs.danger, paddingHorizontal: 4 }]}>Refusée : {item.erreur_synchro}</Text>
              : null}
          </View>
        )}
        ListEmptyComponent={(
          <View style={{ alignItems: 'center', gap: 8, marginTop: 24 }}>
            <Ionicons name="checkmark-done-circle-outline" size={40} color={couleurs.succes} />
            <Text style={[styles.texteDoux, { textAlign: 'center' }]}>
              Toutes les fiches ont été transmises.{'\n'}Retrouvez les contribuables dans l'espace Collecte.
            </Text>
          </View>
        )}
      />
    </View>
  );
}
