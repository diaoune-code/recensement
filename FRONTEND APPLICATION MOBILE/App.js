// Application mobile des agents de terrain — Commune de Lambanyi
// Deux espaces : Recensement (enregistrer un contribuable absent de la base) et Collecte (encaisser les taxes du service).
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { FournisseurSession, useSession } from './src/contexte/Session';
import { FournisseurSynchro, useSynchro } from './src/contexte/Synchro';
import IndicateurSynchro from './src/composants/IndicateurSynchro';
import ConnexionEcran from './src/ecrans/ConnexionEcran';
import ParametresEcran from './src/ecrans/ParametresEcran';
import AccueilEcran from './src/ecrans/AccueilEcran';
import CollecteEcran from './src/ecrans/CollecteEcran';
import RecensementEcran from './src/ecrans/RecensementEcran';
import FormulaireContribuableEcran from './src/ecrans/FormulaireContribuableEcran';
import FicheContribuableEcran from './src/ecrans/FicheContribuableEcran';
import EncaissementEcran from './src/ecrans/EncaissementEcran';
import RecuEcran from './src/ecrans/RecuEcran';
import JourneeEcran from './src/ecrans/JourneeEcran';
import SynchroEcran from './src/ecrans/SynchroEcran';
import { couleurs } from './src/theme';

const Pile = createNativeStackNavigator();
const Onglets = createBottomTabNavigator();

const entete = {
  headerStyle: { backgroundColor: couleurs.primaire },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' },
};

// Onglets : Accueil (accès aux espaces Collecte et Recensement), Ma journée, Synchronisation
function EspacesAgent() {
  const { file } = useSynchro();
  return (
    <Onglets.Navigator
      screenOptions={({ route }) => ({
        ...entete,
        headerRight: () => <IndicateurSynchro />,
        headerRightContainerStyle: { paddingRight: 12 },
        tabBarActiveTintColor: couleurs.primaire,
        tabBarIcon: ({ color, size }) => {
          const icones = { Accueil: 'home-outline', Journee: 'today-outline', Synchro: 'sync-outline' };
          return <Ionicons name={icones[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Onglets.Screen name="Accueil" component={AccueilEcran} options={{ title: 'Lambanyi Collecte', tabBarLabel: 'Accueil' }} />
      <Onglets.Screen name="Journee" component={JourneeEcran} options={{ title: 'Ma journée', tabBarLabel: 'Ma journée' }} />
      <Onglets.Screen name="Synchro" component={SynchroEcran}
        options={{ title: 'Synchronisation', tabBarLabel: 'Synchro', tabBarBadge: file.total > 0 ? file.total : undefined }} />
    </Onglets.Navigator>
  );
}

function Navigation() {
  const { pret, session } = useSession();
  if (!pret) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={couleurs.primaire} /></View>;
  }
  return (
    <Pile.Navigator screenOptions={entete}>
      {session ? (
        <>
          <Pile.Screen name="Onglets" component={EspacesAgent} options={{ headerShown: false }} />
          <Pile.Screen name="Collecte" component={CollecteEcran} options={{ title: 'Collecte', headerRight: () => <IndicateurSynchro /> }} />
          <Pile.Screen name="Recensement" component={RecensementEcran} options={{ title: 'Recensement', headerRight: () => <IndicateurSynchro /> }} />
          <Pile.Screen name="Fiche" component={FicheContribuableEcran} options={{ title: 'Fiche contribuable', headerRight: () => <IndicateurSynchro /> }} />
          <Pile.Screen name="Formulaire" component={FormulaireContribuableEcran} options={{ title: 'Recensement' }} />
          <Pile.Screen name="Encaissement" component={EncaissementEcran} options={{ title: 'Encaissement' }} />
          <Pile.Screen name="Recu" component={RecuEcran} options={{ title: 'Reçu' }} />
        </>
      ) : (
        <Pile.Screen name="Connexion" component={ConnexionEcran} options={{ headerShown: false }} />
      )}
      <Pile.Screen name="Parametres" component={ParametresEcran} options={{ title: 'Serveur' }} />
    </Pile.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <FournisseurSession>
        <FournisseurSynchro>
          <NavigationContainer>
            <StatusBar style="light" />
            <Navigation />
          </NavigationContainer>
        </FournisseurSynchro>
      </FournisseurSession>
    </SafeAreaProvider>
  );
}
