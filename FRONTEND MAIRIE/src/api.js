import { useCallback, useEffect, useState } from 'react';

const CLE_SESSION = 'lambanyi_mairie_session';

export function lireSession() {
  try {
    return JSON.parse(localStorage.getItem(CLE_SESSION));
  } catch {
    return null;
  }
}

export function ecrireSession(session) {
  if (session) localStorage.setItem(CLE_SESSION, JSON.stringify(session));
  else localStorage.removeItem(CLE_SESSION);
}

// Appel à l'API Mairie (relayée par Vite vers le port 4002)
export async function api(chemin, { methode = 'GET', corps } = {}) {
  const session = lireSession();
  const reponse = await fetch(`/api${chemin}`, {
    method: methode,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.jeton ? { Authorization: `Bearer ${session.jeton}` } : {}),
    },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  const donnees = await reponse.json().catch(() => ({}));
  if (reponse.status === 401 && session) {
    ecrireSession(null);
    window.location.assign('/connexion');
  }
  if (!reponse.ok) throw new Error(donnees.message || `Erreur ${reponse.status}`);
  return donnees;
}

// Charge une ressource et la recharge quand `chemin` change
export function useApi(chemin) {
  const [etat, setEtat] = useState({ donnees: null, chargement: true, erreur: null });
  const charger = useCallback(async () => {
    if (!chemin) return;
    setEtat((e) => ({ ...e, chargement: true, erreur: null }));
    try {
      const donnees = await api(chemin);
      setEtat({ donnees, chargement: false, erreur: null });
    } catch (erreur) {
      setEtat({ donnees: null, chargement: false, erreur: erreur.message });
    }
  }, [chemin]);
  useEffect(() => { charger(); }, [charger]);
  return { ...etat, recharger: charger };
}
