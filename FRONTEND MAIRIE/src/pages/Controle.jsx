import { useState } from 'react';
import { CheckCircle2, Search, XCircle } from 'lucide-react';
import { api, useApi } from '../api.js';
import { Entete } from '../components/Layout.jsx';
import { Badge, Erreur, Etat, Pagination, Panneau, Vide } from '../components/Ui.jsx';
import { date, dateHeure, gnf, MODES_PAIEMENT } from '../format.js';

const ONGLETS = { recu: 'Vérifier un reçu', clotures: 'Clôtures de caisse', journal: 'Journal des actions', sms: 'Reçus SMS' };

export default function Controle() {
  const [onglet, setOnglet] = useState('recu');
  return (
    <>
      <Entete titre="Contrôle interne" sousTitre="Vérification des encaissements, rapprochement des caisses et traçabilité">
        <div className="barre-filtres">
          {Object.entries(ONGLETS).map(([k, v]) => (
            <button key={k} className={`btn ${onglet === k ? 'primaire' : ''}`} onClick={() => setOnglet(k)}>{v}</button>
          ))}
        </div>
      </Entete>
      <div className="contenu">
        {onglet === 'recu' && <VerifierRecu />}
        {onglet === 'clotures' && <Clotures />}
        {onglet === 'journal' && <Journal />}
        {onglet === 'sms' && <Sms />}
      </div>
    </>
  );
}

function VerifierRecu() {
  const [numero, setNumero] = useState('');
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);

  async function verifier(e) {
    e.preventDefault();
    setResultat(null);
    setErreur(null);
    try {
      setResultat(await api(`/recus/${encodeURIComponent(numero.trim())}`));
    } catch (err) { setErreur(err.message); }
  }

  const r = resultat;
  return (
    <Panneau titre="Vérifier un reçu" aide="Saisissez le numéro imprimé sur le reçu ou le texte lu dans son QR code">
      <form className="barre-filtres" onSubmit={verifier}>
        <input type="search" style={{ minWidth: 380 }} placeholder="Ex. PF-001-20261001-0003" value={numero} onChange={(e) => setNumero(e.target.value)} required />
        <button className="btn primaire"><Search size={15} /> Vérifier</button>
      </form>
      {erreur && (
        <div className="alerte-boite erreur ligne" style={{ marginTop: 16 }}>
          <XCircle size={18} /> Reçu non reconnu : {erreur}. Ce reçu n'a pas été transmis par l'application ou n'est pas authentique.
        </div>
      )}
      {r && (
        <div style={{ marginTop: 16 }}>
          <div className={`alerte-boite ${r.statut === 'VALIDE' ? 'info' : 'erreur'} ligne`}>
            {r.statut === 'VALIDE' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {r.statut === 'VALIDE' ? 'Encaissement authentique, enregistré dans la base de la commune.' : 'Cet encaissement a été ANNULÉ par le service.'}
          </div>
          <div className="fiche" style={{ marginTop: 16 }}>
            {[
              ['N° de reçu', r.numero_recu], ['Montant', gnf(r.montant)], ['Tâche', `${r.tache} (${r.ligne_code})`],
              ['Service', `${r.sigle} — ${r.service}`], ['Période', r.periode], ['Mode', MODES_PAIEMENT[r.mode_paiement]],
              ['Encaissé le', dateHeure(r.date_paiement)], ['Reçu au serveur', dateHeure(r.recu_le)], ['Agent', `${r.agent} — ${r.agent_nom}`],
              ['Contribuable', `${r.contribuable_numero} — ${r.contribuable}`],
              ['Caisse', r.cloture_statut ? `Clôturée le ${date(r.cloture_jour)} (${r.cloture_statut === 'VALIDEE' ? 'validée' : 'écart signalé'})` : 'Pas encore clôturée'],
            ].map(([k, v]) => <div key={k}><div className="cle">{k}</div><div className="valeur">{v}</div></div>)}
          </div>
        </div>
      )}
    </Panneau>
  );
}

function Clotures() {
  const { donnees, chargement, erreur } = useApi('/clotures');
  return (
    <Panneau titre="Clôtures journalières de caisse" aide="Validées par les chefs de service : écart entre montants saisis et argent reversé" sansMarge>
      <Etat chargement={chargement && !donnees} erreur={erreur}>
        {donnees?.length ? (
          <div className="defilement">
            <table className="tableau">
              <thead><tr><th>Jour</th><th>Service</th><th>Agent</th><th className="num">Encaissements</th><th className="num">Collecté</th><th className="num">Reversé</th><th className="num">Écart</th><th>Statut</th><th>Validée par</th><th>Commentaire</th></tr></thead>
              <tbody>
                {donnees.map((c) => (
                  <tr key={c.id}>
                    <td>{date(c.jour)}</td><td><Badge type="info">{c.sigle}</Badge></td><td>{c.agent} <span className="petit texte-doux">{c.agent_nom}</span></td>
                    <td className="num">{c.nb_paiements}</td><td className="num">{gnf(c.montant_collecte)}</td><td className="num">{gnf(c.montant_reverse)}</td>
                    <td className="num" style={{ color: c.ecart < 0 ? 'var(--danger)' : undefined }}>{gnf(c.ecart)}</td>
                    <td>{c.statut === 'VALIDEE' ? <Badge type="succes">Validée</Badge> : <Badge type="danger">Écart à régulariser</Badge>}</td>
                    <td>{c.valide_par_identifiant}</td><td className="petit">{c.commentaire}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Vide>Aucune clôture enregistrée.</Vide>}
      </Etat>
    </Panneau>
  );
}

function Journal() {
  const [page, setPage] = useState(1);
  const [application, setApplication] = useState('');
  const { donnees: d, chargement, erreur } = useApi(`/journal?page=${page}${application ? `&application=${application}` : ''}`);
  return (
    <Panneau titre="Journal des actions" aide="Qui a saisi, modifié, encaissé, et quand" sansMarge
      actions={(
        <select value={application} onChange={(e) => { setApplication(e.target.value); setPage(1); }}>
          <option value="">Toutes les applications</option>
          <option value="MOBILE">Application mobile</option>
          <option value="SERVICE">Application Service</option>
          <option value="MAIRIE">Application Mairie</option>
        </select>
      )}>
      <Etat chargement={chargement && !d} erreur={erreur}>
        {d && (
          <>
            <div className="defilement">
              <table className="tableau">
                <thead><tr><th>Date</th><th>Application</th><th>Utilisateur</th><th>Service</th><th>Action</th><th>Détails</th></tr></thead>
                <tbody>
                  {d.elements.map((j) => (
                    <tr key={j.id}>
                      <td>{dateHeure(j.created_at)}</td><td><Badge>{j.application}</Badge></td>
                      <td>{j.identifiant} <span className="petit texte-doux">{j.utilisateur}</span></td>
                      <td>{j.sigle && <Badge type="info">{j.sigle}</Badge>}</td>
                      <td className="gras petit">{j.action.replace(/_/g, ' ')}</td>
                      <td className="mono petit" style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.details ? JSON.stringify(j.details) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={d.page} taille={d.taille} total={d.total} onPage={setPage} />
          </>
        )}
      </Etat>
    </Panneau>
  );
}

function Sms() {
  const { donnees, chargement, erreur } = useApi('/sms');
  return (
    <Panneau titre="Reçus envoyés par SMS" aide="Prototype : les SMS sont enregistrés mais aucun opérateur n'est encore branché" sansMarge>
      <Erreur message={erreur} />
      <Etat chargement={chargement && !donnees}>
        {donnees?.length ? (
          <table className="tableau">
            <thead><tr><th>Date</th><th>Téléphone</th><th>Message</th><th>Statut</th></tr></thead>
            <tbody>
              {donnees.map((s) => (
                <tr key={s.id}><td>{dateHeure(s.created_at)}</td><td>{s.telephone}</td><td className="petit">{s.message}</td><td><Badge type="alerte">{s.statut}</Badge></td></tr>
              ))}
            </tbody>
          </table>
        ) : <Vide>Aucun SMS.</Vide>}
      </Etat>
    </Panneau>
  );
}
