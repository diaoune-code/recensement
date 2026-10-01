import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api, useApi } from '../api.js';
import { Entete } from '../components/Layout.jsx';
import { Badge, Champ, Erreur, Etat, Modal, Panneau, Vide } from '../components/Ui.jsx';
import { FREQUENCES, gnf, MODES_CALCUL } from '../format.js';

const BASES_FICHE = { surface_m2: 'Surface occupée (m²) de la fiche', nb_etals: 'Nombre d\'étals de la fiche', nb_personnes: 'Nombre de personnes sur le site' };

export function regle(t) {
  if (t.mode_calcul === 'FORFAIT') return `${gnf(t.montant)} forfaitaire`;
  if (t.mode_calcul === 'TARIF_BASE') return `${gnf(t.tarif_unitaire)} × ${t.base_libelle}`;
  return (t.bareme || []).map((b) => `${b.categorie} : ${gnf(b.montant)}`).join(' · ');
}

export default function Taches() {
  const { donnees: taches, chargement, erreur, recharger } = useApi('/taches');
  const [edition, setEdition] = useState(null);
  const [erreurAction, setErreurAction] = useState(null);

  async function basculer(t) {
    try {
      await api(`/taches/${t.id}`, { methode: 'PATCH', corps: { actif: !t.actif } });
      recharger();
    } catch (e) { setErreurAction(e.message); }
  }

  return (
    <>
      <Entete titre="Tâches du service" sousTitre="Taxes et redevances perçues par le service. Ces paramètres descendent vers le mobile : l'agent voit directement le montant dû.">
        <button className="btn primaire" onClick={() => setEdition({})}><Plus size={15} /> Nouvelle tâche</button>
      </Entete>
      <div className="contenu">
        <Erreur message={erreurAction} />
        <Panneau sansMarge>
          <Etat chargement={chargement && !taches} erreur={erreur}>
            {taches?.length ? (
              <div className="defilement">
                <table className="tableau">
                  <thead>
                    <tr><th>Code budgétaire</th><th>Libellé</th><th>Règle de calcul</th><th>Fréquence</th><th className="num">Collecté cette année</th><th>Statut</th><th /></tr>
                  </thead>
                  <tbody>
                    {taches.map((t) => (
                      <tr key={t.id} style={t.actif ? undefined : { opacity: 0.6 }}>
                        <td><span className="mono">{t.ligne_code || '—'}</span>{t.ligne_libelle && <div className="petit texte-doux">{t.ligne_libelle}</div>}</td>
                        <td className="gras">{t.libelle}</td>
                        <td><Badge>{MODES_CALCUL[t.mode_calcul]}</Badge><div className="petit" style={{ marginTop: 4 }}>{regle(t)}</div></td>
                        <td>{FREQUENCES[t.frequence]}</td>
                        <td className="num">{gnf(t.montant_collecte)}<div className="petit texte-doux">{t.nb_paiements} encaissement(s)</div></td>
                        <td>{t.actif ? <Badge type="succes">Active</Badge> : <Badge>Désactivée</Badge>}</td>
                        <td>
                          <div className="ligne">
                            <button className="btn petit" onClick={() => setEdition(t)}>Modifier</button>
                            <button className="btn petit" onClick={() => basculer(t)}>{t.actif ? 'Désactiver' : 'Activer'}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Vide>Aucune tâche. Créez la première taxe que vos agents percevront.</Vide>}
          </Etat>
        </Panneau>
      </div>
      {edition && <ModalTache tache={edition} onFermer={() => setEdition(null)} onEnregistre={() => { setEdition(null); recharger(); }} />}
    </>
  );
}

function ModalTache({ tache, onFermer, onEnregistre }) {
  const nouvelle = !tache.id;
  const { donnees: lignes } = useApi('/lignes-recettes');
  const { donnees: champs } = useApi('/formulaire');
  const [f, setF] = useState({
    libelle: tache.libelle || '', ligne_code: tache.ligne_code || '', mode_calcul: tache.mode_calcul || 'FORFAIT',
    frequence: tache.frequence || 'JOURNALIERE', montant: tache.montant || '', tarif_unitaire: tache.tarif_unitaire || '',
    base_libelle: tache.base_libelle || '', base_champ: tache.base_champ || '',
    bareme: tache.bareme?.length ? tache.bareme : [{ categorie: '', montant: '' }],
  });
  const [erreur, setErreur] = useState(null);
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function choisirLigne(code) {
    const l = lignes?.find((x) => x.code === code);
    setF({ ...f, ligne_code: code, libelle: f.libelle || l?.libelle || '' });
  }

  async function enregistrer() {
    setErreur(null);
    try {
      const corps = { ...f, bareme: f.bareme.filter((b) => b.categorie) };
      if (nouvelle) await api('/taches', { methode: 'POST', corps });
      else await api(`/taches/${tache.id}`, { methode: 'PUT', corps });
      onEnregistre();
    } catch (e) { setErreur(e.message); }
  }

  const champsNombre = (champs || []).filter((c) => c.type === 'nombre');
  const lignesService = lignes?.filter((l) => l.du_service) ?? [];
  const autresLignes = lignes?.filter((l) => !l.du_service) ?? [];

  let apercu = '';
  if (f.mode_calcul === 'FORFAIT' && f.montant) apercu = `Chaque contribuable paie ${gnf(f.montant)}.`;
  if (f.mode_calcul === 'TARIF_BASE' && f.tarif_unitaire) apercu = `Exemple : 3 ${f.base_libelle || 'unités'} → ${gnf(3 * f.tarif_unitaire)}.`;
  if (f.mode_calcul === 'BAREME') apercu = 'L\'agent choisit la catégorie du contribuable ; le montant correspondant s\'affiche.';

  return (
    <Modal large titre={nouvelle ? 'Nouvelle tâche' : `Modifier — ${tache.libelle}`} onFermer={onFermer}
      pied={<><button className="btn" onClick={onFermer}>Annuler</button><button className="btn primaire" onClick={enregistrer}>Enregistrer</button></>}>
      <Erreur message={erreur} />
      <div className="formulaire" style={{ marginTop: erreur ? 12 : 0 }}>
        <Champ libelle="Ligne de recettes (code budgétaire)" pleine>
          <select value={f.ligne_code} onChange={(e) => choisirLigne(e.target.value)}>
            <option value="">— Choisir —</option>
            <optgroup label="Lignes attribuées au service">
              {lignesService.map((l) => <option key={l.code} value={l.code}>{l.code} — {l.libelle}</option>)}
            </optgroup>
            <optgroup label="Autres lignes">
              {autresLignes.map((l) => <option key={l.code} value={l.code}>{l.code} — {l.libelle}</option>)}
            </optgroup>
          </select>
        </Champ>
        <Champ libelle="Libellé affiché à l'agent et sur le reçu" pleine><input value={f.libelle} onChange={maj('libelle')} /></Champ>
        <Champ libelle="Règle de calcul">
          <select value={f.mode_calcul} onChange={maj('mode_calcul')}>
            {Object.entries(MODES_CALCUL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Champ>
        <Champ libelle="Fréquence de paiement">
          <select value={f.frequence} onChange={maj('frequence')}>
            {Object.entries(FREQUENCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Champ>

        {f.mode_calcul === 'FORFAIT' && (
          <Champ libelle="Montant (GNF)"><input type="number" min="0" value={f.montant} onChange={maj('montant')} /></Champ>
        )}

        {f.mode_calcul === 'TARIF_BASE' && (
          <>
            <Champ libelle="Tarif unitaire (GNF)"><input type="number" min="0" value={f.tarif_unitaire} onChange={maj('tarif_unitaire')} /></Champ>
            <Champ libelle="Unité de la base (m², étal, engin…)"><input value={f.base_libelle} onChange={maj('base_libelle')} /></Champ>
            <Champ libelle="Valeur de la base proposée à l'agent" pleine>
              <select value={f.base_champ} onChange={maj('base_champ')}>
                <option value="">Saisie par l'agent à chaque encaissement</option>
                {Object.entries(BASES_FICHE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                {champsNombre.map((c) => <option key={c.cle} value={`c:${c.cle}`}>{c.libelle} (formulaire du service)</option>)}
              </select>
            </Champ>
          </>
        )}

        {f.mode_calcul === 'BAREME' && (
          <div className="pleine">
            <div className="champ"><label>Barème par catégorie</label></div>
            {f.bareme.map((b, i) => (
              <div className="ligne" key={i} style={{ marginTop: 8 }}>
                <input style={{ flex: 2 }} placeholder="Catégorie" value={b.categorie}
                  onChange={(e) => setF({ ...f, bareme: f.bareme.map((x, j) => (j === i ? { ...x, categorie: e.target.value } : x)) })} />
                <input style={{ flex: 1 }} type="number" min="0" placeholder="Montant GNF" value={b.montant}
                  onChange={(e) => setF({ ...f, bareme: f.bareme.map((x, j) => (j === i ? { ...x, montant: e.target.value } : x)) })} />
                <button className="btn petit danger" onClick={() => setF({ ...f, bareme: f.bareme.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
              </div>
            ))}
            <button className="btn petit" style={{ marginTop: 8 }} onClick={() => setF({ ...f, bareme: [...f.bareme, { categorie: '', montant: '' }] })}>
              <Plus size={13} /> Ajouter une catégorie
            </button>
          </div>
        )}
        {apercu && <div className="alerte-boite info pleine">{apercu}</div>}
      </div>
    </Modal>
  );
}
