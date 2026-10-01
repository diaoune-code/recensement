// Reçu de paiement au format PDF : génération (expo-print), partage (expo-sharing),
// enregistrement dans un dossier choisi par l'agent (expo-file-system) et impression.
// Tout fonctionne sans réseau : le PDF est produit sur le téléphone.
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import QRCode from 'qrcode';
import { dateHeure, gnf, libellePeriode, nomComplet } from './calcul';

// Contenu du QR code, lu par la Mairie pour vérifier le reçu (Contrôle → Vérifier un reçu)
export const contenuQr = (p) => `LAMBANYI|${p.numero_recu}|${p.montant}|${p.date_paiement}`;

// QR code dessiné en SVG (pas d'image externe : le PDF reste autonome)
function qrSvg(texte, taille = 130) {
  const { modules } = QRCode.create(texte, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  const marge = 2;
  let chemin = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (modules.get(y, x)) chemin += `M${x + marge} ${y + marge}h1v1h-1z`;
    }
  }
  const cote = n + marge * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 ${cote} ${cote}" shape-rendering="crispEdges">`
    + `<rect width="100%" height="100%" fill="#fff"/><path d="${chemin}" fill="#000"/></svg>`;
}

const echapper = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function statut(p) {
  if (p.statut === 'ANNULE') return { texte: 'ANNULÉ PAR LE SERVICE', couleur: '#b42318' };
  if (p.etat_synchro === 'SYNCHRONISE') return { texte: 'Transmis à la commune', couleur: '#1f7a4d' };
  return { texte: 'Enregistré sur le terminal de l\'agent — transmission automatique', couleur: '#b26a00' };
}

// { paiement, contribuable, tache, service, agent }
export function construireHtml({ paiement: p, contribuable: c, tache: t, service, agent }) {
  const lignes = [
    ['Date', dateHeure(p.date_paiement)],
    ['Contribuable', nomComplet(c)],
    ['N° contribuable', c?.numero || 'attribué à la synchronisation'],
    ['Téléphone', c?.telephone],
    ['Quartier', c?.quartier],
    ['Service concerné', service?.nom],
    ['Objet', t?.libelle],
    ['Code budgétaire', t?.ligne_code],
    ['Période', t ? libellePeriode(t.frequence, p.periode) : p.periode],
    ['Base', p.base_valeur ? `${p.base_valeur} ${t?.base_libelle || ''}` : null],
    ['Catégorie', p.categorie],
    ['Mode de paiement', p.mode_paiement === 'ESPECES' ? 'Espèces' : 'Mobile money'],
    ['Agent collecteur', agent ? `${agent.identifiant} — ${agent.nom} ${agent.prenoms || ''}` : null],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');
  const s = statut(p);

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<style>
  @page { margin: 18px; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1c2433; margin: 0; font-size: 11px; }
  .recu { border: 1px solid #dfe3ea; border-radius: 6px; overflow: hidden; }
  .drapeau { display: flex; height: 6px; }
  .drapeau div { flex: 1; }
  .entete { text-align: center; padding: 12px 14px 8px; }
  .entete .rep { color: #5b6577; font-size: 10px; letter-spacing: .5px; }
  .entete .commune { color: #0f5c46; font-size: 17px; font-weight: 700; margin-top: 2px; }
  .entete .service { color: #5b6577; margin-top: 2px; }
  .titre { margin-top: 10px; font-weight: 800; letter-spacing: 2px; font-size: 12px; }
  .numero { font-family: 'Courier New', monospace; font-size: 13px; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  td { padding: 5px 14px; border-top: 1px solid #eef0f4; vertical-align: top; }
  td.cle { color: #5b6577; width: 40%; }
  td.val { text-align: right; font-weight: 600; }
  .montant { background: #e4f3ed; text-align: center; padding: 10px; }
  .montant .lib { color: #5b6577; }
  .montant .val { font-size: 22px; font-weight: 800; color: #0f5c46; margin-top: 2px; }
  .pied { display: flex; align-items: center; gap: 12px; padding: 10px 14px 12px; }
  .pied .texte { flex: 1; color: #5b6577; font-size: 9.5px; line-height: 1.45; }
  .statut { font-weight: 700; margin-bottom: 4px; }
</style></head>
<body>
  <div class="recu">
    <div class="drapeau"><div style="background:#ce1126"></div><div style="background:#fcd116"></div><div style="background:#009460"></div></div>
    <div class="entete">
      <div class="rep">RÉPUBLIQUE DE GUINÉE</div>
      <div class="commune">Commune de Lambanyi</div>
      <div class="service">${echapper(service?.nom)}</div>
      <div class="titre">REÇU DE PAIEMENT</div>
      <div class="numero">N° ${echapper(p.numero_recu)}</div>
    </div>
    <table>
      ${lignes.map(([k, v]) => `<tr><td class="cle">${echapper(k)}</td><td class="val">${echapper(v)}</td></tr>`).join('')}
    </table>
    <div class="montant">
      <div class="lib">Montant payé</div>
      <div class="val">${echapper(gnf(p.montant))}</div>
    </div>
    <div class="pied">
      ${qrSvg(contenuQr(p))}
      <div class="texte">
        <div class="statut" style="color:${s.couleur}">${echapper(s.texte)}</div>
        Ce reçu peut être vérifié par la Mairie de Lambanyi à partir de son numéro ou du QR code.
        Conservez-le comme preuve de paiement.<br/><br/>
        Document généré le ${echapper(dateHeure(new Date().toISOString()))}.
      </div>
    </div>
  </div>
</body></html>`;
}

const nomFichier = (p) => `Recu-${p.numero_recu}.pdf`;

// Génère le PDF dans le cache du téléphone, sous un nom lisible (Recu-<numéro>.pdf)
export async function genererPdf(donnees) {
  const { uri } = await Print.printToFileAsync({ html: construireHtml(donnees), width: 420, height: 595 }); // format A5
  const source = new File(uri);
  const cible = new File(Paths.cache, nomFichier(donnees.paiement));
  if (cible.exists) cible.delete();
  await source.move(cible);
  return cible;
}

// Partage : WhatsApp, e-mail, Bluetooth, Drive… (le contribuable reçoit le PDF)
export async function partagerPdf(donnees) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Le partage n\'est pas disponible sur ce téléphone.');
  const fichier = await genererPdf(donnees);
  await Sharing.shareAsync(fichier.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Reçu ${donnees.paiement.numero_recu}`,
  });
}

// Enregistrement : Android ouvre le sélecteur de dossier (ex. Téléchargements).
// Sur iOS, la feuille de partage propose « Enregistrer dans Fichiers ».
// Renvoie le nom du fichier enregistré, ou null si l'agent a annulé.
export async function enregistrerPdf(donnees) {
  if (Platform.OS !== 'android') {
    await partagerPdf(donnees);
    return null;
  }
  let dossier;
  try {
    dossier = await Directory.pickDirectoryAsync();
  } catch (e) {
    if (/cancel|annul/i.test(e?.message || '')) return null;
    throw e;
  }
  if (!dossier) return null;
  const fichier = await genererPdf(donnees);
  const destination = dossier.createFile(nomFichier(donnees.paiement), 'application/pdf');
  destination.write(await fichier.bytes());
  return destination.name || nomFichier(donnees.paiement);
}

// Impression directe (imprimante Wi-Fi ou Bluetooth reconnue par le téléphone)
export async function imprimerRecu(donnees) {
  await Print.printAsync({ html: construireHtml(donnees), width: 420, height: 595 });
}
