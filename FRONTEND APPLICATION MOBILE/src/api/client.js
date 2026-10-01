// Client HTTP vers le BACKEND APPLICATION MOBILE (port 4001)
import Constants from 'expo-constants';
import { ecrireMeta, lireMeta } from '../db/base';

export class ErreurReseau extends Error {}
export class ErreurSession extends Error {}

// Adresse par défaut : l'ordinateur qui sert l'application en développement (même machine que les backends)
function serveurParDefaut() {
  const hote = Constants.expoConfig?.hostUri?.split(':')[0];
  return hote ? `http://${hote}:4001` : 'http://192.168.1.10:4001';
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
    await appel('/sante', { delai: 5000, serveur });
    return true;
  } catch {
    return false;
  }
}
