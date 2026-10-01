// Connexion d'un agent sur le téléphone (logique sans interface, utilisée par le contexte Session).
// La première connexion se fait en ligne ; ensuite l'agent peut se reconnecter sans réseau
// (mot de passe vérifié contre une empreinte salée gardée sur le téléphone).
import * as Crypto from 'expo-crypto';
import { appel, ErreurReseau } from '../api/client';
import { ecrireMeta, lireMeta, viderDonnees } from '../db/base';
import { etatFile } from '../db/depots';

const empreinte = (sel, motDePasse) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${sel}:${motDePasse}`);

// Renvoie la nouvelle session ({ agent, jeton, active, sel, empreinte, base_id }) et si elle est hors ligne
export async function connecterAgent(identifiant, motDePasse) {
  const ident = identifiant.trim().toUpperCase();
  const precedente = await lireMeta('session');
  let r;
  try {
    // Délai long : un serveur gratuit en veille met environ une minute à se réveiller
    r = await appel('/auth/login', { methode: 'POST', corps: { identifiant: ident, mot_de_passe: motDePasse }, delai: 90000 });
  } catch (e) {
    if (!(e instanceof ErreurReseau)) throw e;
    // Pas de réseau : connexion hors ligne si cet agent s'est déjà connecté sur ce téléphone
    if (!precedente || precedente.agent.identifiant.toUpperCase() !== ident) {
      throw new Error('Pas de connexion au serveur. La première connexion sur ce téléphone doit se faire avec du réseau.');
    }
    if ((await empreinte(precedente.sel, motDePasse)) !== precedente.empreinte) throw new Error('Mot de passe incorrect');
    const reprise = { ...precedente, active: true };
    await ecrireMeta('session', reprise);
    return { session: reprise, horsLigne: true };
  }

  // Base du serveur réinitialisée : les données locales appartiennent à une base qui n'existe plus.
  // On compare avec la base sur laquelle la session précédente a été ouverte (absente = ancienne version
  // de l'application, donc base inconnue) : une synchro faite entre-temps ne doit pas masquer le changement.
  const baseChangee = !!precedente && !!r.base_id && precedente.base_id !== r.base_id;
  const agentChange = !!precedente && precedente.agent.id !== r.agent.id;

  if (baseChangee || agentChange) {
    if (!baseChangee) {
      // Un autre agent utilisait ce téléphone : ses saisies non envoyées ne doivent pas lui être retirées
      const file = await etatFile();
      if (file.total > 0) {
        throw new Error(`${file.total} saisie(s) de l'agent ${precedente.agent.identifiant} ne sont pas encore envoyées. `
          + 'Il doit se reconnecter et synchroniser avant de changer d\'agent.');
      }
    }
    await viderDonnees();
  }
  if (r.base_id) await ecrireMeta('base_id', r.base_id);

  const sel = Crypto.randomUUID();
  const session = {
    agent: r.agent, jeton: r.jeton, active: true, sel, empreinte: await empreinte(sel, motDePasse), base_id: r.base_id,
  };
  await ecrireMeta('session', session);
  if (!precedente || agentChange || baseChangee) await ecrireMeta('config', null);
  return { session, horsLigne: false };
}

// Les saisies non envoyées restent sur le téléphone et partiront à la prochaine connexion
export async function deconnecterAgent() {
  const s = await lireMeta('session');
  if (s) await ecrireMeta('session', { ...s, active: false });
}
