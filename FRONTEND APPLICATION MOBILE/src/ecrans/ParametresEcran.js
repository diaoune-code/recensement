import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { ecrireServeur, lireServeur, serveurJoignable } from '../api/client';
import { Bouton, Carte, Champ, Ecran, Message } from '../composants/Ui';
import { styles } from '../theme';

export default function ParametresEcran({ navigation }) {
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState(null);
  const [test, setTest] = useState(false);

  useEffect(() => { lireServeur().then(setUrl); }, []);

  async function tester() {
    setTest(true);
    setMessage(null);
    const ok = await serveurJoignable(url.trim().replace(/\/+$/, ''));
    setMessage(ok ? { type: 'succes', texte: 'Serveur joignable.' } : { type: 'erreur', texte: 'Serveur injoignable depuis ce téléphone.' });
    setTest(false);
  }

  async function enregistrer() {
    await ecrireServeur(url);
    navigation.goBack();
  }

  return (
    <Ecran>
      <Carte style={{ gap: 12 }}>
        <Text style={styles.titre}>Adresse du serveur</Text>
        <Text style={styles.texteDoux}>
          Adresse du BACKEND APPLICATION MOBILE (port 4001). Sur un téléphone, utilisez l'adresse IP de l'ordinateur
          sur le réseau local, par exemple http://192.168.1.20:4001. Sur l'émulateur Android : http://10.0.2.2:4001.
        </Text>
        <Champ libelle="URL du serveur" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <Message texte={message?.texte} type={message?.type} />
        <Bouton titre="Tester la connexion" variante="secondaire" icone="pulse-outline" onPress={tester} chargement={test} />
        <Bouton titre="Enregistrer" icone="save-outline" onPress={enregistrer} />
      </Carte>
    </Ecran>
  );
}
