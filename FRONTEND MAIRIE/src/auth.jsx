import { createContext, useContext, useState } from 'react';
import { api, ecrireSession, lireSession } from './api.js';

const ContexteAuth = createContext(null);

export function FournisseurAuth({ children }) {
  const [session, setSession] = useState(lireSession);

  async function connecter(identifiant, motDePasse) {
    const s = await api('/auth/login', { methode: 'POST', corps: { identifiant, mot_de_passe: motDePasse } });
    ecrireSession(s);
    setSession(s);
  }

  function deconnecter() {
    ecrireSession(null);
    setSession(null);
  }

  return (
    <ContexteAuth.Provider value={{ session, utilisateur: session?.utilisateur, connecter, deconnecter }}>
      {children}
    </ContexteAuth.Provider>
  );
}

export const useAuth = () => useContext(ContexteAuth);
