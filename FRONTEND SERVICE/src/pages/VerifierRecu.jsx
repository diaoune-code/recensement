import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Search, XCircle } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Entete } from '../components/Layout.jsx';
import { Panneau } from '../components/Ui.jsx';
import { date, dateHeure, gnf, MODES_PAIEMENT } from '../format.js';

// Vérification d'un reçu présenté par un contribuable (numéro imprimé ou texte lu dans le QR code)
export default function VerifierRecu() {
  const { utilisateur } = useAuth();
  const [numero, setNumero] = useState('');
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  async function verifier(e) {
    e.preventDefault();
    setResultat(null);
    setErreur(null);
    setEnvoi(true);
    try {
      setResultat(await api(`/recus/${encodeURIComponent(numero.trim())}`));
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  const autreService = erreur?.includes('appartient au service');
  const r = resultat;
  return (
    <>
      <Entete titre="Vérifier un reçu" sousTitre={`Contrôle des reçus remis par les agents du service ${utilisateur?.service?.nom || ''}`} />
      <div className="contenu">
        <Panneau titre="Numéro du reçu" aide="Saisissez le numéro imprimé sur le reçu ou le texte lu dans son QR code">
          <form className="barre-filtres" onSubmit={verifier}>
            <input type="search" style={{ minWidth: 380 }} placeholder={`Ex. ${utilisateur?.service?.sigle || 'IMP'}-001-20261001-0001`}
              value={numero} onChange={(e) => setNumero(e.target.value)} required />
            <button className="btn primaire" disabled={envoi}><Search size={15} /> {envoi ? 'Vérification…' : 'Vérifier'}</button>
          </form>

          {erreur && (autreService ? (
            <div className="alerte-boite avertissement ligne" style={{ marginTop: 16 }}>
              <AlertTriangle size={18} /> {erreur}.
            </div>
          ) : (
            <div className="alerte-boite erreur ligne" style={{ marginTop: 16 }}>
              <XCircle size={18} /> Reçu non reconnu : {erreur}. Ce reçu n'a pas été transmis par l'application ou n'est pas authentique.
            </div>
          ))}

          {r && (
            <div style={{ marginTop: 16 }}>
              <div className={`alerte-boite ${r.statut === 'VALIDE' ? 'info' : 'erreur'} ligne`}>
                {r.statut === 'VALIDE' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                {r.statut === 'VALIDE' ? 'Encaissement authentique, enregistré dans la base de la commune.' : 'Cet encaissement a été ANNULÉ par le service.'}
              </div>
              <div className="fiche" style={{ marginTop: 16 }}>
                {[
                  ['N° de reçu', r.numero_recu], ['Montant', gnf(r.montant)], ['Taxe', `${r.tache}${r.ligne_code ? ` (${r.ligne_code})` : ''}`],
                  ['Période', r.periode], ['Mode', MODES_PAIEMENT[r.mode_paiement]],
                  ['Encaissé le', dateHeure(r.date_paiement)], ['Reçu au serveur', dateHeure(r.recu_le)], ['Agent', `${r.agent} — ${r.agent_nom}`],
                  ['Contribuable', `${r.contribuable_numero} — ${r.contribuable}`],
                  ['Caisse', r.cloture_statut ? `Clôturée le ${date(r.cloture_jour)} (${r.cloture_statut === 'VALIDEE' ? 'validée' : 'écart signalé'})` : 'Pas encore clôturée'],
                ].map(([k, v]) => <div key={k}><div className="cle">{k}</div><div className="valeur">{v}</div></div>)}
              </div>
            </div>
          )}
        </Panneau>
      </div>
    </>
  );
}
