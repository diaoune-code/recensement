import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { query, lireBaseId } from './db.js';
import { exigerAgent } from './auth.js';
import authRoutes from './routes/auth.js';
import syncRoutes from './routes/sync.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '30mb' })); // les lots de synchronisation peuvent contenir des photos
app.use(morgan('dev'));

// Utilisé par le téléphone pour savoir si le serveur est joignable avant de synchroniser
app.get('/api/sante', async (_req, res) => {
  try {
    res.json({ statut: 'ok', application: 'mobile', heure: new Date().toISOString(), base_id: await lireBaseId() });
  } catch {
    res.status(503).json({ statut: 'base_indisponible' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api', exigerAgent, syncRoutes);

app.use((_req, res) => res.status(404).json({ message: 'Ressource introuvable' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Erreur interne du serveur' });
});

const port = Number(process.env.PORT || 4001);
// 0.0.0.0 : accessible depuis les téléphones du réseau local
app.listen(port, '0.0.0.0', () => console.log(`API mobile démarrée sur http://0.0.0.0:${port}`));
