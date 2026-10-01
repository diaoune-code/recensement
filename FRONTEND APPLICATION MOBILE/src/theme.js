import { StyleSheet } from 'react-native';

export const couleurs = {
  primaire: '#0f5c46',
  primaireFonce: '#0a4433',
  primaireClair: '#e4f3ed',
  bleu: '#1d4e89',
  bleuClair: '#e8f0fa',
  texte: '#1c2433',
  texteDoux: '#5b6577',
  bordure: '#dfe3ea',
  fond: '#f4f6f9',
  blanc: '#ffffff',
  succes: '#1f7a4d',
  succesClair: '#e3f4ea',
  alerte: '#b26a00',
  alerteClair: '#fff3dc',
  danger: '#b42318',
  dangerClair: '#fdecea',
};

export const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { padding: 16, gap: 14, paddingBottom: 40 },
  carte: {
    backgroundColor: couleurs.blanc, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: couleurs.bordure,
  },
  titreSection: { fontSize: 13, fontWeight: '700', color: couleurs.texteDoux, textTransform: 'uppercase', letterSpacing: 0.5 },
  titre: { fontSize: 18, fontWeight: '700', color: couleurs.texte },
  texte: { fontSize: 15, color: couleurs.texte },
  texteDoux: { fontSize: 13, color: couleurs.texteDoux },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  montant: { fontSize: 28, fontWeight: '800', color: couleurs.primaire },
});
