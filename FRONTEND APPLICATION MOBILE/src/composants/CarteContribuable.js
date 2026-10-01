// Ligne de liste d'un contribuable (onglets Collecte et Recensement)
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BadgeSynchro } from './Ui';
import { nomComplet } from '../metier/calcul';
import { couleurs, styles } from '../theme';

export default function CarteContribuable({ contribuable: c, onPress }) {
  const emplacement = [c.nom_marche, c.numero_etal && `étal ${c.numero_etal}`, c.numero_porte && `concession ${c.numero_porte}`]
    .filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.carte, { opacity: pressed ? 0.8 : 1, gap: 4 }]}>
      <View style={styles.ligne}>
        <Text style={[styles.texte, { fontWeight: '700', flex: 1 }]} numberOfLines={1}>{nomComplet(c)}</Text>
        <BadgeSynchro etat={c.etat_synchro} />
      </View>
      {c.raison_sociale && c.raison_sociale !== c.nom ? <Text style={styles.texteDoux} numberOfLines={1}>{c.raison_sociale}</Text> : null}
      <View style={styles.ligne}>
        <Text style={[styles.texteDoux, { flex: 1 }]} numberOfLines={1}>
          {[c.numero || 'N° en attente', c.telephone, c.quartier].filter(Boolean).join(' · ')}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={couleurs.texteDoux} />
      </View>
      {emplacement ? <Text style={styles.texteDoux} numberOfLines={1}>{emplacement}</Text> : null}
    </Pressable>
  );
}
