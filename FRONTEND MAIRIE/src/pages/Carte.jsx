import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from 'react-leaflet';
import { useApi } from '../api.js';
import { Entete } from '../components/Layout.jsx';
import { Badge, Etat, Panneau } from '../components/Ui.jsx';
import { entier, gnf } from '../format.js';

const PALETTE = ['#1d4e89', '#1f7a4d', '#c8102e', '#b26a00', '#6b3fa0', '#0e7490', '#9d174d', '#4d7c0f', '#a16207', '#334155'];
const CENTRE_LAMBANYI = [9.645, -13.612];

export default function Carte() {
  const [serviceId, setServiceId] = useState('');
  const { donnees: services } = useApi('/services');
  const { donnees: d, chargement, erreur } = useApi(`/carte${serviceId ? `?service_id=${serviceId}` : ''}`);

  const couleurs = useMemo(() => {
    const m = {};
    services?.forEach((s, i) => { m[s.sigle] = PALETTE[i % PALETTE.length]; });
    return m;
  }, [services]);
  const presents = [...new Set(d?.points.map((p) => p.sigle) ?? [])];
  const maxQuartier = Math.max(1, ...(d?.quartiers.map((q) => q.nb_contribuables) ?? [1]));

  return (
    <>
      <Entete titre="Carte des contribuables" sousTitre="Contribuables géolocalisés par quartier : voir les zones peu couvertes">
        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">Tous les services</option>
          {services?.map((s) => <option key={s.id} value={s.id}>{s.sigle} — {s.nom}</option>)}
        </select>
      </Entete>
      <div className="contenu">
        <Etat chargement={chargement && !d} erreur={erreur}>
          {d && (
            <div className="deux-colonnes" style={{ gridTemplateColumns: '3fr 1fr' }}>
              <Panneau titre={`${entier(d.points.length)} contribuables géolocalisés`}
                actions={<div className="legende">{presents.map((s) => <span key={s}><i style={{ background: couleurs[s] }} />{s}</span>)}</div>} sansMarge>
                <MapContainer center={CENTRE_LAMBANYI} zoom={14} className="carte-leaflet" scrollWheelZoom>
                  <TileLayer attribution='&copy; contributeurs <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {d.quartiers.filter((q) => q.lat).map((q) => (
                    <CircleMarker key={q.nom} center={[q.lat, q.lon]} radius={18} pathOptions={{ color: '#5b6577', weight: 1, dashArray: '4', fillOpacity: 0.04 }}>
                      <Tooltip direction="top">{q.nom} — {q.nb_contribuables} contribuable(s)</Tooltip>
                    </CircleMarker>
                  ))}
                  {d.points.map((p) => (
                    <CircleMarker key={p.id} center={[p.lat, p.lon]} radius={6}
                      pathOptions={{ color: '#fff', weight: 1.5, fillColor: couleurs[p.sigle] || '#1d4e89', fillOpacity: 0.9 }}>
                      <Popup>
                        <div className="gras">{p.nom} {p.prenoms}</div>
                        <div>{p.numero} · {p.quartier}</div>
                        <div>{p.activite_principale}</div>
                        <div>Total payé : {gnf(p.total_paye)}</div>
                        <Link to={`/contribuables/${p.id}`}>Ouvrir la fiche</Link>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </Panneau>
              <Panneau titre="Couverture par quartier" sansMarge>
                <table className="tableau">
                  <thead><tr><th>Quartier</th><th className="num">Recensés</th></tr></thead>
                  <tbody>
                    {d.quartiers.map((q) => (
                      <tr key={q.nom}>
                        <td>
                          <div>{q.nom}</div>
                          <div className="barre-progression" style={{ marginTop: 4 }}><div style={{ width: `${(q.nb_contribuables / maxQuartier) * 100}%` }} /></div>
                        </td>
                        <td className="num">{q.nb_contribuables === 0 ? <Badge type="danger">0</Badge> : q.nb_contribuables}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panneau>
            </div>
          )}
        </Etat>
      </div>
    </>
  );
}
