import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { couleurs, styles as s } from '../theme';

export function Ecran({ children, defilement = true, style }) {
  if (!defilement) return <View style={[s.ecran, style]}>{children}</View>;
  return (
    <ScrollView style={s.ecran} contentContainerStyle={[s.contenu, style]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export const Carte = ({ children, style }) => <View style={[s.carte, style]}>{children}</View>;

export const TitreSection = ({ children }) => <Text style={[s.titreSection, { marginTop: 6 }]}>{children}</Text>;

export function Bouton({ titre, onPress, variante = 'primaire', icone, desactive, chargement, style }) {
  const v = VARIANTES[variante];
  return (
    <Pressable
      onPress={onPress}
      disabled={desactive || chargement}
      style={({ pressed }) => [st.bouton, { backgroundColor: v.fond, borderColor: v.bord, opacity: desactive ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      {chargement ? <ActivityIndicator color={v.texte} /> : (
        <>
          {icone && <Ionicons name={icone} size={18} color={v.texte} />}
          <Text style={[st.boutonTexte, { color: v.texte }]}>{titre}</Text>
        </>
      )}
    </Pressable>
  );
}

const VARIANTES = {
  primaire: { fond: couleurs.primaire, bord: couleurs.primaire, texte: '#fff' },
  secondaire: { fond: couleurs.blanc, bord: couleurs.bordure, texte: couleurs.texte },
  danger: { fond: couleurs.blanc, bord: '#f1c4bf', texte: couleurs.danger },
  bleu: { fond: couleurs.bleu, bord: couleurs.bleu, texte: '#fff' },
};

export function Champ({ libelle, obligatoire, aide, ...props }) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={st.libelle}>{libelle}{obligatoire ? ' *' : ''}</Text>
      <TextInput placeholderTextColor="#9aa3b2" style={[st.saisie, props.multiline && { minHeight: 70, textAlignVertical: 'top' }]} {...props} />
      {aide && <Text style={s.texteDoux}>{aide}</Text>}
    </View>
  );
}

// Choix parmi une liste courte, sous forme de pastilles
export function Choix({ libelle, options, valeur, onChange, obligatoire }) {
  return (
    <View style={{ gap: 6 }}>
      {libelle && <Text style={st.libelle}>{libelle}{obligatoire ? ' *' : ''}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const val = typeof o === 'string' ? o : o.valeur;
          const lib = typeof o === 'string' ? o : o.libelle;
          const actif = valeur === val;
          return (
            <Pressable key={val} onPress={() => onChange(actif ? null : val)}
              style={[st.pastille, actif && { backgroundColor: couleurs.primaire, borderColor: couleurs.primaire }]}>
              <Text style={{ color: actif ? '#fff' : couleurs.texte, fontSize: 14 }}>{lib}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Badge({ texte, type = 'neutre' }) {
  const c = {
    neutre: [couleurs.fond, couleurs.texteDoux], succes: [couleurs.succesClair, couleurs.succes],
    alerte: [couleurs.alerteClair, couleurs.alerte], danger: [couleurs.dangerClair, couleurs.danger], info: [couleurs.bleuClair, couleurs.bleu],
  }[type];
  return (
    <View style={{ backgroundColor: c[0], paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start' }}>
      <Text style={{ color: c[1], fontSize: 12, fontWeight: '700' }}>{texte}</Text>
    </View>
  );
}

// Indique si une saisie est encore sur le téléphone ou déjà transmise à la commune
export function BadgeSynchro({ etat }) {
  if (etat === 'EN_ATTENTE') return <Badge texte="À envoyer" type="alerte" />;
  if (etat === 'ERREUR') return <Badge texte="Refusé" type="danger" />;
  return <Badge texte="Transmis" type="succes" />;
}

export function Message({ texte, type = 'info' }) {
  if (!texte) return null;
  const c = { info: [couleurs.bleuClair, couleurs.bleu], erreur: [couleurs.dangerClair, couleurs.danger], alerte: [couleurs.alerteClair, couleurs.alerte], succes: [couleurs.succesClair, couleurs.succes] }[type];
  return <View style={{ backgroundColor: c[0], borderRadius: 8, padding: 12 }}><Text style={{ color: c[1], fontSize: 14 }}>{texte}</Text></View>;
}

export function LigneInfo({ cle, valeur }) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 }}>
      <Text style={s.texteDoux}>{cle}</Text>
      <Text style={[s.texte, { flexShrink: 1, textAlign: 'right', fontWeight: '500' }]}>{String(valeur)}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  bouton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  boutonTexte: { fontSize: 15, fontWeight: '600' },
  libelle: { fontSize: 13, fontWeight: '600', color: couleurs.texteDoux },
  saisie: { backgroundColor: couleurs.blanc, borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: couleurs.texte },
  pastille: { borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.blanc, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
});
