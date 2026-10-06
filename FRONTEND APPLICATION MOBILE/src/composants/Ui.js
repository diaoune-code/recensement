import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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

// Choix multiple (cases à cocher en pastilles) : `valeurs` est un tableau
export function ChoixMultiple({ libelle, options, valeurs = [], onChange, aide }) {
  const basculer = (v) => onChange(valeurs.includes(v) ? valeurs.filter((x) => x !== v) : [...valeurs, v]);
  return (
    <View style={{ gap: 6 }}>
      {libelle && <Text style={st.libelle}>{libelle}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const actif = valeurs.includes(o.valeur);
          return (
            <Pressable key={o.valeur} onPress={() => basculer(o.valeur)}
              style={[st.pastille, { flexDirection: 'row', alignItems: 'center', gap: 6 }, actif && { backgroundColor: couleurs.primaire, borderColor: couleurs.primaire }]}>
              <Ionicons name={actif ? 'checkbox' : 'square-outline'} size={16} color={actif ? '#fff' : couleurs.texteDoux} />
              <Text style={{ color: actif ? '#fff' : couleurs.texte, fontSize: 14, flexShrink: 1 }}>{o.libelle}</Text>
            </Pressable>
          );
        })}
      </View>
      {aide && <Text style={s.texteDoux}>{aide}</Text>}
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

// Liste déroulante : le champ affiche le choix ; un appui ouvre la liste des options.
// `multiple` : plusieurs choix possibles (valeur = tableau), validés par le bouton « Valider ».
export function ListeDeroulante({ libelle, options, valeur, onChange, obligatoire, multiple = false, aide, placeholder = 'Choisir…' }) {
  const [ouvert, setOuvert] = useState(false);
  const [brouillon, setBrouillon] = useState([]);
  const opts = options.map((o) => (typeof o === 'string' ? { valeur: o, libelle: o } : o));
  const choisies = multiple ? (valeur || []) : [];
  const affichage = multiple
    ? opts.filter((o) => choisies.includes(o.valeur)).map((o) => o.libelle).join(', ')
    : opts.find((o) => o.valeur === valeur)?.libelle;

  const ouvrir = () => { setBrouillon(choisies); setOuvert(true); };
  const choisir = (v) => {
    if (multiple) setBrouillon((b) => (b.includes(v) ? b.filter((x) => x !== v) : [...b, v]));
    else { onChange(v); setOuvert(false); }
  };

  return (
    <View style={{ gap: 5 }}>
      {libelle && <Text style={st.libelle}>{libelle}{obligatoire ? ' *' : ''}</Text>}
      <Pressable onPress={ouvrir} accessibilityRole="button" accessibilityLabel={libelle}
        style={[st.saisie, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
        <Text style={{ flex: 1, fontSize: 15, color: affichage ? couleurs.texte : '#9aa3b2' }} numberOfLines={2}>{affichage || placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={couleurs.texteDoux} />
      </Pressable>
      {aide && <Text style={s.texteDoux}>{aide}</Text>}

      <Modal visible={ouvert} transparent animationType="slide" onRequestClose={() => setOuvert(false)}>
        <View style={st.voile}>
          <Pressable style={{ flex: 1 }} onPress={() => setOuvert(false)} />
          <View style={st.feuille}>
            <View style={[s.ligne, { justifyContent: 'space-between', marginBottom: 8 }]}>
              <Text style={[s.titre, { fontSize: 17, flex: 1 }]} numberOfLines={2}>{libelle}</Text>
              <Pressable onPress={() => setOuvert(false)} hitSlop={10}><Ionicons name="close" size={24} color={couleurs.texteDoux} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {!multiple && !obligatoire && valeur ? (
                <Pressable onPress={() => { onChange(null); setOuvert(false); }} style={st.option}>
                  <Text style={{ fontSize: 15, color: couleurs.texteDoux, fontStyle: 'italic' }}>Effacer le choix</Text>
                </Pressable>
              ) : null}
              {opts.map((o) => {
                const actif = multiple ? brouillon.includes(o.valeur) : o.valeur === valeur;
                return (
                  <Pressable key={String(o.valeur)} onPress={() => choisir(o.valeur)} style={[st.option, actif && { backgroundColor: couleurs.primaireClair }]}>
                    <Ionicons name={multiple ? (actif ? 'checkbox' : 'square-outline') : (actif ? 'radio-button-on' : 'radio-button-off')}
                      size={20} color={actif ? couleurs.primaire : couleurs.texteDoux} />
                    <Text style={{ flex: 1, fontSize: 15, color: couleurs.texte }}>{o.libelle}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {multiple && (
              <Pressable onPress={() => { onChange(brouillon); setOuvert(false); }} style={[st.bouton, { backgroundColor: couleurs.primaire, borderColor: couleurs.primaire, marginTop: 12 }]}>
                <Text style={[st.boutonTexte, { color: '#fff' }]}>Valider ({brouillon.length})</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  voile: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  feuille: { backgroundColor: couleurs.blanc, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 28 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  bouton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  boutonTexte: { fontSize: 15, fontWeight: '600' },
  libelle: { fontSize: 13, fontWeight: '600', color: couleurs.texteDoux },
  saisie: { backgroundColor: couleurs.blanc, borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: couleurs.texte },
  pastille: { borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.blanc, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
});
