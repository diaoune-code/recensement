import { useState } from 'react';
import { api, useApi } from '../api.js';
import { Entete } from '../components/Layout.jsx';
import { Badge, Champ, Erreur, Etat, Modal, Panneau, Vide } from '../components/Ui.jsx';
import { date, dateHeure, gnf } from '../format.js';

export default function Clotures() {
  const aTraiter = useApi('/clotures/a-traiter');
  const historique = useApi('/clotures');
  const [caisse, setCaisse] = useState(null);

  const apresCloture = () => {
    setCaisse(null);
    aTraiter.recharger();
    historique.recharger();
  };

  return (
    <>
      <Entete titre="Clôtures journalières de caisse" sousTitre="Rapprochement entre les montants saisis par chaque agent et l'argent qu'il a reversé" />
      <div className="contenu">
        <Panneau titre="Caisses à clôturer" aide="Encaissements reçus et pas encore rapprochés, par agent et par jour" sansMarge>
          <Etat chargement={aTraiter.chargement && !aTraiter.donnees} erreur={aTraiter.erreur}>
            {aTraiter.donnees?.length ? (
              <table className="tableau">
                <thead><tr><th>Jour</th><th>Agent</th><th className="num">Encaissements</th><th className="num">Dont espèces</th><th className="num">Montant saisi</th><th /></tr></thead>
                <tbody>
                  {aTraiter.donnees.map((c) => (
                    <tr key={`${c.agent_id}-${c.jour}`}>
                      <td>{date(c.jour)}</td>
                      <td><span className="mono">{c.agent}</span> <span className="petit texte-doux">{c.agent_nom}</span></td>
                      <td className="num">{c.nb_paiements}</td>
                      <td className="num">{gnf(c.montant_especes)}</td>
                      <td className="num gras">{gnf(c.montant_collecte)}</td>
                      <td><button className="btn petit primaire" onClick={() => setCaisse(c)}>Clôturer</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Vide>Toutes les caisses sont clôturées.</Vide>}
          </Etat>
        </Panneau>

        <Panneau titre="Historique des clôtures" sansMarge>
          <Etat chargement={historique.chargement && !historique.donnees} erreur={historique.erreur}>
            {historique.donnees?.length ? (
              <div className="defilement">
                <table className="tableau">
                  <thead><tr><th>Jour</th><th>Agent</th><th className="num">Encaissements</th><th className="num">Saisi</th><th className="num">Reversé</th><th className="num">Écart</th><th>Statut</th><th>Validée</th><th>Commentaire</th></tr></thead>
                  <tbody>
                    {historique.donnees.map((c) => (
                      <tr key={c.id}>
                        <td>{date(c.jour)}</td><td className="mono">{c.agent}</td><td className="num">{c.nb_paiements}</td>
                        <td className="num">{gnf(c.montant_collecte)}</td><td className="num">{gnf(c.montant_reverse)}</td>
                        <td className="num" style={{ color: c.ecart < 0 ? 'var(--danger)' : undefined }}>{gnf(c.ecart)}</td>
                        <td>{c.statut === 'VALIDEE' ? <Badge type="succes">Validée</Badge> : <Badge type="danger">Écart à régulariser</Badge>}</td>
                        <td className="petit">{dateHeure(c.validee_le)} par {c.valide_par_identifiant}</td>
                        <td className="petit">{c.commentaire}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Vide>Aucune clôture.</Vide>}
          </Etat>
        </Panneau>
      </div>
      {caisse && <ModalCloture caisse={caisse} onFermer={() => setCaisse(null)} onEnregistre={apresCloture} />}
    </>
  );
}

function ModalCloture({ caisse, onFermer, onEnregistre }) {
  const [reverse, setReverse] = useState(String(caisse.montant_collecte));
  const [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState(null);
  const ecart = (Number(reverse) || 0) - caisse.montant_collecte;

  async function cloturer(statut) {
    setErreur(null);
    try {
      await api('/clotures', { methode: 'POST', corps: { agent_id: caisse.agent_id, jour: caisse.jour, montant_reverse: Number(reverse), statut, commentaire } });
      onEnregistre();
    } catch (e) { setErreur(e.message); }
  }

  return (
    <Modal titre={`Caisse de ${caisse.agent} — ${date(caisse.jour)}`} onFermer={onFermer}
      pied={(
        <>
          <button className="btn" onClick={onFermer}>Annuler</button>
          <button className="btn danger" onClick={() => cloturer('REJETEE')}>Signaler un écart</button>
          <button className="btn primaire" onClick={() => cloturer('VALIDEE')}>Valider la caisse</button>
        </>
      )}>
      <Erreur message={erreur} />
      <div className="fiche" style={{ margin: '12px 0 18px' }}>
        <div><div className="cle">Encaissements</div><div className="valeur">{caisse.nb_paiements}</div></div>
        <div><div className="cle">Montant saisi sur le téléphone</div><div className="valeur gras">{gnf(caisse.montant_collecte)}</div></div>
      </div>
      <div className="formulaire">
        <Champ libelle="Montant effectivement reversé (GNF)"><input type="number" min="0" value={reverse} onChange={(e) => setReverse(e.target.value)} /></Champ>
        <Champ libelle="Écart">
          <div className="valeur gras" style={{ padding: '8px 0', color: ecart < 0 ? 'var(--danger)' : ecart > 0 ? 'var(--alerte)' : 'var(--succes)' }}>
            {ecart === 0 ? 'Aucun écart' : gnf(ecart)}
          </div>
        </Champ>
        <Champ libelle="Commentaire (obligatoire en cas d'écart validé)" pleine>
          <textarea rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
        </Champ>
      </div>
    </Modal>
  );
}
