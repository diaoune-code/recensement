import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { query } from './db.js';
import { exigerChef } from './auth.js';
import authRoutes from './routes/auth.js';
import agentsRoutes from './routes/agents.js';
import parametrageRoutes from './routes/parametrage.js';
import suiviRoutes from './routes/suivi.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/api/sante', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ statut: 'ok', application: 'service' });
  } catch {
    res.status(503).json({ statut: 'base_indisponible' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api', exigerChef, agentsRoutes, parametrageRoutes, suiviRoutes);

// En ligne : les pages web compilées (FRONTEND SERVICE/dist) sont servies à la même adresse que l'API
const dist = process.env.FRONTEND_DIST || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../FRONTEND SERVICE/dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((_req, res) => res.status(404).json({ message: 'Ressource introuvable' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.statut) return res.status(err.statut).json({ message: err.message });
  if (err.code === '23505') return res.status(409).json({ message: 'Cette valeur existe déjà (identifiant en double ?)' });
  if (err.code === '23503') return res.status(409).json({ message: 'Référence invalide' });
  console.error(err);
  res.status(500).json({ message: 'Erreur interne du serveur' });
});

const port = Number(process.env.PORT || 4003);
app.listen(port, () => console.log(`API Service démarrée sur http://localhost:${port}`));
