import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../api.js';
import { Entete } from '../components/Layout.jsx';
import { Badge, Etat, Pagination, Panneau, Vide } from '../components/Ui.jsx';
import { date, gnf, nomComplet } from '../format.js';

export default function Contribuables() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [saisie, setSaisie] = useState(params.get('q') || '');
  const { donnees: services } = useApi('/services');
  const { donnees: quartiers } = useApi('/quartiers');

  const page = Number(params.get('page') || 1);
  const requete = new URLSearchParams({ page: String(page) });
  for (const k of ['q', 'quartier', 'service_id', 'doublons']) if (params.get(k)) requete.set(k, params.get(k));
  const { donnees: d, chargement, erreur } = useApi(`/contribuables?${requete}`);

  // Recherche déclenchée après une courte pause de frappe
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') || '') !== saisie) majFiltre('q', saisie);
    }, 350);
    return () => clearTimeout(t);
  }, [saisie]); // eslint-disable-line react-hooks/exhaustive-deps

  function majFiltre(cle, valeur) {
    const p = new URLSearchParams(params);
    if (valeur) p.set(cle, valeur); else p.delete(cle);
    p.delete('page');
    setParams(p);
  }

  return (
    <>
      <Entete titre="Contribuables" sousTitre="Fiche unique de chaque contribuable, ses taxes et ses paiements, tous services confondus" />
      <div className="contenu">
        <Panneau
          sansMarge
          titre={d ? `${d.total} contribuable${d.total > 1 ? 's' : ''}` : 'Contribuables'}
          actions={(
            <div className="barre-filtres">
              <input type="search" placeholder="Nom, téléphone, n° LBY, n° d'étal…" value={saisie} onChange={(e) => setSaisie(e.target.value)} />
              <select value={params.get('quartier') || ''} onChange={(e) => majFiltre('quartier', e.target.value)}>
                <option value="">Tous les quartiers</option>
                {quartiers?.map((q) => <option key={q.id} value={q.nom}>{q.nom}</option>)}
              </select>
              <select value={params.get('service_id') || ''} onChange={(e) => majFiltre('service_id', e.target.value)}>
                <option value="">Tous les services</option>
                {services?.map((s) => <option key={s.id} value={s.id}>{s.sigle} — {s.nom}</option>)}
              </select>
              <label className="ligne petit">
                <input type="checkbox" checked={params.get('doublons') === '1'} onChange={(e) => majFiltre('doublons', e.target.checked ? '1' : '')} />
                Doublons suspects
              </label>
            </div>
          )}
        >
          <Etat chargement={chargement && !d} erreur={erreur}>
            {d && (d.elements.length ? (
              <>
                <div className="defilement">
                  <table className="tableau">
                    <thead>
                      <tr><th>N°</th><th>Contribuable</th><th>Téléphone</th><th>Quartier</th><th>Activité / emplacement</th>
                        <th>Recensé par</th><th>Le</th><th className="num">Total payé</th></tr>
                    </thead>
                    <tbody>
                      {d.elements.map((c) => (
                        <tr key={c.id} className="cliquable" onClick={() => navigate(`/contribuables/${c.id}`)}>
                          <td className="mono">{c.numero}</td>
                          <td>
                            <div className="gras">{nomComplet(c)}</div>
                            {c.raison_sociale && <div className="petit texte-doux">{c.raison_sociale}</div>}
                            {c.doublon_suspect_de && <Badge type="danger">Doublon suspect</Badge>}
                          </td>
                          <td>{c.telephone || '—'}</td>
                          <td>{c.quartier || '—'}</td>
                          <td>
                            <div>{c.activite_principale || '—'}</div>
                            {c.nom_marche && <div className="petit texte-doux">{c.nom_marche} {c.numero_etal && `· étal ${c.numero_etal}`}</div>}
                          </td>
                          <td><Badge type="info">{c.service_sigle}</Badge> <span className="petit texte-doux">{c.agent}</span></td>
                          <td>{date(c.created_at)}</td>
                          <td className="num">{gnf(c.total_paye)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={d.page} taille={d.taille} total={d.total}
                  onPage={(p) => { const n = new URLSearchParams(params); n.set('page', p); setParams(n); }} />
              </>
            ) : <Vide>Aucun contribuable ne correspond à la recherche.</Vide>)}
          </Etat>
        </Panneau>
      </div>
    </>
  );
}
