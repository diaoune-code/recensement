// Client HTTP vers le BACKEND APPLICATION MOBILE (port 4001)
import Constants from 'expo-constants';
import { ecrireMeta, lireMeta } from '../db/base';

export class ErreurReseau extends Error {}
export class ErreurSession extends Error {}

// API mobile en ligne (Render). Modifiable dans l'écran « Serveur » de l'application.
export const SERVEUR_EN_LIGNE = 'https://lambanyi-api-mobile.onrender.com';

// Adresse par défaut : l'API en ligne. Pour travailler avec les serveurs d'un ordinateur du réseau local,
// lancer Expo avec EXPO_PUBLIC_SERVEUR=local : l'adresse de cet ordinateur est alors utilisée (port 4001).
function serveurParDefaut() {
  if (process.env.EXPO_PUBLIC_SERVEUR === 'local') {
    const hote = Constants.expoConfig?.hostUri?.split(':')[0];
    if (hote) return `http://${hote}:4001`;
  }
  return SERVEUR_EN_LIGNE;
}

export async function lireServeur() {
  return (await lireMeta('serveur')) || serveurParDefaut();
}

export async function ecrireServeur(url) {
  await ecrireMeta('serveur', url.trim().replace(/\/+$/, ''));
}

export async function appel(chemin, { methode = 'GET', corps, jeton, delai = 20000, serveur } = {}) {
  const url = `${serveur || (await lireServeur())}/api${chemin}`;
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), delai);
  let reponse;
  try {
    reponse = await fetch(url, {
      method: methode,
      headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
      body: corps === undefined ? undefined : JSON.stringify(corps),
      signal: controle.signal,
    });
  } catch {
    throw new ErreurReseau('Serveur injoignable');
  } finally {
    clearTimeout(minuteur);
  }
  const donnees = await reponse.json().catch(() => ({}));
  if (reponse.status === 401 && jeton) throw new ErreurSession(donnees.message || 'Session expirée');
  if (!reponse.ok) {
    const e = new Error(donnees.message || `Erreur ${reponse.status}`);
    e.statut = reponse.status;
    throw e;
  }
  return donnees;
}

// Vrai si le serveur répond réellement (le Wi-Fi ou la 3G peuvent être actifs sans accès au serveur)
export async function serveurJoignable(serveur) {
  try {
    await appel('/sante', { delai: 60000, serveur }); // un serveur en veille peut mettre une minute à répondre
    return true;
  } catch {
    return false;
  }
}
