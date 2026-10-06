import { useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { api, useApi } from '../api.js';
import { Entete } from '../components/Layout.jsx';
import { Badge, Champ, Erreur, Etat, Modal, Panneau } from '../components/Ui.jsx';

export default function Services() {
  const { donnees: services, chargement, erreur, recharger } = useApi('/services');
  const [creation, setCreation] = useState(false);
  const [responsablePour, setResponsablePour] = useState(null);
  const [erreurAction, setErreurAction] = useState(null);

  async function basculerService(s) {
    if (s.actif && !window.confirm(`Désactiver le service ${s.nom} ? Ses agents ne pourront plus se connecter.`)) return;
    try {
      await api(`/services/${s.id}`, { methode: 'PUT', corps: { actif: !s.actif } });
      recharger();
    } catch (e) { setErreurAction(e.message); }
  }

  async function basculerResponsable(r) {
    try {
      await api(`/responsables/${r.id}`, { methode: 'PATCH', corps: { actif: !r.actif } });
      recharger();
    } catch (e) { setErreurAction(e.message); }
  }

  async function reinitialiser(r) {
    const mdp = window.prompt(`Nouveau mot de passe pour ${r.identifiant} (6 caractères minimum) :`);
    if (!mdp) return;
    try {
      await api(`/responsables/${r.id}`, { methode: 'PATCH', corps: { mot_de_passe: mdp } });
      window.alert('Mot de passe modifié.');
    } catch (e) { setErreurAction(e.message); }
  }

  return (
    <>
      <Entete titre="Services collecteurs" sousTitre="La Mairie garde la main sur la liste des services et nomme leurs responsables ; chaque service inscrit ensuite ses propres agents">
        <button className="btn primaire" onClick={() => setCreation(true)}><Plus size={15} /> Nouveau service</button>
      </Entete>
      <div className="contenu">
        <Erreur message={erreurAction} />
        <Panneau sansMarge>
          <Etat chargement={chargement && !services} erreur={erreur}>
            <div className="defilement">
              <table className="tableau">
                <thead>
                  <tr><th>Code</th><th>Service</th><th className="num">Lignes</th><th className="num">Taxes</th><th className="num">Agents</th><th>Responsables (accès application Service)</th><th>Statut</th><th /></tr>
                </thead>
                <tbody>
                  {services?.map((s) => (
                    <tr key={s.id}>
                      <td className="mono">{s.code}</td>
                      <td><span className="gras">{s.sigle}</span> — {s.nom}</td>
                      <td className="num">{s.nb_lignes}</td>
                      <td className="num">{s.nb_taxes}</td>
                      <td className="num">{s.nb_agents}</td>
                      <td>
                        {(s.responsables || []).map((r) => (
                          <div key={r.id} className="ligne petit" style={{ marginBottom: 4 }}>
                            <span className="mono">{r.identifiant}</span>
                            <span>{r.nom} {r.prenoms}</span>
                            {!r.actif && <Badge type="danger">désactivé</Badge>}
                            <button className="btn petit" onClick={() => basculerResponsable(r)}>{r.actif ? 'Désactiver' : 'Réactiver'}</button>
                            <button className="btn petit" onClick={() => reinitialiser(r)}>Mot de passe</button>
                          </div>
                        ))}
                        <button className="btn petit" onClick={() => setResponsablePour(s)}><UserPlus size={13} /> Ajouter</button>
                      </td>
                      <td>{s.actif ? <Badge type="succes">Actif</Badge> : <Badge>Désactivé</Badge>}</td>
                      <td><button className={`btn petit ${s.actif ? 'danger' : ''}`} onClick={() => basculerService(s)}>{s.actif ? 'Désactiver' : 'Activer'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Etat>
        </Panneau>
      </div>
      {creation && <ModalService onFermer={() => setCreation(false)} onEnregistre={() => { setCreation(false); recharger(); }} />}
      {responsablePour && <ModalResponsable service={responsablePour} onFermer={() => setResponsablePour(null)} onEnregistre={() => { setResponsablePour(null); recharger(); }} />}
    </>
  );
}

function ModalService({ onFermer, onEnregistre }) {
  const [f, setF] = useState({ code: '', sigle: '', nom: '' });
  const [erreur, setErreur] = useState(null);
  async function enregistrer() {
    try {
      await api('/services', { methode: 'POST', corps: { ...f, code: Number(f.code) } });
      onEnregistre();
    } catch (e) { setErreur(e.message); }
  }
  return (
    <Modal titre="Nouveau service" onFermer={onFermer}
      pied={<><button className="btn" onClick={onFermer}>Annuler</button><button className="btn primaire" onClick={enregistrer}>Créer</button></>}>
      <Erreur message={erreur} />
      <div className="formulaire" style={{ marginTop: erreur ? 12 : 0 }}>
        <Champ libelle="Code (numéro du service)"><input type="number" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Champ>
        <Champ libelle="Sigle (préfixe des agents et reçus)"><input value={f.sigle} maxLength={10} onChange={(e) => setF({ ...f, sigle: e.target.value.toUpperCase() })} /></Champ>
        <Champ libelle="Nom du service" pleine><input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Champ>
      </div>
    </Modal>
  );
}

function ModalResponsable({ service, onFermer, onEnregistre }) {
  const [f, setF] = useState({ identifiant: `chef.${service.sigle.toLowerCase()}`, nom: '', prenoms: '', telephone: '', fonction: `Chef du service ${service.nom}`, mot_de_passe: '' });
  const [erreur, setErreur] = useState(null);
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function enregistrer() {
    try {
      await api(`/services/${service.id}/responsables`, { methode: 'POST', corps: f });
      onEnregistre();
    } catch (e) { setErreur(e.message); }
  }
  return (
    <Modal titre={`Responsable — ${service.nom}`} onFermer={onFermer}
      pied={<><button className="btn" onClick={onFermer}>Annuler</button><button className="btn primaire" onClick={enregistrer}>Créer le compte</button></>}>
      <div className="alerte-boite info" style={{ marginBottom: 14 }}>
        Ce compte donne accès à l'application web Service : inscription des agents, paramétrage des taxes et clôtures de caisse.
      </div>
      <Erreur message={erreur} />
      <div className="formulaire" style={{ marginTop: 12 }}>
        <Champ libelle="Identifiant de connexion"><input value={f.identifiant} onChange={maj('identifiant')} /></Champ>
        <Champ libelle="Mot de passe initial"><input type="password" value={f.mot_de_passe} onChange={maj('mot_de_passe')} /></Champ>
        <Champ libelle="Nom"><input value={f.nom} onChange={maj('nom')} /></Champ>
        <Champ libelle="Prénoms"><input value={f.prenoms} onChange={maj('prenoms')} /></Champ>
        <Champ libelle="Téléphone"><input value={f.telephone} onChange={maj('telephone')} /></Champ>
        <Champ libelle="Fonction"><input value={f.fonction} onChange={maj('fonction')} /></Champ>
      </div>
    </Modal>
  );
}
