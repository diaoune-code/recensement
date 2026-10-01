// Espace Collecte : liste des contribuables recensés (base locale, fonctionne hors ligne),
// filtrée par quartier et par la barre de recherche. On touche un contribuable pour encaisser.
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { compterParQuartier, listerContribuables, rechercherContribuables } from '../db/depots';
import { useSession } from '../contexte/Session';
import { useSynchro } from '../contexte/Synchro';
import { BandeauHorsLigne } from '../composants/IndicateurSynchro';
import CarteContribuable from '../composants/CarteContribuable';
import { Bouton, Message } from '../composants/Ui';
import { couleurs, styles } from '../theme';

const PAGE = 50;

function Pastille({ libelle, nombre, actif, onPress }) {
  return (
    <Pressable onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
        borderColor: actif ? couleurs.primaire : couleurs.bordure, backgroundColor: actif ? couleurs.primaire : couleurs.blanc }}>
      <Text style={{ color: actif ? '#fff' : couleurs.texte, fontSize: 14 }}>{libelle}</Text>
      <Text style={{ color: actif ? '#fff' : couleurs.texteDoux, fontSize: 12, fontWeight: '700' }}>{nombre ?? 0}</Text>
    </Pressable>
  );
}

export default function CollecteEcran({ navigation }) {
  const { config } = useSession();
  const { dernierRapport } = useSynchro();
  const [texte, setTexte] = useState('');
  const [quartier, setQuartier] = useState(null); // null = tous les quartiers
  const [liste, setListe] = useState([]);
  const [comptes, setComptes] = useState({});
  const finAtteinte = useRef(false);
  const enRecherche = texte.trim().length >= 2;

  const total = Object.values(comptes).reduce((a, n) => a + n, 0);
  // Quartiers du référentiel, plus ceux présents dans les fiches mais absents de la liste (ancienne saisie)
  const quartiers = [...new Set([...(config?.quartiers || []).map((q) => q.nom), ...Object.keys(comptes).filter(Boolean)])];

  const charger = useCallback(async () => {
    setComptes(await compterParQuartier());
    if (enRecherche) {
      setListe(await rechercherContribuables(texte, 100, quartier));
    } else {
      const premiere = await listerContribuables(PAGE, 0, quartier);
      finAtteinte.current = premiere.length < PAGE;
      setListe(premiere);
    }
  }, [texte, enRecherche, quartier]);

  // Recherche au fil de la frappe et au changement de quartier
  useEffect(() => {
    const minuteur = setTimeout(charger, 250);
    return () => clearTimeout(minuteur);
  }, [charger]);

  // Rechargement au retour sur l'écran et après chaque synchronisation (nouvelles fiches reçues)
  useFocusEffect(useCallback(() => { charger(); }, [charger]));
  useEffect(() => { charger(); }, [dernierRapport]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pageSuivante() {
    if (enRecherche || finAtteinte.current) return;
    const suite = await listerContribuables(PAGE, liste.length, quartier);
    finAtteinte.current = suite.length < PAGE;
    if (suite.length) setListe((l) => [...l, ...suite]);
  }

  function recenser() {
    // Pré-remplit le formulaire avec ce que l'agent a tapé (téléphone ou nom) et le quartier choisi
    const t = texte.trim();
    const prefill = /^[\d\s+]+$/.test(t) ? { telephone: t.replace(/\s/g, '') } : { nom: t.split(' ')[0]?.toUpperCase(), prenoms: t.split(' ').slice(1).join(' ') };
    navigation.navigate('Formulaire', { prefill: { ...prefill, ...(quartier ? { quartier } : {}) } });
  }

  const compteAffiche = quartier ? (comptes[quartier] || 0) : total;

  return (
    <View style={styles.ecran}>
      <BandeauHorsLigne />
      <View style={{ paddingTop: 16, paddingBottom: 12, gap: 10, backgroundColor: couleurs.blanc, borderBottomWidth: 1, borderColor: couleurs.bordure }}>
        <View style={{ marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 8, paddingHorizontal: 12, backgroundColor: couleurs.fond }}>
          <Ionicons name="search" size={18} color={couleurs.texteDoux} />
          <TextInput
            style={{ flex: 1, paddingVertical: 11, fontSize: 16, color: couleurs.texte }}
            placeholder="Nom, téléphone, n° d'étal ou de concession"
            placeholderTextColor="#9aa3b2"
            value={texte}
            onChangeText={setTexte}
            autoCorrect={false}
          />
          {texte ? <Pressable onPress={() => setTexte('')}><Ionicons name="close-circle" size={18} color={couleurs.texteDoux} /></Pressable> : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          <Pastille libelle="Tous les quartiers" nombre={total} actif={!quartier} onPress={() => setQuartier(null)} />
          {quartiers.map((q) => (
            <Pastille key={q} libelle={q} nombre={comptes[q]} actif={quartier === q} onPress={() => setQuartier(quartier === q ? null : q)} />
          ))}
        </ScrollView>

        <Text style={[styles.texteDoux, { fontSize: 12, marginHorizontal: 16 }]}>
          {enRecherche ? `${liste.length} résultat(s)` : `${compteAffiche} contribuable(s)`}
          {quartier ? ` à ${quartier}` : ''}
          {config?.service ? ` — encaissement pour ${config.service.nom}` : ''}
        </Text>
      </View>

      <FlatList
        data={liste}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        onEndReached={pageSuivante}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => <CarteContribuable contribuable={item} onPress={() => navigation.navigate('Fiche', { id: item.id })} />}
        ListEmptyComponent={enRecherche ? (
          <View style={{ gap: 12 }}>
            <Message type="alerte" texte={`Aucun contribuable trouvé pour « ${texte.trim()} »${quartier ? ` à ${quartier}` : ''}.`} />
            <Bouton titre="Recenser cette personne" icone="person-add-outline" onPress={recenser} />
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 10, marginTop: 40 }}>
            <Ionicons name="people-outline" size={42} color={couleurs.bordure} />
            <Text style={[styles.texteDoux, { textAlign: 'center' }]}>
              {quartier
                ? `Aucun contribuable recensé à ${quartier}.`
                : 'Aucun contribuable sur le téléphone pour le moment.\nRecensez une personne ou synchronisez pour recevoir la liste.'}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
