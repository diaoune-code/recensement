// Accueil de l'agent : accès aux deux espaces (Collecte, Recensement) et résumé de la journée
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../contexte/Session';
import { useSynchro } from '../contexte/Synchro';
import { compterContribuables, paiementsDuJour } from '../db/depots';
import { BandeauHorsLigne } from '../composants/IndicateurSynchro';
import { Ecran } from '../composants/Ui';
import { gnf } from '../metier/calcul';
import { couleurs, styles } from '../theme';

function GrandBouton({ icone, titre, description, couleur, onPress }) {
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => [styles.carte, {
        flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderLeftWidth: 5, borderLeftColor: couleur, opacity: pressed ? 0.85 : 1,
      }]}>
      <View style={{ width: 58, height: 58, borderRadius: 14, backgroundColor: `${couleur}1a`, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icone} size={30} color={couleur} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: couleurs.texte }}>{titre}</Text>
        <Text style={styles.texteDoux}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={couleurs.texteDoux} />
    </Pressable>
  );
}

function Indicateur({ libelle, valeur }) {
  return (
    <View style={[styles.carte, { flex: 1, gap: 2, padding: 12 }]}>
      <Text style={[styles.texteDoux, { fontSize: 12 }]}>{libelle}</Text>
      <Text style={{ fontSize: 16, fontWeight: '800', color: couleurs.texte }}>{valeur}</Text>
    </View>
  );
}

export default function AccueilEcran({ navigation }) {
  const { agent, config } = useSession();
  const { file } = useSynchro();
  const [jour, setJour] = useState({ montant: 0, nb: 0 });
  const [nbContribuables, setNbContribuables] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!agent) return;
    paiementsDuJour(agent.id).then((ps) => {
      const valides = ps.filter((p) => p.statut === 'VALIDE');
      setJour({ montant: valides.reduce((a, p) => a + p.montant, 0), nb: valides.length });
    });
    compterContribuables().then(setNbContribuables);
  }, [agent]));

  const service = config?.service || agent?.service;

  return (
    <View style={styles.ecran}>
      <BandeauHorsLigne />
      <Ecran>
        <View style={{ gap: 2, marginBottom: 4 }}>
          <Text style={styles.texteDoux}>Bonjour,</Text>
          <Text style={styles.titre}>{agent?.prenoms} {agent?.nom}</Text>
          <Text style={styles.texteDoux}>{agent?.identifiant} · {service?.nom}</Text>
        </View>

        <GrandBouton icone="cash-outline" titre="Collecte" couleur={couleurs.primaire}
          description={`Retrouver un contribuable et encaisser les taxes${service?.sigle ? ` du service ${service.sigle}` : ''}`}
          onPress={() => navigation.navigate('Collecte')} />
        <GrandBouton icone="person-add-outline" titre="Recensement" couleur={couleurs.bleu}
          description="Enregistrer une personne absente de la base (identité, GPS, photo, activité)"
          onPress={() => navigation.navigate('Recensement')} />

        <Text style={[styles.titreSection, { marginTop: 10 }]}>Aujourd'hui</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Indicateur libelle="Encaissé" valeur={gnf(jour.montant)} />
          <Indicateur libelle="Reçus" valeur={String(jour.nb)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Indicateur libelle="Contribuables sur le téléphone" valeur={String(nbContribuables)} />
          <Indicateur libelle="En attente d'envoi" valeur={String(file.total)} />
        </View>
      </Ecran>
    </View>
  );
}
