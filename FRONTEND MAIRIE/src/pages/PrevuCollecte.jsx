import { useMemo, useState } from 'react';
import { useApi } from '../api.js';
import { Entete } from '../components/Layout.jsx';
import { Badge, BarreProgression, CarteStat, Etat, Panneau } from '../components/Ui.jsx';
import { gnf, pourcentage } from '../format.js';
import { Banknote, Target, TrendingUp } from 'lucide-react';

export default function PrevuCollecte() {
  const anneeCourante = new Date().getFullYear();
  const [annee, setAnnee] = useState(anneeCourante);
  const [filtre, setFiltre] = useState('prevision');
  const { donnees: d, chargement, erreur } = useApi(`/prevu-collecte?annee=${annee}`);

  // Lignes regroupées par chapitre budgétaire
  const chapitres = useMemo(() => {
    if (!d) return [];
    const lignes = d.lignes.filter((l) => filtre === 'toutes' || l.prevision > 0 || l.collecte > 0);
    const groupes = new Map();
    for (const l of lignes) {
      const g = groupes.get(l.chapitre) || { chapitre: l.chapitre, lignes: [], prevision: 0, collecte: 0 };
      g.lignes.push(l);
      g.prevision += l.prevision;
      g.collecte += l.collecte;
      groupes.set(l.chapitre, g);
    }
    return [...groupes.values()];
  }, [d, filtre]);

  return (
    <>
      <Entete titre="Prévu / collecté" sousTitre="Exécution budgétaire : prévisions primitives du budget 2025 face aux encaissements">
        <div className="barre-filtres">
          <select value={annee} onChange={(e) => setAnnee(Number(e.target.value))}>
            {[anneeCourante, anneeCourante - 1].map((a) => <option key={a} value={a}>Encaissements {a}</option>)}
          </select>
          <select value={filtre} onChange={(e) => setFiltre(e.target.value)}>
            <option value="prevision">Lignes prévues ou encaissées</option>
            <option value="toutes">Toutes les lignes</option>
          </select>
        </div>
      </Entete>
      <div className="contenu">
        <Etat chargement={chargement && !d} erreur={erreur}>
          {d && (
            <>
              <div className="grille-cartes">
                <CarteStat icone={Target} libelle="Prévisions 2025" valeur={gnf(d.total.prevision)} />
                <CarteStat icone={Banknote} libelle={`Collecté en ${d.annee} (via l'application)`} valeur={gnf(d.total.collecte)} couleur="#1f7a4d" />
                <CarteStat icone={TrendingUp} libelle="Taux de réalisation" valeur={`${pourcentage(d.total.collecte, d.total.prevision)} %`} couleur="#b26a00" />
              </div>

              <Panneau titre="Par service" aide="Somme des lignes de recettes attribuées à chaque service" sansMarge>
                <table className="tableau">
                  <thead><tr><th>Service</th><th className="num">Prévu</th><th className="num">Collecté</th><th className="num">Écart</th><th style={{ width: 200 }}>Réalisation</th></tr></thead>
                  <tbody>
                    {d.par_service.filter((s) => s.prevision > 0 || s.collecte > 0).map((s) => {
                      const taux = pourcentage(s.collecte, s.prevision);
                      return (
                        <tr key={s.sigle || 'na'}>
                          <td>{s.sigle ? <><span className="gras">{s.sigle}</span> — {s.service}</> : <Badge type="alerte">{s.service}</Badge>}</td>
                          <td className="num">{gnf(s.prevision)}</td>
                          <td className="num">{gnf(s.collecte)}</td>
                          <td className="num" style={{ color: s.collecte - s.prevision < 0 ? 'var(--danger)' : 'var(--succes)' }}>{gnf(s.collecte - s.prevision)}</td>
                          <td><div className="ligne"><div style={{ flex: 1 }}><BarreProgression valeur={taux} /></div><span className="petit">{taux}%</span></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panneau>

              {chapitres.map((g) => (
                <Panneau key={g.chapitre} titre={g.chapitre}
                  aide={`Prévu ${gnf(g.prevision)} — collecté ${gnf(g.collecte)} (${pourcentage(g.collecte, g.prevision)} %)`} sansMarge>
                  <div className="defilement">
                    <table className="tableau">
                      <thead><tr><th>Code</th><th>Libellé</th><th>Service</th><th className="num">Prévu 2025</th><th className="num">Collecté</th><th style={{ width: 160 }}>Réalisation</th></tr></thead>
                      <tbody>
                        {g.lignes.map((l) => {
                          const taux = pourcentage(l.collecte, l.prevision);
                          return (
                            <tr key={l.code}>
                              <td className="mono">{l.code}</td>
                              <td>{l.libelle}</td>
                              <td>{l.sigle ? <Badge type="info">{l.sigle}</Badge> : <Badge type="alerte" >{l.service_indique || 'À attribuer'}</Badge>}</td>
                              <td className="num">{gnf(l.prevision)}</td>
                              <td className="num">{gnf(l.collecte)}</td>
                              <td>{l.prevision > 0 ? <div className="ligne"><div style={{ flex: 1 }}><BarreProgression valeur={taux} /></div><span className="petit">{taux}%</span></div> : <span className="texte-doux petit">sans prévision</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Panneau>
              ))}
            </>
          )}
        </Etat>
      </div>
    </>
  );
}
