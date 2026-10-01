import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { api, useApi } from '../api.js';
import { Entete } from '../components/Layout.jsx';
import { Erreur, Etat, Panneau } from '../components/Ui.jsx';

const TYPES = { texte: 'Texte', nombre: 'Nombre', choix: 'Liste de choix' };

const SECTIONS_COMMUNES = [
  'Identification : type, nom, prénoms, raison sociale, sexe, pièce d\'identité, téléphones, NIF / RCCM, statut fiscal',
  'Localisation : quartier, secteur, rue, n° de porte ou concession, marché et n° d\'étal, repères, coordonnées GPS',
  'Activité : activité principale, description, forme du point, occupation, surface, nombre d\'étals et de personnes',
  'Photo du contribuable ou du site',
];

export default function Formulaire() {
  const { donnees, chargement, erreur } = useApi('/formulaire');
  const [champs, setChamps] = useState([]);
  const [message, setMessage] = useState(null);
  const [erreurAction, setErreurAction] = useState(null);

  useEffect(() => { if (donnees) setChamps(donnees.map((c) => ({ ...c, optionsTexte: (c.options || []).join(', ') }))); }, [donnees]);

  const maj = (i, k, v) => setChamps(champs.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  const deplacer = (i, d) => {
    const n = [...champs];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    setChamps(n);
  };

  async function enregistrer() {
    setMessage(null);
    setErreurAction(null);
    try {
      const corps = champs.map((c) => ({
        cle: c.cle, libelle: c.libelle, type: c.type,
        options: c.type === 'choix' ? c.optionsTexte.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
      }));
      const r = await api('/formulaire', { methode: 'PUT', corps });
      setChamps(r.map((c) => ({ ...c, optionsTexte: (c.options || []).join(', ') })));
      setMessage('Formulaire enregistré. Les téléphones des agents le recevront à leur prochaine synchronisation.');
    } catch (e) { setErreurAction(e.message); }
  }

  return (
    <>
      <Entete titre="Formulaire mobile" sousTitre="Champs propres au service, ajoutés à la fiche commune lors du recensement sur le terrain">
        <button className="btn primaire" onClick={enregistrer}><Save size={15} /> Enregistrer</button>
      </Entete>
      <div className="contenu">
        {message && <div className="alerte-boite info">{message}</div>}
        <Erreur message={erreurAction} />
        <div className="deux-colonnes">
          <Panneau titre="Champs du service" aide="Exemple : un service Transport demande le type et le nombre d'engins ; le Cadastre la surface bâtie">
            <Etat chargement={chargement && !donnees} erreur={erreur}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {champs.length === 0 && <div className="texte-doux">Aucun champ spécifique : vos agents remplissent uniquement la fiche commune.</div>}
                {champs.map((c, i) => (
                  <div key={i} className="panneau" style={{ padding: 12, boxShadow: 'none' }}>
                    <div className="ligne">
                      <input style={{ flex: 2 }} placeholder="Libellé du champ" value={c.libelle} onChange={(e) => maj(i, 'libelle', e.target.value)} />
                      <select style={{ flex: 1 }} value={c.type} onChange={(e) => maj(i, 'type', e.target.value)}>
                        {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <button className="btn petit" disabled={i === 0} onClick={() => deplacer(i, -1)}><ArrowUp size={13} /></button>
                      <button className="btn petit" disabled={i === champs.length - 1} onClick={() => deplacer(i, 1)}><ArrowDown size={13} /></button>
                      <button className="btn petit danger" onClick={() => setChamps(champs.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
                    </div>
                    {c.type === 'choix' && (
                      <input style={{ width: '100%', marginTop: 8 }} placeholder="Options séparées par des virgules" value={c.optionsTexte}
                        onChange={(e) => maj(i, 'optionsTexte', e.target.value)} />
                    )}
                    {c.cle && <div className="petit texte-doux mono" style={{ marginTop: 6 }}>clé : {c.cle}</div>}
                  </div>
                ))}
                <div>
                  <button className="btn" onClick={() => setChamps([...champs, { libelle: '', type: 'texte', optionsTexte: '' }])}><Plus size={14} /> Ajouter un champ</button>
                </div>
              </div>
            </Etat>
          </Panneau>
          <Panneau titre="Fiche commune" aide="Toujours présente, identique pour tous les services">
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              {SECTIONS_COMMUNES.map((s) => <li key={s}>{s}</li>)}
            </ul>
            <div className="alerte-boite avertissement" style={{ marginTop: 14 }}>
              Les champs « Nombre » peuvent servir de base de calcul à une tâche « Tarif × base » (ex. nombre d'engins × 50 000 GNF).
              Supprimer un champ utilisé par une tâche la fera revenir en saisie manuelle.
            </div>
          </Panneau>
        </div>
      </div>
    </>
  );
}
