import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useApi } from '../api.js';
import { Entete } from '../components/Layout.jsx';
import { Badge, Etat, Panneau, Vide } from '../components/Ui.jsx';
import { date, dateHeure, gnf, MODES_PAIEMENT, nomComplet } from '../format.js';

const LIBELLES = {
  type_contribuable: 'Type', sexe: 'Sexe', date_naissance: 'Date de naissance', nationalite: 'Nationalité',
  piece_type: 'Pièce présentée', piece_numero: 'N° de pièce', telephone: 'Téléphone', telephone2: 'Téléphone secondaire',
  email: 'E-mail', statut_fiscal: 'Activité formelle / informelle', nif: 'NIF', rccm: 'RCCM',
  type_site: 'Type de site', quartier: 'Quartier', secteur: 'Secteur', rue: 'Rue / emprise', sur_emprise: 'Occupe une emprise',
  numero_porte: 'N° de concession', nom_marche: 'Marché', numero_etal: 'N° boutique / magasin / kiosque', repere: 'Repères',
  type_habitat: 'Type d\'habitat', nb_etages: 'Nombre d\'étages',
  activite_principale: 'Activité principale', description_activite: 'Description', forme_point: 'Forme du point',
  occupation: 'Occupation', surface_m2: 'Surface (m²)', nb_etals: 'Nombre d\'étals', nb_personnes: 'Personnes sur le site',
  type_bien: 'Type de bien', usage_bien: 'Usage principal du bien', documents_fonciers: 'Documents fonciers',
  lien_repondant_bien: 'Lien entre le répondant et le bien',
  dernier_paiement_date: 'Dernier paiement déclaré (date)', dernier_paiement_montant: 'Dernier paiement déclaré (montant)',
  consentement: 'Consentement', controle_qualite: 'Contrôle qualité', observations: 'Observations de l\'agent',
};

// Rubriques de la « Fiche de collecte indiquée par le service de collecte »
const SECTIONS = [
  { titre: 'Identification', cles: ['type_contribuable', 'sexe', 'date_naissance', 'nationalite', 'telephone', 'telephone2', 'email', 'statut_fiscal', 'nif', 'rccm'] },
  { titre: 'Localisation', cles: ['quartier', 'nom_marche', 'secteur', 'rue', 'sur_emprise', 'numero_porte', 'numero_etal', 'type_habitat', 'nb_etages', 'repere'] },
  { titre: 'Activité économique', cles: ['activite_principale', 'description_activite', 'surface_m2', 'nb_etals', 'nb_personnes'] },
  { titre: 'Bien et documents', cles: ['type_bien', 'usage_bien', 'documents_fonciers', 'lien_repondant_bien'] },
  { titre: 'Paiements et suivi', cles: ['dernier_paiement_date', 'dernier_paiement_montant'] },
  { titre: 'Pièces, consentement et contrôle qualité', cles: ['piece_type', 'piece_numero', 'consentement', 'controle_qualite', 'observations'] },
];

const LIBELLES_VALEURS = {
  FORMEL: 'Formelle (F)', INFORMEL: 'Informelle (NF)', NON_VERIFIE: 'Non vérifié', OUI: 'Oui', NON: 'Non',
  PIECE_VERIFIEE: 'Pièce vérifiée', DECLARATIF: 'Déclaratif, non vérifié',
};
const valeur = (v, cle) => {
  if (v === null || v === undefined || v === '') return '—';
  if (cle === 'dernier_paiement_montant') return gnf(v);
  return LIBELLES_VALEURS[v] || String(v).replace(/_/g, ' ');
};

export default function ContribuableDetail() {
  const { id } = useParams();
  const { donnees: c, chargement, erreur } = useApi(`/contribuables/${id}`);

  return (
    <>
      <Entete titre={c ? nomComplet(c) : 'Contribuable'} sousTitre={c ? `${c.numero} — recensé le ${date(c.created_at)} par ${c.agent_nom} (${c.service_sigle})` : ''}>
        <Link to="/contribuables" className="btn"><ArrowLeft size={15} /> Retour à la liste</Link>
      </Entete>
      <div className="contenu">
        <Etat chargement={chargement} erreur={erreur}>
          {c && (
            <>
              {c.doublon_suspect_de && (
                <div className="alerte-boite avertissement">
                  Doublon suspect : même téléphone que la fiche <Link to={`/contribuables/${c.doublon_suspect_de}`}>{c.doublon_numero}</Link>. À vérifier avant fusion.
                </div>
              )}
              <Panneau titre="Fiche contribuable"
                aide={c.modifie_par_identifiant ? `Dernière modification le ${dateHeure(c.updated_at)} par ${c.modifie_par_identifiant}` : undefined}
                actions={c.latitude && (
                  <a className="btn petit" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=18/${c.latitude}/${c.longitude}`}>
                    <MapPin size={14} /> {Number(c.latitude).toFixed(5)}, {Number(c.longitude).toFixed(5)}
                  </a>
                )}>
                <div className="ligne" style={{ alignItems: 'flex-start', gap: 24 }}>
                  {c.photo ? <img className="photo-contribuable" src={`data:image/jpeg;base64,${c.photo}`} alt="Photo du contribuable" />
                    : <div className="photo-contribuable" style={{ display: 'grid', placeItems: 'center', color: 'var(--texte-doux)' }}>Pas de photo</div>}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {SECTIONS.map((s) => (
                      <div key={s.titre}>
                        <div className="gras" style={{ marginBottom: 8 }}>{s.titre}</div>
                        <div className="fiche">
                          {s.cles.map((k) => (
                            <div key={k}><div className="cle">{LIBELLES[k]}</div><div className="valeur">{valeur(c[k], k)}</div></div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Panneau>

              {Object.keys(c.complements || {}).length > 0 && (
                <Panneau titre="Informations complétées par les services">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {Object.entries(c.complements).map(([sigle, champs]) => (
                      <div key={sigle}>
                        <Badge type="info">{sigle}</Badge>
                        <div className="fiche" style={{ marginTop: 8 }}>
                          {Object.entries(champs).map(([k, v]) => (k === 'taxes_applicables' ? (
                            <div key={k} style={{ gridColumn: '1 / -1' }}>
                              <div className="cle">Taxes et redevances concernées</div>
                              <div className="valeur">{(v || []).map((id) => c.noms_taches?.[id] || `Tâche ${id}`).join(' · ') || '—'}</div>
                            </div>
                          ) : (
                            <div key={k}><div className="cle">{k.replace(/_/g, ' ')}</div><div className="valeur">{valeur(v)}</div></div>
                          )))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Panneau>
              )}

              <Panneau titre="Paiements — tous services" aide={`Total payé : ${gnf(c.paiements.filter((p) => p.statut === 'VALIDE').reduce((a, p) => a + p.montant, 0))}`} sansMarge>
                {c.paiements.length ? (
                  <div className="defilement">
                    <table className="tableau">
                      <thead><tr><th>Reçu</th><th>Date</th><th>Service</th><th>Tâche</th><th>Période</th><th>Mode</th><th>Agent</th><th className="num">Montant</th><th /></tr></thead>
                      <tbody>
                        {c.paiements.map((p) => (
                          <tr key={p.id}>
                            <td className="mono">{p.numero_recu}</td>
                            <td>{dateHeure(p.date_paiement)}</td>
                            <td><Badge type="info">{p.sigle}</Badge></td>
                            <td>{p.tache} <span className="petit texte-doux">({p.ligne_code})</span></td>
                            <td>{p.periode}</td>
                            <td>{MODES_PAIEMENT[p.mode_paiement] || p.mode_paiement}</td>
                            <td>{p.agent}</td>
                            <td className="num">{gnf(p.montant)}</td>
                            <td>{p.statut === 'ANNULE' && <Badge type="danger">Annulé</Badge>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <Vide>Aucun paiement enregistré.</Vide>}
              </Panneau>
            </>
          )}
        </Etat>
      </div>
    </>
  );
}
