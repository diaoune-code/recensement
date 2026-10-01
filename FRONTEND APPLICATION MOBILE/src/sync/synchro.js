// Synchronisation entre la base SQLite du téléphone et la base PostgreSQL de la commune.
//
//  1. ENVOI    : contribuables puis paiements marqués EN_ATTENTE, par petits lots.
//                Les identifiants sont générés sur le téléphone : renvoyer un lot déjà reçu
//                (coupure pendant l'envoi) ne crée aucun doublon côté serveur.
//  2. RÉCEPTION: ce qui a changé sur le serveur depuis la dernière synchro
//                (fiches des autres agents et services, paiements du service, tâches et tarifs).
import { appel, ErreurReseau } from '../api/client';
import { ecrireMeta, lireMeta, viderCopieLocale, CHAMPS_CONTRIBUABLE } from '../db/base';
import {
  contribuablesAEnvoyer, fusionnerContribuables, fusionnerPaiements, marquerContribuable, marquerPaiement, paiementsAEnvoyer,
} from '../db/depots';

const LOT_CONTRIBUABLES = 10; // petits lots : ils peuvent contenir des photos
const LOT_PAIEMENTS = 100;

const STATUTS_ACCEPTES_C = ['OK', 'DEJA_A_JOUR', 'DOUBLON_SUSPECT'];
const STATUTS_ACCEPTES_P = ['OK', 'DEJA_RECU'];

function versServeur(c) {
  const donnees = { id: c.id, complements: c.complements, created_at: c.created_at, updated_at: c.updated_at };
  for (const k of CHAMPS_CONTRIBUABLE) donnees[k] = c[k];
  if (c.photo_a_envoyer && c.photo) donnees.photo_base64 = c.photo;
  return donnees;
}

async function envoyer(jeton, rapport) {
  // Contribuables d'abord : les paiements y font référence
  for (;;) {
    const lot = await contribuablesAEnvoyer(LOT_CONTRIBUABLES);
    if (!lot.length) break;
    const res = await appel('/sync/envoi', { methode: 'POST', jeton, corps: { contribuables: lot.map(versServeur) }, delai: 60000 });
    let progres = false;
    for (const r of res.contribuables) {
      const local = lot.find((c) => c.id === r.id);
      if (STATUTS_ACCEPTES_C.includes(r.statut)) {
        await marquerContribuable(r.id, { etat: 'SYNCHRONISE', numero: r.numero, photoEnvoyee: !!local?.photo_a_envoyer });
        rapport.contribuablesEnvoyes++;
        if (r.statut === 'DOUBLON_SUSPECT') rapport.doublons++;
        progres = true;
      } else {
        await marquerContribuable(r.id, { etat: 'ERREUR', erreur: r.message });
        rapport.erreurs.push(`Fiche ${local?.nom || r.id} : ${r.message}`);
        progres = true;
      }
    }
    if (!progres) break;
  }

  for (;;) {
    const lot = await paiementsAEnvoyer(LOT_PAIEMENTS);
    if (!lot.length) break;
    const res = await appel('/sync/envoi', { methode: 'POST', jeton, corps: { paiements: lot }, delai: 60000 });
    let enAttente = 0;
    for (const r of res.paiements) {
      if (STATUTS_ACCEPTES_P.includes(r.statut)) {
        await marquerPaiement(r.id, { etat: 'SYNCHRONISE' });
        rapport.paiementsEnvoyes++;
      } else if (r.statut === 'EN_ATTENTE') {
        enAttente++; // le contribuable n'est pas encore accepté : on réessaiera
      } else {
        await marquerPaiement(r.id, { etat: 'ERREUR', erreur: r.message });
        rapport.erreurs.push(`Reçu ${lot.find((p) => p.id === r.id)?.numero_recu} : ${r.message}`);
      }
    }
    if (enAttente === lot.length) break;
  }
}

async function recevoir(jeton, rapport) {
  const depuis = await lireMeta('dernier_pull');
  const res = await appel(`/sync/reception${depuis ? `?depuis=${encodeURIComponent(depuis)}` : ''}`, { jeton, delai: 60000 });
  await fusionnerContribuables(res.contribuables);
  await fusionnerPaiements(res.paiements);
  await ecrireMeta('config', res.config);
  await ecrireMeta('dernier_pull', res.horodatage);
  rapport.contribuablesRecus = res.contribuables.length;
  rapport.paiementsRecus = res.paiements.length;
}

// Lance un cycle complet. Lève ErreurReseau si le serveur est injoignable, ErreurSession si le jeton est refusé.
export async function synchroniser(jeton) {
  let sante;
  try {
    sante = await appel('/sante', { delai: 5000 });
  } catch {
    throw new ErreurReseau('Serveur injoignable');
  }
  // Base du serveur réinitialisée depuis la dernière synchro : on repart d'une copie locale vide.
  // Sans base_id enregistré mais avec des données déjà reçues, leur origine est inconnue : on vide aussi.
  const baseLocale = await lireMeta('base_id');
  const dejaRecu = await lireMeta('dernier_pull');
  if (sante.base_id && sante.base_id !== baseLocale && (baseLocale || dejaRecu)) await viderCopieLocale();
  if (sante.base_id) await ecrireMeta('base_id', sante.base_id);

  const rapport = {
    debut: new Date().toISOString(), contribuablesEnvoyes: 0, paiementsEnvoyes: 0, doublons: 0,
    contribuablesRecus: 0, paiementsRecus: 0, erreurs: [],
  };
  await envoyer(jeton, rapport);
  await recevoir(jeton, rapport);
  rapport.fin = new Date().toISOString();
  await ecrireMeta('derniere_synchro', rapport);
  return rapport;
}
