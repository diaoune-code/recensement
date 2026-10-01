import { useState } from 'react';
import { KeyRound, UserPlus } from 'lucide-react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Entete } from '../components/Layout.jsx';
import { Badge, Champ, Erreur, Etat, FiltrePeriode, Modal, Panneau, usePeriode, Vide } from '../components/Ui.jsx';
import { dateHeure, entier, gnf } from '../format.js';

export default function Agents() {
  const { utilisateur } = useAuth();
  const [periode, setPeriode] = usePeriode(30);
  const { donnees: agents, chargement, erreur, recharger } = useApi(`/agents?du=${periode.du}&au=${periode.au}`);
  const [edition, setEdition] = useState(null); // null | {} (nouveau) | agent
  const [motDePassePour, setMotDePassePour] = useState(null);
  const [erreurAction, setErreurAction] = useState(null);

  async function basculer(a) {
    if (a.actif && !window.confirm(`Désactiver ${a.identifiant} ? L'agent ne pourra plus se connecter ni synchroniser.`)) return;
    try {
      await api(`/agents/${a.id}`, { methode: 'PUT', corps: { actif: !a.actif } });
      recharger();
    } catch (e) { setErreurAction(e.message); }
  }

  return (
    <>
      <Entete titre="Agents de terrain" sousTitre={`Agents inscrits au service ${utilisateur?.service?.nom} : ils ne voient que les formulaires et les taxes de ce service`}>
        <div className="barre-filtres">
          <FiltrePeriode periode={periode} onChange={setPeriode} />
          <button className="btn primaire" onClick={() => setEdition({})}><UserPlus size={15} /> Inscrire un agent</button>
        </div>
      </Entete>
      <div className="contenu">
        <Erreur message={erreurAction} />
        <Panneau sansMarge>
          <Etat chargement={chargement && !agents} erreur={erreur}>
            {agents?.length ? (
              <div className="defilement">
                <table className="tableau">
                  <thead>
                    <tr><th>Identifiant</th><th>Nom</th><th>Téléphone</th><th className="num">Recensés</th><th className="num">Encaissements</th>
                      <th className="num">Montant</th><th>Dernier encaissement</th><th>Dernière connexion</th><th>Statut</th><th /></tr>
                  </thead>
                  <tbody>
                    {agents.map((a) => (
                      <tr key={a.id}>
                        <td className="mono gras">{a.identifiant}</td>
                        <td>{a.nom} {a.prenoms}</td>
                        <td>{a.telephone || '—'}</td>
                        <td className="num">{entier(a.nb_recenses)}</td>
                        <td className="num">{entier(a.nb_paiements)}</td>
                        <td className="num">{gnf(a.montant)}</td>
                        <td>{dateHeure(a.dernier_encaissement)}</td>
                        <td>{dateHeure(a.derniere_connexion)}</td>
                        <td>{a.actif ? <Badge type="succes">Actif</Badge> : <Badge type="danger">Désactivé</Badge>}</td>
                        <td>
                          <div className="ligne">
                            <button className="btn petit" onClick={() => setEdition(a)}>Modifier</button>
                            <button className="btn petit" onClick={() => setMotDePassePour(a)}><KeyRound size={13} /></button>
                            <button className={`btn petit ${a.actif ? 'danger' : ''}`} onClick={() => basculer(a)}>{a.actif ? 'Désactiver' : 'Réactiver'}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Vide>Aucun agent inscrit. Cliquez sur « Inscrire un agent ».</Vide>}
          </Etat>
        </Panneau>
      </div>
      {edition && <ModalAgent agent={edition} sigle={utilisateur?.service?.sigle} onFermer={() => setEdition(null)} onEnregistre={() => { setEdition(null); recharger(); }} />}
      {motDePassePour && <ModalMotDePasse agent={motDePassePour} onFermer={() => setMotDePassePour(null)} />}
    </>
  );
}

function ModalAgent({ agent, sigle, onFermer, onEnregistre }) {
  const nouveau = !agent.id;
  const [f, setF] = useState({ identifiant: '', nom: agent.nom || '', prenoms: agent.prenoms || '', telephone: agent.telephone || '', mot_de_passe: '' });
  const [erreur, setErreur] = useState(null);
  const [cree, setCree] = useState(null);
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function enregistrer() {
    setErreur(null);
    try {
      if (nouveau) setCree(await api('/agents', { methode: 'POST', corps: f }));
      else {
        await api(`/agents/${agent.id}`, { methode: 'PUT', corps: { nom: f.nom, prenoms: f.prenoms, telephone: f.telephone } });
        onEnregistre();
      }
    } catch (e) { setErreur(e.message); }
  }

  if (cree) {
    return (
      <Modal titre="Agent inscrit" onFermer={onEnregistre} pied={<button className="btn primaire" onClick={onEnregistre}>Terminer</button>}>
        <div className="alerte-boite info">
          Communiquez ces informations à l'agent. Il se connecte avec elles dans l'application mobile ; le téléphone reconnaît
          automatiquement son service et charge vos tâches.
        </div>
        <div className="fiche" style={{ marginTop: 16 }}>
          <div><div className="cle">Identifiant</div><div className="valeur mono" style={{ fontSize: 18 }}>{cree.identifiant}</div></div>
          <div><div className="cle">Mot de passe</div><div className="valeur">celui que vous venez de saisir</div></div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titre={nouveau ? 'Inscrire un agent' : `Modifier ${agent.identifiant}`} onFermer={onFermer}
      pied={<><button className="btn" onClick={onFermer}>Annuler</button><button className="btn primaire" onClick={enregistrer}>Enregistrer</button></>}>
      <Erreur message={erreur} />
      <div className="formulaire" style={{ marginTop: erreur ? 12 : 0 }}>
        <Champ libelle="Nom"><input value={f.nom} onChange={maj('nom')} /></Champ>
        <Champ libelle="Prénoms"><input value={f.prenoms} onChange={maj('prenoms')} /></Champ>
        <Champ libelle="Téléphone"><input value={f.telephone} onChange={maj('telephone')} /></Champ>
        {nouveau && (
          <>
            <Champ libelle="Identifiant (laisser vide pour générer)"><input placeholder={`${sigle}-00X`} value={f.identifiant} onChange={maj('identifiant')} /></Champ>
            <Champ libelle="Mot de passe initial (6 caractères min.)" pleine><input type="password" value={f.mot_de_passe} onChange={maj('mot_de_passe')} /></Champ>
          </>
        )}
      </div>
    </Modal>
  );
}

function ModalMotDePasse({ agent, onFermer }) {
  const [mdp, setMdp] = useState('');
  const [erreur, setErreur] = useState(null);
  const [fait, setFait] = useState(false);
  async function enregistrer() {
    try {
      await api(`/agents/${agent.id}`, { methode: 'PUT', corps: { mot_de_passe: mdp } });
      setFait(true);
    } catch (e) { setErreur(e.message); }
  }
  return (
    <Modal titre={`Mot de passe — ${agent.identifiant}`} onFermer={onFermer}
      pied={fait ? <button className="btn primaire" onClick={onFermer}>Fermer</button>
        : <><button className="btn" onClick={onFermer}>Annuler</button><button className="btn primaire" onClick={enregistrer}>Réinitialiser</button></>}>
      {fait ? <div className="alerte-boite info">Mot de passe modifié. L'agent devra se reconnecter en ligne avec le nouveau mot de passe.</div> : (
        <>
          <Erreur message={erreur} />
          <Champ libelle="Nouveau mot de passe"><input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoFocus /></Champ>
        </>
      )}
    </Modal>
  );
}
