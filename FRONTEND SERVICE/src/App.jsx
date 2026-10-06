import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Connexion from './pages/Connexion.jsx';
import TableauDeBord from './pages/TableauDeBord.jsx';
import Agents from './pages/Agents.jsx';
import Taxes from './pages/Taxes.jsx';
import Contribuables from './pages/Contribuables.jsx';
import Encaissements from './pages/Encaissements.jsx';
import Clotures from './pages/Clotures.jsx';
import Journal from './pages/Journal.jsx';

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
        <Route path="agents" element={<Agents />} />
        <Route path="taxes" element={<Taxes />} />
        <Route path="contribuables" element={<Contribuables />} />
        <Route path="encaissements" element={<Encaissements />} />
        <Route path="clotures" element={<Clotures />} />
        <Route path="journal" element={<Journal />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
