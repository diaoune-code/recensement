import { useState } from 'react';
import { api, useApi } from '../api.js';
import { Entete } from '../components/Layout.jsx';
import { Badge, Erreur, Etat, FiltrePeriode, Panneau, usePeriode, Vide } from '../components/Ui.jsx';
import { dateHeure, gnf, MODES_PAIEMENT } from '../format.js';

export default function Encaissements() {
  const [periode, setPeriode] = usePeriode(7);
  const [agentId, setAgentId] = useState('');
  const { donnees: agents } = useApi('/agents');
  const { donnees: paiements, chargement, erreur, recharger } = useApi(
    `/paiements?du=${periode.du}&au=${periode.au}${agentId ? `&agent_id=${agentId}` : ''}`);
  const [erreurAction, setErreurAction] = useState(null);

  async function annuler(p) {
    const motif = window.prompt(`Annuler le reçu ${p.numero_recu} (${gnf(p.montant)}) ?\nIndiquez le motif :`);
    if (!motif) return;
    try {
      await api(`/paiements/${p.id}/annuler`, { methode: 'PATCH', corps: { motif } });
      recharger();
    } catch (e) { setErreurAction(e.message); }
  }

  const valides = paiements?.filter((p) => p.statut === 'VALIDE') ?? [];
  const total = valides.reduce((a, p) => a + p.montant, 0);

  return (
    <>
      <Entete titre="Encaissements" sousTitre="Paiements reçus des téléphones des agents (date de terrain et date de réception au serveur)">
        <div className="barre-filtres">
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">Tous les agents</option>
            {agents?.map((a) => <option key={a.id} value={a.id}>{a.identifiant} — {a.nom}</option>)}
          </select>
          <FiltrePeriode periode={periode} onChange={setPeriode} />
        </div>
      </Entete>
      <div className="contenu">
        <Erreur message={erreurAction} />
        <Panneau sansMarge titre={`${valides.length} encaissement(s) — ${gnf(total)}`} aide="Un encaissement peut être annulé tant que la caisse du jour n'est pas clôturée">
          <Etat chargement={chargement && !paiements} erreur={erreur}>
            {paiements?.length ? (
              <div className="defilement">
                <table className="tableau">
                  <thead>
                    <tr><th>Reçu</th><th>Encaissé le</th><th>Reçu au serveur</th><th>Agent</th><th>Contribuable</th><th>Tâche</th><th>Période</th><th>Mode</th><th className="num">Montant</th><th>Statut</th><th /></tr>
                  </thead>
                  <tbody>
                    {paiements.map((p) => (
                      <tr key={p.id}>
                        <td className="mono">{p.numero_recu}</td>
                        <td>{dateHeure(p.date_paiement)}</td>
                        <td className="petit texte-doux">{dateHeure(p.recu_le)}</td>
                        <td>{p.agent}</td>
                        <td>{p.contribuable}<div className="petit texte-doux">{p.contribuable_numero}</div></td>
                        <td>{p.tache}{p.categorie && <div className="petit texte-doux">{p.categorie}</div>}{p.base_valeur && <div className="petit texte-doux">base : {p.base_valeur}</div>}</td>
                        <td>{p.periode}</td>
                        <td>{MODES_PAIEMENT[p.mode_paiement] || p.mode_paiement}</td>
                        <td className="num">{gnf(p.montant)}</td>
                        <td>{p.statut === 'ANNULE' ? <Badge type="danger">Annulé</Badge> : p.cloture_id ? <Badge type="succes">Clôturé</Badge> : <Badge type="alerte">À clôturer</Badge>}</td>
                        <td>{p.statut === 'VALIDE' && !p.cloture_id && <button className="btn petit danger" onClick={() => annuler(p)}>Annuler</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Vide>Aucun encaissement sur la période.</Vide>}
          </Etat>
        </Panneau>
      </div>
    </>
  );
}
