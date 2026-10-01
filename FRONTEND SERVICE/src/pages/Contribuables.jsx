import { useEffect, useState } from 'react';
import { useApi } from '../api.js';
import { Entete } from '../components/Layout.jsx';
import { Badge, Etat, Modal, Pagination, Panneau, Vide } from '../components/Ui.jsx';
import { date, dateHeure, gnf, nomComplet } from '../format.js';

export default function Contribuables() {
  const [saisie, setSaisie] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [ouvert, setOuvert] = useState(null);
  const { donnees: d, chargement, erreur } = useApi(`/contribuables?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`);

  useEffect(() => {
    const t = setTimeout(() => { setQ(saisie); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [saisie]);

  return (
    <>
      <Entete titre="Contribuables du service" sousTitre="Recensés par vos agents ou ayant payé une taxe du service. La fiche est commune à tous les services." />
      <div className="contenu">
        <Panneau sansMarge titre={d ? `${d.total} contribuable(s)` : 'Contribuables'}
          actions={<input type="search" placeholder="Nom, téléphone, n° LBY, n° d'étal…" value={saisie} onChange={(e) => setSaisie(e.target.value)} />}>
          <Etat chargement={chargement && !d} erreur={erreur}>
            {d && (d.elements.length ? (
              <>
                <div className="defilement">
                  <table className="tableau">
                    <thead><tr><th>N°</th><th>Contribuable</th><th>Téléphone</th><th>Quartier</th><th>Emplacement</th><th>Origine</th><th>Dernier paiement</th><th className="num">Payé au service</th></tr></thead>
                    <tbody>
                      {d.elements.map((c) => (
                        <tr key={c.id} className="cliquable" onClick={() => setOuvert(c.id)}>
                          <td className="mono">{c.numero}</td>
                          <td className="gras">{nomComplet(c)}</td>
                          <td>{c.telephone || '—'}</td>
                          <td>{c.quartier || '—'}</td>
                          <td>{c.nom_marche ? `${c.nom_marche}${c.numero_etal ? ` · ${c.numero_etal}` : ''}` : (c.activite_principale || '—')}</td>
                          <td>{c.recense_par_service ? <Badge type="info">Recensé ({c.agent})</Badge> : <Badge>Autre service</Badge>}</td>
                          <td>{date(c.dernier_paiement)}</td>
                          <td className="num">{gnf(c.total_paye)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={d.page} taille={d.taille} total={d.total} onPage={setPage} />
              </>
            ) : <Vide>Aucun contribuable.</Vide>)}
          </Etat>
        </Panneau>
      </div>
      {ouvert && <FicheContribuable id={ouvert} onFermer={() => setOuvert(null)} />}
    </>
  );
}

function FicheContribuable({ id, onFermer }) {
  const { donnees: c, chargement, erreur } = useApi(`/contribuables/${id}`);
  const lignes = c ? [
    ['N°', c.numero], ['Téléphone', c.telephone], ['Type', c.type_contribuable?.replace(/_/g, ' ')], ['Pièce', c.piece_type && `${c.piece_type} ${c.piece_numero || ''}`],
    ['Quartier', c.quartier], ['Secteur', c.secteur], ['Marché', c.nom_marche], ['N° étal', c.numero_etal], ['N° porte / concession', c.numero_porte],
    ['Activité', c.activite_principale], ['Forme du point', c.forme_point], ['Surface (m²)', c.surface_m2], ['Étals', c.nb_etals],
    ['GPS', c.latitude && `${Number(c.latitude).toFixed(5)}, ${Number(c.longitude).toFixed(5)}`],
    ['Recensé par', `${c.agent} (${c.service_sigle}) le ${date(c.created_at)}`],
  ] : [];
  return (
    <Modal large titre={c ? nomComplet(c) : 'Contribuable'} onFermer={onFermer}>
      <Etat chargement={chargement} erreur={erreur}>
        {c && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="ligne" style={{ alignItems: 'flex-start', gap: 20 }}>
              {c.photo && <img className="photo-contribuable" src={`data:image/jpeg;base64,${c.photo}`} alt="" />}
              <div className="fiche" style={{ flex: 1 }}>
                {lignes.map(([k, v]) => <div key={k}><div className="cle">{k}</div><div className="valeur">{v ?? '—'}</div></div>)}
              </div>
            </div>
            {Object.entries(c.complements || {}).map(([sigle, champs]) => (
              <div key={sigle}>
                <Badge type="info">Compléments {sigle}</Badge>
                <div className="fiche" style={{ marginTop: 8 }}>
                  {Object.entries(champs).map(([k, v]) => <div key={k}><div className="cle">{k.replace(/_/g, ' ')}</div><div className="valeur">{String(v)}</div></div>)}
                </div>
              </div>
            ))}
            <div>
              <div className="gras" style={{ marginBottom: 8 }}>Paiements au service</div>
              {c.paiements.length ? (
                <table className="tableau">
                  <thead><tr><th>Reçu</th><th>Date</th><th>Tâche</th><th>Période</th><th>Agent</th><th className="num">Montant</th></tr></thead>
                  <tbody>
                    {c.paiements.map((p) => (
                      <tr key={p.id} style={p.statut === 'ANNULE' ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>
                        <td className="mono">{p.numero_recu}</td><td>{dateHeure(p.date_paiement)}</td><td>{p.tache}</td><td>{p.periode}</td><td>{p.agent}</td><td className="num">{gnf(p.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="texte-doux">Aucun paiement à ce service.</div>}
            </div>
          </div>
        )}
      </Etat>
    </Modal>
  );
}
