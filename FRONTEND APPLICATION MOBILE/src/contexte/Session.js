// Session de l'agent, partagée par tous les écrans (la logique de connexion est dans metier/connexion.js)
import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react';
import { lireMeta } from '../db/base';
import { connecterAgent, deconnecterAgent } from '../metier/connexion';

const Contexte = createContext(null);

export function FournisseurSession({ children }) {
  const [pret, setPret] = useState(false);
  const [session, setSession] = useState(null); // { agent, jeton, active, base_id }
  const [config, setConfig] = useState(null);   // { service, taches, quartiers }

  const rechargerConfig = useCallback(async () => setConfig(await lireMeta('config')), []);

  useEffect(() => {
    (async () => {
      const s = await lireMeta('session');
      if (s?.active) setSession(s);
      await rechargerConfig();
      setPret(true);
    })();
  }, [rechargerConfig]);

  async function connecter(identifiant, motDePasse) {
    const { session: s, horsLigne } = await connecterAgent(identifiant, motDePasse);
    await rechargerConfig();
    setSession(s);
    return { horsLigne };
  }

  async function deconnecter() {
    await deconnecterAgent();
    setSession(null);
  }

  return createElement(Contexte.Provider, {
    value: { pret, session, agent: session?.agent, jeton: session?.jeton, config, rechargerConfig, connecter, deconnecter },
  }, children);
}

export const useSession = () => useContext(Contexte);
