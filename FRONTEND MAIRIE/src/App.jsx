import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Connexion from './pages/Connexion.jsx';
import TableauDeBord from './pages/TableauDeBord.jsx';
import PrevuCollecte from './pages/PrevuCollecte.jsx';
import Contribuables from './pages/Contribuables.jsx';
import ContribuableDetail from './pages/ContribuableDetail.jsx';
import Carte from './pages/Carte.jsx';
import Services from './pages/Services.jsx';
import Referentiel from './pages/Referentiel.jsx';
import Controle from './pages/Controle.jsx';

export default function App() {
  const { session } = useAuth();
  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Connexion />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<TableauDeBord />} />
        <Route path="prevu-collecte" element={<PrevuCollecte />} />
        <Route path="contribuables" element={<Contribuables />} />
        <Route path="contribuables/:id" element={<ContribuableDetail />} />
        <Route path="carte" element={<Carte />} />
        <Route path="services" element={<Services />} />
        <Route path="referentiel" element={<Referentiel />} />
        <Route path="controle" element={<Controle />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
