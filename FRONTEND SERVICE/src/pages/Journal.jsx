import { useApi } from '../api.js';
import { Entete } from '../components/Layout.jsx';
import { Badge, Etat, Panneau, Vide } from '../components/Ui.jsx';
import { dateHeure } from '../format.js';

export default function Journal() {
  const { donnees, chargement, erreur } = useApi('/journal');
  return (
    <>
      <Entete titre="Journal des actions" sousTitre="Qui a saisi, modifié, encaissé, et quand — pour le service" />
      <div className="contenu">
        <Panneau sansMarge titre="300 dernières actions">
          <Etat chargement={chargement && !donnees} erreur={erreur}>
            {donnees?.length ? (
              <div className="defilement">
                <table className="tableau">
                  <thead><tr><th>Date</th><th>Application</th><th>Utilisateur</th><th>Action</th><th>Détails</th></tr></thead>
                  <tbody>
                    {donnees.map((j) => (
                      <tr key={j.id}>
                        <td>{dateHeure(j.created_at)}</td>
                        <td><Badge type={j.application === 'MOBILE' ? 'info' : ''}>{j.application}</Badge></td>
                        <td className="mono">{j.identifiant}</td>
                        <td className="gras petit">{j.action.replace(/_/g, ' ')}</td>
                        <td className="mono petit" style={{ maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.details ? JSON.stringify(j.details) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Vide>Aucune action enregistrée.</Vide>}
          </Etat>
        </Panneau>
      </div>
    </>
  );
}
