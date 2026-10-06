import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, UserCheck, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Entete } from '../components/Layout.jsx';
import { CarteStat, Etat, FiltrePeriode, Panneau, usePeriode, Vide } from '../components/Ui.jsx';
import { entier, gnf, gnfCourt, jourCourt, pourcentage } from '../format.js';

export default function TableauDeBord() {
  const { utilisateur } = useAuth();
  const [periode, setPeriode] = usePeriode(30);
  const { donnees: d, chargement, erreur } = useApi(`/tableau-de-bord?du=${periode.du}&au=${periode.au}`);

  return (
    <>
      <Entete titre="Tableau de bord" sousTitre={`Activité du service ${utilisateur?.service?.nom}`}>
        <FiltrePeriode periode={periode} onChange={setPeriode} />
      </Entete>
      <div className="contenu">
        <Etat chargement={chargement && !d} erreur={erreur}>
          {d && (
            <>
              <div className="grille-cartes">
                <CarteStat icone={Banknote} libelle="Montant collecté" valeur={gnf(d.totaux.montant)} detail={`${entier(d.totaux.nb_paiements)} encaissements`} />
                <CarteStat icone={Users} libelle="Contribuables recensés" valeur={entier(d.totaux.nb_recenses)} detail="par les agents du service" couleur="#1d4e89" />
                <CarteStat icone={UserCheck} libelle="Agents actifs" valeur={entier(d.totaux.nb_agents)} couleur="#b26a00" />
                <CarteStat icone={Wallet} libelle="Reste à clôturer" valeur={gnf(d.totaux.a_cloturer)}
                  detail={<Link to="/clotures">Voir les caisses à valider</Link>} couleur="#b42318" />
              </div>

              <Panneau titre="Encaissements par jour">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={d.par_jour} margin={{ left: 4, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
                    <XAxis dataKey="jour" tickFormatter={jourCourt} fontSize={11} />
                    <YAxis tickFormatter={gnfCourt} fontSize={11} width={56} />
                    <Tooltip formatter={(v) => gnf(v)} labelFormatter={jourCourt} />
                    <Bar dataKey="montant" name="Collecté" fill="#0f6b4f" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panneau>

              <div className="colonnes-egales">
                <Panneau titre="Par agent" sansMarge>
                  {d.par_agent.length ? (
                    <table className="tableau">
                      <thead><tr><th>Agent</th><th className="num">Encaissements</th><th className="num">Montant</th><th>Part</th></tr></thead>
                      <tbody>
                        {d.par_agent.map((a) => {
                          const part = pourcentage(a.montant, d.totaux.montant);
                          return (
                            <tr key={a.identifiant}>
                              <td><span className="mono">{a.identifiant}</span> <span className="petit texte-doux">{a.nom}</span></td>
                              <td className="num">{a.nb}</td>
                              <td className="num">{gnf(a.montant)}</td>
                              <td style={{ width: 110 }}><div className="barre-progression"><div style={{ width: `${part}%` }} /></div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : <Vide>Aucun agent inscrit.</Vide>}
                </Panneau>
                <Panneau titre="Par quartier" sansMarge>
                  {d.par_quartier.length ? (
                    <table className="tableau">
                      <thead><tr><th>Quartier</th><th className="num">Encaissements</th><th className="num">Montant</th></tr></thead>
                      <tbody>
                        {d.par_quartier.map((q) => (
                          <tr key={q.quartier}><td>{q.quartier}</td><td className="num">{q.nb}</td><td className="num">{gnf(q.montant)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <Vide />}
                </Panneau>
              </div>

              <Panneau titre="Par taxe" sansMarge>
                {d.par_tache.length ? (
                  <table className="tableau">
                    <thead><tr><th>Code</th><th>Taxe</th><th className="num">Encaissements</th><th className="num">Montant</th></tr></thead>
                    <tbody>
                      {d.par_tache.map((t) => (
                        <tr key={t.libelle}><td className="mono">{t.ligne_code || '—'}</td><td>{t.libelle}</td><td className="num">{t.nb}</td><td className="num">{gnf(t.montant)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                ) : <Vide>Aucun encaissement sur la période.</Vide>}
              </Panneau>
            </>
          )}
        </Etat>
      </div>
    </>
  );
}
