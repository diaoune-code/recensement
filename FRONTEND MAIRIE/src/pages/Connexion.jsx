import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Champ, Erreur } from '../components/Ui.jsx';

export default function Connexion() {
  const { connecter } = useAuth();
  const navigate = useNavigate();
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await connecter(identifiant, motDePasse);
      navigate('/', { replace: true });
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="page-connexion">
      <div className="connexion-visuel">
        <div>
          <div className="drapeau"><span /><span /><span /></div>
          <div className="petit" style={{ opacity: 0.8 }}>République de Guinée</div>
          <h1>Mairie de Lambanyi<br />Pilotage des recettes communales</h1>
          <p>Montants collectés et contribuables recensés par chaque service, exécution du budget,
            fiches des contribuables et carte de couverture : une vue unique pour décider.</p>
        </div>
        <div className="petit" style={{ opacity: 0.6 }}>Application réservée au Maire, aux Vice-Maires et au pool financier.</div>
      </div>
      <div className="connexion-formulaire">
        <form onSubmit={soumettre}>
          <div>
            <h2>Connexion</h2>
            <div className="texte-doux" style={{ marginTop: 4 }}>Espace Mairie</div>
          </div>
          <Erreur message={erreur} />
          <Champ libelle="Identifiant">
            <input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoFocus required />
          </Champ>
          <Champ libelle="Mot de passe">
            <input type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required />
          </Champ>
          <button className="btn primaire" disabled={envoi} style={{ justifyContent: 'center', padding: '10px' }}>
            {envoi ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
