import { useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { api, useApi } from '../api.js';
import { Entete } from '../components/Layout.jsx';
import { Badge, Erreur, Etat, Panneau } from '../components/Ui.jsx';
import { gnf } from '../format.js';

const INDENT = { chapitre: 0, article: 14, paragraphe: 28, sous_paragraphe: 42 };

export default function Referentiel() {
  const [onglet, setOnglet] = useState('lignes');
  return (
    <>
      <Entete titre="Référentiel" sousTitre="Cadre commun à tous les services : nomenclature des recettes et quartiers">
        <div className="barre-filtres">
          <button className={`btn ${onglet === 'lignes' ? 'primaire' : ''}`} onClick={() => setOnglet('lignes')}>Lignes de recettes</button>
          <button className={`btn ${onglet === 'quartiers' ? 'primaire' : ''}`} onClick={() => setOnglet('quartiers')}>Quartiers</button>
        </div>
      </Entete>
      <div className="contenu">{onglet === 'lignes' ? <Lignes /> : <Quartiers />}</div>
    </>
  );
}

function Lignes() {
  const { donnees: lignes, chargement, erreur, recharger } = useApi('/lignes-recettes');
  const { donnees: services } = useApi('/services');
  const [filtre, setFiltre] = useState('');
  const [erreurAction, setErreurAction] = useState(null);

  const visibles = useMemo(() => (lignes || []).filter((l) => {
    if (filtre === 'sans') return ['paragraphe', 'sous_paragraphe'].includes(l.niveau) && !l.service_id;
    if (filtre) return l.service_id === Number(filtre);
    return true;
  }), [lignes, filtre]);

  async function attribuer(code, serviceId) {
    try {
      await api(`/lignes-recettes/${code}`, { methode: 'PUT', corps: { service_id: serviceId ? Number(serviceId) : null } });
      recharger();
    } catch (e) { setErreurAction(e.message); }
  }

  const nbSans = (lignes || []).filter((l) => ['paragraphe', 'sous_paragraphe'].includes(l.niveau) && !l.service_id).length;

  return (
    <>
      {nbSans > 0 && (
        <div className="alerte-boite avertissement">
          {nbSans} ligne(s) sans service attribué, dont « Droits et produits de fourrière » (7304, police routière) : à confirmer avec la commune.
        </div>
      )}
      <Erreur message={erreurAction} />
      <Panneau titre="Lignes de recettes" aide="Issues du classeur « Services concernés par ligne de recettes ». Cliquez sur une prévision pour la modifier : les totaux des chapitres et articles se recalculent." sansMarge
        actions={(
          <select value={filtre} onChange={(e) => setFiltre(e.target.value)}>
            <option value="">Toutes les lignes</option>
            <option value="sans">Sans service attribué</option>
            {services?.map((s) => <option key={s.id} value={s.id}>{s.sigle} — {s.nom}</option>)}
          </select>
        )}>
        <Etat chargement={chargement && !lignes} erreur={erreur}>
          <div className="defilement">
            <table className="tableau">
              <thead><tr><th>Code</th><th>Libellé</th><th className="num">Prévision 2025</th><th>Service indiqué (classeur)</th><th>Service attribué</th><th className="num">Tâches</th></tr></thead>
              <tbody>
                {visibles.map((l) => {
                  const titre = l.niveau === 'chapitre' || l.niveau === 'article';
                  return (
                    <tr key={l.code} style={titre ? { background: '#f8f9fb' } : undefined}>
                      <td className="mono">{l.code}</td>
                      <td style={{ paddingLeft: 14 + INDENT[l.niveau], fontWeight: titre ? 600 : 400 }}>{l.libelle}</td>
                      <td className="num">
                        {l.feuille
                          ? <ChampPrevision ligne={l} onEnregistre={recharger} onErreur={setErreurAction} />
                          : <span className={titre ? 'gras' : ''} title="Somme des sous-lignes">{l.prevision_2025 ? gnf(l.prevision_2025) : '—'}</span>}
                      </td>
                      <td className="petit texte-doux">{l.service_indique || ''}</td>
                      <td>
                        {!titre && (
                          <select value={l.service_id || ''} onChange={(e) => attribuer(l.code, e.target.value)}>
                            <option value="">— À attribuer —</option>
                            {services?.map((s) => <option key={s.id} value={s.id}>{s.sigle} — {s.nom}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="num">{l.nb_taches > 0 ? <Badge type="succes">{l.nb_taches}</Badge> : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Etat>
      </Panneau>
    </>
  );
}

// Prévision modifiable d'une ligne de détail : affichée formatée, éditée en chiffres.
// Enregistrée avec Entrée ou en quittant le champ ; Échap annule.
function ChampPrevision({ ligne, onEnregistre, onErreur }) {
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  function ouvrir() {
    setValeur(ligne.prevision_2025 ? String(ligne.prevision_2025) : '');
    setEdition(true);
  }

  async function enregistrer() {
    const nombre = valeur === '' ? 0 : Number(valeur);
    if (nombre === Number(ligne.prevision_2025 || 0)) { setEdition(false); return; }
    setEnvoi(true);
    try {
      await api(`/lignes-recettes/${ligne.code}`, { methode: 'PUT', corps: { prevision_2025: nombre } });
      onErreur(null);
      setEdition(false);
      onEnregistre();
    } catch (e) {
      onErreur(`${ligne.code} : ${e.message}`);
    } finally {
      setEnvoi(false);
    }
  }

  if (!edition) {
    return (
      <button className="btn petit" style={{ minWidth: 150, justifyContent: 'flex-end' }} onClick={ouvrir} title="Modifier la prévision">
        {ligne.prevision_2025 ? gnf(ligne.prevision_2025) : '—'} <Pencil size={12} />
      </button>
    );
  }
  return (
    <input
      type="number" min="0" step="1000" autoFocus disabled={envoi}
      style={{ width: 170, textAlign: 'right' }}
      value={valeur}
      onChange={(e) => setValeur(e.target.value)}
      onBlur={enregistrer}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setEdition(false);
      }}
    />
  );
}

function Quartiers() {
  const { donnees: quartiers, chargement, erreur, recharger } = useApi('/quartiers');
  const [nouveau, setNouveau] = useState({ nom: '', latitude: '', longitude: '' });
  const [erreurAction, setErreurAction] = useState(null);

  async function ajouter(e) {
    e.preventDefault();
    try {
      await api('/quartiers', { methode: 'POST', corps: { nom: nouveau.nom, latitude: nouveau.latitude || null, longitude: nouveau.longitude || null } });
      setNouveau({ nom: '', latitude: '', longitude: '' });
      recharger();
    } catch (err) { setErreurAction(err.message); }
  }

  async function basculer(q) {
    try {
      await api(`/quartiers/${q.id}`, { methode: 'PUT', corps: { ...q, actif: !q.actif } });
      recharger();
    } catch (err) { setErreurAction(err.message); }
  }

  return (
    <>
      <div className="alerte-boite info">La liste des quartiers est envoyée aux téléphones des agents à chaque synchronisation. Les quartiers de départ sont des valeurs de démonstration à vérifier.</div>
      <Erreur message={erreurAction} />
      <Panneau titre="Quartiers de la commune" sansMarge
        actions={(
          <form className="barre-filtres" onSubmit={ajouter}>
            <input placeholder="Nom du quartier" value={nouveau.nom} onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} required />
            <input placeholder="Latitude" style={{ width: 110 }} value={nouveau.latitude} onChange={(e) => setNouveau({ ...nouveau, latitude: e.target.value })} />
            <input placeholder="Longitude" style={{ width: 110 }} value={nouveau.longitude} onChange={(e) => setNouveau({ ...nouveau, longitude: e.target.value })} />
            <button className="btn primaire"><Plus size={14} /> Ajouter</button>
          </form>
        )}>
        <Etat chargement={chargement && !quartiers} erreur={erreur}>
          <table className="tableau">
            <thead><tr><th>Quartier</th><th>Coordonnées du centre</th><th className="num">Contribuables</th><th>Statut</th><th /></tr></thead>
            <tbody>
              {quartiers?.map((q) => (
                <tr key={q.id}>
                  <td className="gras">{q.nom}</td>
                  <td className="mono">{q.latitude ? `${q.latitude}, ${q.longitude}` : '—'}</td>
                  <td className="num">{q.nb_contribuables}</td>
                  <td>{q.actif ? <Badge type="succes">Actif</Badge> : <Badge>Masqué</Badge>}</td>
                  <td><button className="btn petit" onClick={() => basculer(q)}>{q.actif ? 'Masquer' : 'Réactiver'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Etat>
      </Panneau>
    </>
  );
}
