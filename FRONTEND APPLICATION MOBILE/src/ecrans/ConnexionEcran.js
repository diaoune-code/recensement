import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../contexte/Session';
import { lireServeur } from '../api/client';
import { lireMeta } from '../db/base';
import { Bouton, Champ, Ecran, Message } from '../composants/Ui';
import { couleurs, styles } from '../theme';

export default function ConnexionEcran({ navigation }) {
  const { connecter } = useSession();
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [serveur, setServeur] = useState('');

  useEffect(() => {
    const maj = async () => {
      setServeur(await lireServeur());
      const s = await lireMeta('session');
      if (s?.agent && !identifiant) setIdentifiant(s.agent.identifiant);
    };
    maj();
    return navigation.addListener('focus', maj);
  }, [navigation]); // eslint-disable-line react-hooks/exhaustive-deps

  async function soumettre() {
    setErreur(null);
    setEnvoi(true);
    try {
      await connecter(identifiant, motDePasse);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Ecran style={{ paddingTop: 0 }}>
        <View style={{ backgroundColor: couleurs.primaire, marginHorizontal: -16, padding: 24, paddingTop: 56, gap: 6 }}>
          <View style={{ flexDirection: 'row', height: 4, width: 54, borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
            <View style={{ flex: 1, backgroundColor: '#ce1126' }} />
            <View style={{ flex: 1, backgroundColor: '#fcd116' }} />
            <View style={{ flex: 1, backgroundColor: '#009460' }} />
          </View>
          <Text style={{ color: '#fff', opacity: 0.8 }}>Commune de Lambanyi</Text>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>Recensement et collecte</Text>
          <Text style={{ color: '#fff', opacity: 0.85, lineHeight: 20 }}>
            Application des agents de terrain. Elle fonctionne aussi sans réseau : vos saisies partent automatiquement dès que la connexion revient.
          </Text>
        </View>

        <View style={{ gap: 14, marginTop: 10 }}>
          <Text style={styles.titre}>Connexion agent</Text>
          <Message texte={erreur} type="erreur" />
          <Champ libelle="Identifiant agent" placeholder="ex. PF-001" autoCapitalize="characters" autoCorrect={false}
            value={identifiant} onChangeText={setIdentifiant} />
          <Champ libelle="Mot de passe" secureTextEntry value={motDePasse} onChangeText={setMotDePasse} onSubmitEditing={soumettre} />
          <Bouton titre="Se connecter" icone="log-in-outline" onPress={soumettre} chargement={envoi} desactive={!identifiant || !motDePasse} />
          <Text style={styles.texteDoux}>
            Votre service est reconnu automatiquement : vous ne verrez que ses formulaires et ses taxes.
          </Text>
        </View>

        <Pressable onPress={() => navigation.navigate('Parametres')} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 20 }}>
          <Ionicons name="server-outline" size={16} color={couleurs.texteDoux} />
          <Text style={[styles.texteDoux, { flex: 1 }]}>Serveur : {serveur}</Text>
          <Text style={{ color: couleurs.bleu, fontWeight: '600' }}>Modifier</Text>
        </Pressable>
      </Ecran>
    </KeyboardAvoidingView>
  );
}
