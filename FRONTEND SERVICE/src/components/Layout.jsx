import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardList, History, LayoutDashboard, ListChecks, LogOut, Receipt, ScanSearch, UserCog, Users, Wallet } from 'lucide-react';
import { useAuth } from '../auth.jsx';

const liens = [
  { groupe: 'Suivi' },
  { a: '/', libelle: 'Tableau de bord', icone: LayoutDashboard, exact: true },
  { a: '/encaissements', libelle: 'Encaissements', icone: Receipt },
  { a: '/clotures', libelle: 'Clôtures de caisse', icone: Wallet },
  { a: '/verifier-recu', libelle: 'Vérifier un reçu', icone: ScanSearch },
  { a: '/contribuables', libelle: 'Contribuables', icone: Users },
  { groupe: 'Paramétrage' },
  { a: '/agents', libelle: 'Agents', icone: UserCog },
  { a: '/taxes', libelle: 'Taxes', icone: ListChecks },
  { groupe: 'Traçabilité' },
  { a: '/journal', libelle: 'Journal', icone: History },
];

export default function Layout() {
  const { utilisateur, deconnecter } = useAuth();
  return (
    <div className="app">
      <aside className="barre-laterale">
        <div className="marque">
          <div className="drapeau"><span /><span /><span /></div>
          <div className="marque-titre">{utilisateur?.service?.nom}</div>
          <div className="marque-sous-titre">Commune de Lambanyi — Espace Service</div>
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
          <div className="ligne"><ClipboardList size={12} /> {utilisateur?.fonction || 'Responsable de service'}</div>
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
