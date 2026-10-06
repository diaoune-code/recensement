import { useState } from 'react';
import { Banknote, Target, TrendingUp, Users } from 'lucide-react';
import { useApi } from '../api.js';
import { Entete } from '../components/Layout.jsx';
import { Badge, BarreProgression, CarteStat, Etat, Panneau, Vide } from '../components/Ui.jsx';
import { entier, FREQUENCES, gnf, pourcentage } from '../format.js';

// Montant unitaire d'une taxe, tel que paramétré par le service
function montantTaxe(t) {
  if (t.mode_calcul === 'FORFAIT') return gnf(t.montant);
  if (t.mode_calcul === 'TARIF_BASE') return `${gnf(t.tarif_unitaire)} × ${t.base_libelle || 'base'}`;
  const montants = (t.bareme || []).map((b) => Number(b.montant)).filter((m) => m > 0);
  return montants.length ? `barème dès ${gnf(Math.min(...montants))}` : 'barème';
}

export default function PrevuCollecte() {
  const anneeCourante = new Date().getFullYear();
  const [annee, setAnnee] = useState(anneeCourante);
  const { donnees: d, chargement, erreur } = useApi(`/prevu-collecte?annee=${annee}`);
  const nbConcernes = d ? d.taxes.reduce((a, t) => a + t.nb_contribuables, 0) : 0;

  return (
    <>
      <Entete titre="Prévu / collecté" sousTitre="Prévision calculée à partir des taxes des services et des contribuables recensés qui doivent les payer">
        <select value={annee} onChange={(e) => setAnnee(Number(e.target.value))}>
          {[anneeCourante, anneeCourante - 1].map((a) => <option key={a} value={a}>Encaissements {a}</option>)}
        </select>
      </Entete>
      <div className="contenu">
        <Etat chargement={chargement && !d} erreur={erreur}>
          {d && (
            <>
              <div className="grille-cartes">
                <CarteStat icone={Target} libelle="Prévision" valeur={gnf(d.total.prevision)} detail="montant des taxes × contribuables concernés" />
                <CarteStat icone={Users} libelle="Contribuables concernés" valeur={entier(nbConcernes)} detail="taxes cochées au recensement" couleur="#1d4e89" />
                <CarteStat icone={Banknote} libelle={`Collecté en ${d.annee}`} valeur={gnf(d.total.collecte)} couleur="#1f7a4d" />
                <CarteStat icone={TrendingUp} libelle="Taux de réalisation" valeur={`${pourcentage(d.total.collecte, d.total.prevision)} %`} couleur="#b26a00" />
              </div>

              <div className="alerte-boite info">
                La prévision part de zéro. Elle augmente quand un service paramètre une taxe (montant) et que les agents
                recensent des contribuables en cochant cette taxe : prévision = montant de la taxe × nombre de contribuables concernés.
                Pour un tarif × base, la base retenue est le nombre d'étages s'il sert de base, sinon 1 ; pour un barème, le plus petit montant.
              </div>

              <Panneau titre="Par service" sansMarge>
                {d.par_service.length ? (
                  <table className="tableau">
                    <thead><tr><th>Service</th><th className="num">Taxes</th><th className="num">Contribuables concernés</th><th className="num">Prévision</th><th className="num">Collecté</th><th className="num">Écart</th><th style={{ width: 180 }}>Réalisation</th></tr></thead>
                    <tbody>
                      {d.par_service.map((s) => {
                        const taux = pourcentage(s.collecte, s.prevision);
                        return (
                          <tr key={s.sigle}>
                            <td><span className="gras">{s.sigle}</span> — {s.service}</td>
                            <td className="num">{s.nb_taxes}</td>
                            <td className="num">{entier(s.nb_contribuables)}</td>
                            <td className="num">{gnf(s.prevision)}</td>
                            <td className="num">{gnf(s.collecte)}</td>
                            <td className="num" style={{ color: s.collecte - s.prevision < 0 ? 'var(--danger)' : 'var(--succes)' }}>{gnf(s.collecte - s.prevision)}</td>
                            <td>{s.prevision > 0 ? <div className="ligne"><div style={{ flex: 1 }}><BarreProgression valeur={taux} /></div><span className="petit">{taux}%</span></div> : <span className="texte-doux petit">sans prévision</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : <Vide>Aucune taxe n'est encore paramétrée par les services : la prévision est à zéro.</Vide>}
              </Panneau>

              <Panneau titre="Par taxe" aide="Chaque taxe paramétrée par un service, avec son code budgétaire" sansMarge>
                {d.taxes.length ? (
                  <div className="defilement">
                    <table className="tableau">
                      <thead><tr><th>Service</th><th>Code</th><th>Taxe</th><th>Montant</th><th>Fréquence</th><th className="num">Contribuables concernés</th><th className="num">Prévision</th><th className="num">Collecté</th></tr></thead>
                      <tbody>
                        {d.taxes.map((t) => (
                          <tr key={t.id} style={t.actif ? undefined : { opacity: 0.6 }}>
                            <td><Badge type="info">{t.sigle}</Badge></td>
                            <td className="mono">{t.ligne_code || '—'}</td>
                            <td>{t.libelle}{!t.actif && <> <Badge>désactivée</Badge></>}</td>
                            <td>{montantTaxe(t)}</td>
                            <td>{FREQUENCES[t.frequence]}</td>
                            <td className="num">{entier(t.nb_contribuables)}</td>
                            <td className="num gras">{gnf(t.prevision)}</td>
                            <td className="num">{gnf(t.collecte)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <Vide>Aucune taxe.</Vide>}
              </Panneau>
            </>
          )}
        </Etat>
      </div>
    </>
  );
}
