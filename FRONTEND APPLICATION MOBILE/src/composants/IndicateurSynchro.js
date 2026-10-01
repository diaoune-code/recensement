// Pastille d'état affichée dans l'en-tête : en ligne / hors ligne / envoi en cours / éléments en attente
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSynchro } from '../contexte/Synchro';

export default function IndicateurSynchro() {
  const { enCours, reseau, serveurJoignable, file, sessionExpiree } = useSynchro();
  const navigation = useNavigation();
  const horsLigne = !reseau || serveurJoignable === false;

  let icone = 'cloud-done-outline';
  if (horsLigne) icone = 'cloud-offline-outline';
  else if (file.total > 0) icone = 'cloud-upload-outline';
  if (sessionExpiree) icone = 'alert-circle-outline';

  return (
    <Pressable onPress={() => navigation.navigate('Onglets', { screen: 'Synchro' })} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
      {enCours ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name={icone} size={22} color="#fff" />}
      {file.total > 0 && (
        <View style={{ backgroundColor: '#fcd116', borderRadius: 10, minWidth: 20, paddingHorizontal: 5, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#1c2433' }}>{file.total}</Text>
        </View>
      )}
    </Pressable>
  );
}

// Bandeau affiché en haut des écrans principaux quand le téléphone travaille hors ligne
export function BandeauHorsLigne() {
  const { reseau, serveurJoignable, file, sessionExpiree } = useSynchro();
  const horsLigne = !reseau || serveurJoignable === false;
  if (sessionExpiree) {
    return (
      <View style={{ backgroundColor: '#fdecea', padding: 10 }}>
        <Text style={{ color: '#b42318', fontSize: 13 }}>Session expirée : déconnectez-vous puis reconnectez-vous avec du réseau pour envoyer vos saisies.</Text>
      </View>
    );
  }
  if (!horsLigne) return null;
  return (
    <View style={{ backgroundColor: '#fff3dc', padding: 10, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Ionicons name="cloud-offline-outline" size={18} color="#b26a00" />
      <Text style={{ color: '#b26a00', fontSize: 13, flex: 1 }}>
        Mode hors ligne : vous pouvez continuer à travailler.{file.total > 0 ? ` ${file.total} saisie(s) seront envoyées automatiquement au retour du réseau.` : ''}
      </Text>
    </View>
  );
}
