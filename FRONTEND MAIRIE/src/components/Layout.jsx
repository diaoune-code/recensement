import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, Building2, ClipboardCheck, LayoutDashboard, LogOut, Map, Scale, Users } from 'lucide-react';
import { useAuth } from '../auth.jsx';

const liens = [
  { groupe: 'Pilotage' },
  { a: '/', libelle: 'Tableau de bord', icone: LayoutDashboard, exact: true },
  { a: '/prevu-collecte', libelle: 'Prévu / collecté', icone: BarChart3 },
  { groupe: 'Assiette fiscale' },
  { a: '/contribuables', libelle: 'Contribuables', icone: Users },
  { a: '/carte', libelle: 'Carte', icone: Map },
  { groupe: 'Administration' },
  { a: '/services', libelle: 'Services', icone: Building2 },
  { a: '/referentiel', libelle: 'Référentiel', icone: Scale },
  { a: '/controle', libelle: 'Contrôle', icone: ClipboardCheck },
];

export default function Layout() {
  const { utilisateur, deconnecter } = useAuth();
  return (
    <div className="app">
      <aside className="barre-laterale">
        <div className="marque">
          <div className="drapeau"><span /><span /><span /></div>
          <div className="marque-titre">Mairie de Lambanyi</div>
          <div className="marque-sous-titre">Recensement et collecte des recettes</div>
        </div>
        <nav className="navigation">
          {liens.map((l) => (l.groupe
            ? <div key={l.groupe} className="groupe">{l.groupe}</div>
            : (
              <NavLink key={l.a} to={l.a} end={l.exact}>
                <l.icone size={17} /> {l.libelle}
              </NavLink>
            )))}
        </nav>
        <div className="pied-barre">
          <div className="nom">{utilisateur?.nom} {utilisateur?.prenoms}</div>
          <div>{utilisateur?.fonction || 'Mairie'}</div>
          <button className="btn fantome petit" onClick={deconnecter}><LogOut size={14} /> Se déconnecter</button>
        </div>
      </aside>
      <main className="principal">
        <Outlet />
      </main>
    </div>
  );
}

export function Entete({ titre, sousTitre, children }) {
  return (
    <header className="entete">
      <div>
        <h1>{titre}</h1>
        {sousTitre && <div className="sous-titre">{sousTitre}</div>}
      </div>
      {children}
    </header>
  );
}
