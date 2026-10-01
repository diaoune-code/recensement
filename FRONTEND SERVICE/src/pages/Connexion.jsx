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
          <div className="petit" style={{ opacity: 0.8 }}>Commune de Lambanyi</div>
          <h1>Espace Service<br />Pilotage des agents et des taxes</h1>
          <p>Inscrivez vos agents, paramétrez les taxes et redevances que vous percevez, suivez les encaissements
            par agent, par jour et par quartier, et validez chaque soir les caisses de vos agents.</p>
        </div>
        <div className="petit" style={{ opacity: 0.6 }}>Les paramètres définis ici sont envoyés automatiquement sur les téléphones de vos agents.</div>
      </div>
      <div className="connexion-formulaire">
        <form onSubmit={soumettre}>
          <div>
            <h2>Connexion</h2>
            <div className="texte-doux" style={{ marginTop: 4 }}>Responsable de service</div>
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
