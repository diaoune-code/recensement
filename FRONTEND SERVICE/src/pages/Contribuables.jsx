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
  const libelles = { FORMEL: 'Formelle (F)', INFORMEL: 'Informelle (NF)', NON_VERIFIE: 'Non vérifié', OUI: 'Oui', NON: 'Non', PIECE_VERIFIEE: 'Pièce vérifiée', DECLARATIF: 'Déclaratif, non vérifié' };
  const joindre = (...v) => v.filter((x) => x !== null && x !== undefined && x !== '').join(' — ') || null;
  // Uniquement les champs de la « Fiche de collecte indiquée par le service de collecte », dans son ordre
  const lignes = c ? [
    ['Type de contribuable', c.type_contribuable === 'PERSONNE_PHYSIQUE' ? 'Personne physique' : 'Personne morale (entreprise)'],
    ['Nom', c.nom], ['Prénom', c.type_contribuable === 'PERSONNE_PHYSIQUE' ? c.prenoms : null], ['Quartier / Marché', joindre(c.quartier, c.nom_marche)], ['Secteur', c.secteur],
    ['Rue / Emprise', c.rue], ['N° de concession / Boutique / Magasin / Kiosque', c.numero_porte],
    ['Type d\'habitat', c.type_habitat], ['Nombre d\'étages', c.nb_etages],
    ['Activité : formelle ou informelle (F / NF)', libelles[c.statut_fiscal]], ['Numéro de téléphone', c.telephone],
    ['Activité', c.activite_principale],
    ['Liste des taxes et redevances', Object.values(c.complements || {}).flatMap((x) => x?.taxes_applicables || [])
      .map((idTaxe) => c.noms_taches?.[idTaxe] || `Taxe ${idTaxe}`).join(' · ') || null],
    ['Type de bien', c.type_bien], ['Usage principal du bien', c.usage_bien], ['Documents fonciers', c.documents_fonciers],
    ['Lien entre le répondant et le bien', c.lien_repondant_bien],
    ['Dernier paiement déclaré', joindre(c.dernier_paiement_date, c.dernier_paiement_montant ? gnf(c.dernier_paiement_montant) : null)],
    ['Pièce', joindre(c.piece_type, c.piece_numero)], ['Consentement', libelles[c.consentement]], ['Contrôle qualité', libelles[c.controle_qualite]],
  ] : [];
  return (
    <Modal large titre={c ? nomComplet(c) : 'Contribuable'} onFermer={onFermer}>
      <Etat chargement={chargement} erreur={erreur}>
        {c && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="petit texte-doux">{c.numero} · recensé par {c.agent} ({c.service_sigle}) le {date(c.created_at)}</div>
            <div className="fiche">
              {lignes.map(([k, v]) => <div key={k}><div className="cle">{k}</div><div className="valeur">{v ?? '—'}</div></div>)}
            </div>
            <div>
              <div className="gras" style={{ marginBottom: 8 }}>Paiements au service</div>
              {c.paiements.length ? (
                <table className="tableau">
                  <thead><tr><th>Reçu</th><th>Date</th><th>Taxe</th><th>Période</th><th>Agent</th><th className="num">Montant</th></tr></thead>
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
