// Déclenche la synchronisation automatiquement :
//  - dès que le téléphone retrouve le réseau (NetInfo)
//  - juste après chaque saisie (recensement, encaissement)
//  - quand l'application revient au premier plan
//  - toutes les 30 s s'il reste des éléments à envoyer, sinon toutes les 5 min pour recevoir les nouveautés
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { ErreurReseau, ErreurSession } from '../api/client';
import { lireMeta } from '../db/base';
import { etatFile } from '../db/depots';
import { synchroniser } from '../sync/synchro';
import { useSession } from './Session';

const Contexte = createContext(null);

export function FournisseurSynchro({ children }) {
  const { session, jeton, rechargerConfig } = useSession();
  const [etat, setEtat] = useState({
    reseau: true, serveurJoignable: null, enCours: false, file: { contribuables: 0, paiements: 0, erreurs: 0, total: 0 },
    dernierRapport: null, derniereErreur: null, sessionExpiree: false,
  });
  const verrou = useRef(false);
  const derniereTentative = useRef(0);

  const rafraichirFile = useCallback(async () => {
    const file = await etatFile();
    setEtat((e) => ({ ...e, file }));
    return file;
  }, []);

  const lancer = useCallback(async () => {
    if (!jeton || verrou.current) return;
    verrou.current = true;
    derniereTentative.current = Date.now();
    setEtat((e) => ({ ...e, enCours: true }));
    try {
      const rapport = await synchroniser(jeton);
      await rechargerConfig();
      setEtat((e) => ({ ...e, serveurJoignable: true, dernierRapport: rapport, derniereErreur: null, sessionExpiree: false }));
    } catch (err) {
      if (err instanceof ErreurReseau) setEtat((e) => ({ ...e, serveurJoignable: false, derniereErreur: 'Serveur injoignable : les saisies restent sur le téléphone' }));
      else if (err instanceof ErreurSession) setEtat((e) => ({ ...e, serveurJoignable: true, sessionExpiree: true, derniereErreur: 'Session expirée : reconnectez-vous pour reprendre l\'envoi' }));
      else setEtat((e) => ({ ...e, derniereErreur: err.message }));
    } finally {
      verrou.current = false;
      await rafraichirFile();
      setEtat((e) => ({ ...e, enCours: false }));
    }
  }, [jeton, rechargerConfig, rafraichirFile]);

  // Après une saisie locale : on met à jour le compteur et on tente l'envoi immédiatement
  const signalerSaisie = useCallback(async () => {
    await rafraichirFile();
    lancer();
  }, [rafraichirFile, lancer]);

  useEffect(() => {
    lireMeta('derniere_synchro').then((r) => r && setEtat((e) => ({ ...e, dernierRapport: r })));
    rafraichirFile();
  }, [rafraichirFile]);

  const reseauPrecedent = useRef(true);

  useEffect(() => {
    if (!session) return undefined;
    lancer();

    const desabonnerReseau = NetInfo.addEventListener((s) => {
      const connecte = !!s.isConnected && s.isInternetReachable !== false;
      if (connecte && !reseauPrecedent.current) setTimeout(lancer, 1500); // retour du réseau : envoi automatique
      reseauPrecedent.current = connecte;
      setEtat((e) => ({ ...e, reseau: connecte }));
    });
    const abonnementApp = AppState.addEventListener('change', (a) => { if (a === 'active') lancer(); });
    const minuteur = setInterval(async () => {
      const file = await rafraichirFile();
      const ecoule = Date.now() - derniereTentative.current;
      if ((file.total > 0 && ecoule > 30000) || ecoule > 300000) lancer();
    }, 15000);

    return () => { desabonnerReseau(); abonnementApp.remove(); clearInterval(minuteur); };
  }, [session, lancer, rafraichirFile]);

  return createElement(Contexte.Provider, { value: { ...etat, lancer, signalerSaisie, rafraichirFile } }, children);
}

export const useSynchro = () => useContext(Contexte);
