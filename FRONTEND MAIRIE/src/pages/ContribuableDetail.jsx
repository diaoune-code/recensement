import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useApi } from '../api.js';
import { Entete } from '../components/Layout.jsx';
import { Badge, Etat, Panneau, Vide } from '../components/Ui.jsx';
import { date, dateHeure, gnf, MODES_PAIEMENT, nomComplet } from '../format.js';

const LIBELLES_VALEURS = {
  FORMEL: 'Formelle (F)', INFORMEL: 'Informelle (NF)', NON_VERIFIE: 'Non vérifié', OUI: 'Oui', NON: 'Non',
  PIECE_VERIFIEE: 'Pièce vérifiée', DECLARATIF: 'Déclaratif, non vérifié',
};
const texte = (v) => (v === null || v === undefined || v === '' ? null : LIBELLES_VALEURS[v] || String(v));
const joindre = (...v) => v.map(texte).filter(Boolean).join(' — ') || null;
const taxesConcernees = (c) => Object.values(c.complements || {}).flatMap((x) => x?.taxes_applicables || [])
  .map((id) => c.noms_taches?.[id] || `Taxe ${id}`).join(' · ') || null;

// Uniquement les champs de la « Fiche de collecte indiquée par le service de collecte », dans son ordre
const RUBRIQUES = [
  { titre: 'Identification et localisation', champs: [
    ['Type de contribuable', (c) => (c.type_contribuable === 'PERSONNE_PHYSIQUE' ? 'Personne physique' : 'Personne morale (entreprise)')],
    ['Nom', (c) => c.nom], ['Prénom', (c) => (c.type_contribuable === 'PERSONNE_PHYSIQUE' ? c.prenoms : null)], ['Quartier / Marché', (c) => joindre(c.quartier, c.nom_marche)],
    ['Secteur', (c) => c.secteur], ['Rue / Emprise', (c) => c.rue],
    ['N° de concession / Boutique / Magasin / Kiosque', (c) => c.numero_porte],
    ['Type d\'habitat', (c) => c.type_habitat], ['Nombre d\'étages', (c) => c.nb_etages],
    ['Activité : formelle ou informelle (F / NF)', (c) => c.statut_fiscal], ['Numéro de téléphone', (c) => c.telephone],
    ['Activité', (c) => c.activite_principale], ['Liste des taxes et redevances', taxesConcernees],
  ] },
  { titre: 'Bien et documents', champs: [
    ['Type de bien', (c) => c.type_bien], ['Usage principal du bien', (c) => c.usage_bien],
    ['Documents fonciers', (c) => c.documents_fonciers], ['Lien entre le répondant et le bien', (c) => c.lien_repondant_bien],
  ] },
  { titre: 'Paiements et suivi', champs: [
    ['Dernier paiement déclaré', (c) => joindre(c.dernier_paiement_date, c.dernier_paiement_montant ? gnf(c.dernier_paiement_montant) : null)],
  ] },
  { titre: 'Pièces, consentement et contrôle qualité', champs: [
    ['Pièce', (c) => joindre(c.piece_type, c.piece_numero)], ['Consentement', (c) => c.consentement], ['Contrôle qualité', (c) => c.controle_qualite],
  ] },
];

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
              <Panneau titre="Fiche contribuable" aide="Champs de la fiche de collecte du service de collecte">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {RUBRIQUES.map((r) => (
                    <div key={r.titre}>
                      <div className="gras" style={{ marginBottom: 8 }}>{r.titre}</div>
                      <div className="fiche">
                        {r.champs.map(([libelle, lire]) => (
                          <div key={libelle}><div className="cle">{libelle}</div><div className="valeur">{texte(lire(c)) ?? '—'}</div></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Panneau>

              <Panneau titre="Paiements — tous services" aide={`Total payé : ${gnf(c.paiements.filter((p) => p.statut === 'VALIDE').reduce((a, p) => a + p.montant, 0))}`} sansMarge>
                {c.paiements.length ? (
                  <div className="defilement">
                    <table className="tableau">
                      <thead><tr><th>Reçu</th><th>Date</th><th>Service</th><th>Taxe</th><th>Période</th><th>Mode</th><th>Agent</th><th className="num">Montant</th><th /></tr></thead>
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
