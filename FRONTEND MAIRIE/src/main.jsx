import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import App from './App.jsx';
import { FournisseurAuth } from './auth.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <FournisseurAuth>
        <App />
      </FournisseurAuth>
    </BrowserRouter>
  </React.StrictMode>,
);
