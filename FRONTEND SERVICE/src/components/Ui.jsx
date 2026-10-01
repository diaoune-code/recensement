import { useState } from 'react';
import { X } from 'lucide-react';
import { isoJour } from '../format.js';

export function CarteStat({ icone: Icone, libelle, valeur, detail, couleur }) {
  return (
    <div className="carte-stat">
      {Icone && (
        <div className="icone" style={couleur ? { background: `${couleur}1a`, color: couleur } : undefined}>
          <Icone size={20} />
        </div>
      )}
      <div>
        <div className="libelle">{libelle}</div>
        <div className="valeur">{valeur}</div>
        {detail && <div className="detail">{detail}</div>}
      </div>
    </div>
  );
}

export function Panneau({ titre, aide, actions, children, sansMarge }) {
  return (
    <section className="panneau">
      {(titre || actions) && (
        <div className="panneau-entete">
          <div>
            <h2>{titre}</h2>
            {aide && <div className="aide">{aide}</div>}
          </div>
          {actions && <div className="ligne">{actions}</div>}
        </div>
      )}
      <div className={`panneau-corps ${sansMarge ? 'sans-marge' : ''}`}>{children}</div>
    </section>
  );
}

export const Badge = ({ type = '', children }) => <span className={`badge ${type}`}>{children}</span>;

export const Chargement = () => <div className="chargement">Chargement…</div>;
export const Vide = ({ children = 'Aucune donnée' }) => <div className="vide">{children}</div>;
export const Erreur = ({ message }) => (message ? <div className="alerte-boite erreur">{message}</div> : null);

export function Etat({ chargement, erreur, children }) {
  if (erreur) return <div className="panneau-corps"><Erreur message={erreur} /></div>;
  if (chargement) return <Chargement />;
  return children;
}

export function Modal({ titre, onFermer, children, pied, large }) {
  return (
    <div className="modal-fond" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className={`modal ${large ? 'large' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-entete">
          <h2>{titre}</h2>
          <button className="fermer" onClick={onFermer} aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="modal-corps">{children}</div>
        {pied && <div className="modal-pied">{pied}</div>}
      </div>
    </div>
  );
}

export function Pagination({ page, taille, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / taille));
  return (
    <div className="pagination">
      <span>{total} résultat{total > 1 ? 's' : ''} — page {page} sur {pages}</span>
      <div className="boutons">
        <button className="btn petit" disabled={page <= 1} onClick={() => onPage(page - 1)}>Précédent</button>
        <button className="btn petit" disabled={page >= pages} onClick={() => onPage(page + 1)}>Suivant</button>
      </div>
    </div>
  );
}

export function BarreProgression({ valeur }) {
  const v = Math.max(0, Math.min(100, valeur));
  const type = valeur >= 75 ? 'succes' : valeur >= 40 ? '' : valeur >= 15 ? 'alerte' : 'danger';
  return <div className={`barre-progression ${type}`}><div style={{ width: `${v}%` }} /></div>;
}

// Sélecteur de période : renvoie { du, au } au format AAAA-MM-JJ
export function usePeriode(jours = 30) {
  const [periode, setPeriode] = useState(() => {
    const au = new Date();
    const du = new Date(au.getTime() - (jours - 1) * 86400000);
    return { du: isoJour(du), au: isoJour(au) };
  });
  return [periode, setPeriode];
}

export function FiltrePeriode({ periode, onChange }) {
  const raccourci = (jours) => {
    const au = new Date();
    onChange({ du: isoJour(new Date(au.getTime() - (jours - 1) * 86400000)), au: isoJour(au) });
  };
  const debutAnnee = () => {
    const au = new Date();
    onChange({ du: `${au.getFullYear()}-01-01`, au: isoJour(au) });
  };
  return (
    <div className="barre-filtres">
      <button className="btn petit" onClick={() => raccourci(1)}>Aujourd'hui</button>
      <button className="btn petit" onClick={() => raccourci(7)}>7 jours</button>
      <button className="btn petit" onClick={() => raccourci(30)}>30 jours</button>
      <button className="btn petit" onClick={debutAnnee}>Année</button>
      <input type="date" value={periode.du} max={periode.au} onChange={(e) => onChange({ ...periode, du: e.target.value })} />
      <span className="texte-doux">au</span>
      <input type="date" value={periode.au} min={periode.du} onChange={(e) => onChange({ ...periode, au: e.target.value })} />
    </div>
  );
}

export function Champ({ libelle, children, pleine }) {
  return (
    <div className={`champ ${pleine ? 'pleine' : ''}`}>
      <label>{libelle}</label>
      {children}
    </div>
  );
}
