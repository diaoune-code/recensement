import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, Receipt, UserCheck, Users } from 'lucide-react';
import { useApi } from '../api.js';
import { Entete } from '../components/Layout.jsx';
import { Badge, CarteStat, Etat, FiltrePeriode, Panneau, usePeriode, Vide } from '../components/Ui.jsx';
import { dateHeure, entier, gnf, gnfCourt, jourCourt, pourcentage } from '../format.js';

export default function TableauDeBord() {
  const [periode, setPeriode] = usePeriode(30);
  const { donnees: d, chargement, erreur } = useApi(`/tableau-de-bord?du=${periode.du}&au=${periode.au}`);
  const navigate = useNavigate();

  const actifs = d?.par_service.filter((s) => s.nb_taxes > 0 || s.montant > 0) ?? [];
  const inactifs = d?.par_service.filter((s) => s.nb_taxes === 0 && s.montant === 0) ?? [];

  return (
    <>
      <Entete titre="Tableau de bord" sousTitre="Situation consolidée de tous les services collecteurs">
        <FiltrePeriode periode={periode} onChange={setPeriode} />
      </Entete>
      <div className="contenu">
        <Etat chargement={chargement && !d} erreur={erreur}>
          {d && (
            <>
              <div className="grille-cartes">
                <CarteStat icone={Banknote} libelle="Montant collecté" valeur={gnf(d.totaux.montant)} detail={`${entier(d.totaux.nb_paiements)} encaissements`} />
                <CarteStat icone={Users} libelle="Contribuables recensés" valeur={entier(d.totaux.nb_contribuables)}
                  detail={`+${entier(d.totaux.nb_recenses)} sur la période`} couleur="#1f7a4d" />
                <CarteStat icone={UserCheck} libelle="Agents actifs" valeur={`${d.totaux.nb_agents_actifs} / ${d.totaux.nb_agents}`}
                  detail="ayant encaissé sur la période" couleur="#b26a00" />
                <CarteStat icone={Receipt} libelle="Doublons à vérifier" valeur={entier(d.totaux.nb_doublons)}
                  detail="fiches au même téléphone" couleur="#b42318" />
              </div>

              <div className="deux-colonnes">
                <Panneau titre="Évolution des encaissements" aide="Montant collecté par jour, tous services">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={d.evolution} margin={{ left: 4, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="degrade" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1d4e89" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#1d4e89" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
                      <XAxis dataKey="jour" tickFormatter={jourCourt} fontSize={11} />
                      <YAxis tickFormatter={gnfCourt} fontSize={11} width={56} />
                      <Tooltip formatter={(v) => gnf(v)} labelFormatter={jourCourt} />
                      <Area type="monotone" dataKey="montant" name="Collecté" stroke="#1d4e89" strokeWidth={2} fill="url(#degrade)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Panneau>
                <Panneau titre="Par quartier" aide="Montant collecté sur la période" sansMarge>
                  <table className="tableau">
                    <thead><tr><th>Quartier</th><th className="num">Contrib.</th><th className="num">Collecté</th></tr></thead>
                    <tbody>
                      {d.par_quartier.map((q) => (
                        <tr key={q.quartier}>
                          <td>{q.quartier}</td>
                          <td className="num">{entier(q.nb_contribuables)}</td>
                          <td className="num">{gnfCourt(q.montant)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panneau>
              </div>

              <Panneau titre="Comparaison des services" aide="Repérer les services qui décrochent : un service sans encaissement sur la période est signalé">
                {actifs.length ? (
                  <ResponsiveContainer width="100%" height={Math.max(180, actifs.length * 42)}>
                    <BarChart data={actifs} layout="vertical" margin={{ left: 10, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" horizontal={false} />
                      <XAxis type="number" tickFormatter={gnfCourt} fontSize={11} />
                      <YAxis type="category" dataKey="nom" width={170} fontSize={12} />
                      <Tooltip formatter={(v) => gnf(v)} />
                      <Bar dataKey="montant" name="Collecté" fill="#1d4e89" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Vide>Aucun service n'a encore de taxe paramétrée.</Vide>}
              </Panneau>

              <Panneau titre="Détail par service" sansMarge>
                <div className="defilement">
                  <table className="tableau">
                    <thead>
                      <tr><th>Service</th><th className="num">Agents</th><th className="num">Taxes</th><th className="num">Recensés</th>
                        <th className="num">Encaissements</th><th className="num">Montant</th><th>Part</th><th>Situation</th></tr>
                    </thead>
                    <tbody>
                      {[...actifs, ...inactifs].map((s) => {
                        const part = pourcentage(s.montant, d.totaux.montant);
                        let etat = <Badge type="succes">Actif</Badge>;
                        if (!s.actif) etat = <Badge>Désactivé</Badge>;
                        else if (!s.nb_taxes) etat = <Badge>Non démarré</Badge>;
                        else if (!s.nb_agents) etat = <Badge type="alerte">Sans agent</Badge>;
                        else if (!s.montant) etat = <Badge type="danger">Aucun encaissement</Badge>;
                        return (
                          <tr key={s.id} className="cliquable" onClick={() => navigate(`/contribuables?service_id=${s.id}`)}>
                            <td><span className="gras">{s.sigle}</span> — {s.nom}</td>
                            <td className="num">{s.nb_agents}</td>
                            <td className="num">{s.nb_taxes}</td>
                            <td className="num">{entier(s.nb_recenses)}</td>
                            <td className="num">{entier(s.nb_paiements)}</td>
                            <td className="num">{gnf(s.montant)}</td>
                            <td style={{ width: 120 }}><div className="ligne"><div className="barre-progression" style={{ flex: 1 }}><div style={{ width: `${part}%` }} /></div><span className="petit">{part}%</span></div></td>
                            <td>{etat}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panneau>

              <Panneau titre="Derniers encaissements reçus" sansMarge>
                {d.derniers_paiements.length ? (
                  <table className="tableau">
                    <thead><tr><th>Reçu</th><th>Date</th><th>Service</th><th>Taxe</th><th>Contribuable</th><th className="num">Montant</th></tr></thead>
                    <tbody>
                      {d.derniers_paiements.map((p) => (
                        <tr key={p.numero_recu}>
                          <td className="mono">{p.numero_recu}</td><td>{dateHeure(p.date_paiement)}</td>
                          <td><Badge type="info">{p.sigle}</Badge></td><td>{p.tache}</td><td>{p.contribuable}</td>
                          <td className="num">{gnf(p.montant)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <Vide />}
              </Panneau>
            </>
          )}
        </Etat>
      </div>
    </>
  );
}
