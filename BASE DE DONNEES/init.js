// Initialise la base PostgreSQL de la commune :
//   node init.js            -> crée la base si besoin, applique le schéma, charge le référentiel réel
//                              (services et lignes de recettes du classeur) et le compte administrateur « maire »
//   node init.js --demo     -> idem + comptes, quartiers, tâches, contribuables et paiements FICTIFS
//   node init.js --reset    -> supprime et recrée toutes les tables (ATTENTION : efface toutes les données)
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { services, quartiers, taches, utilisateurs } from './donnees/referentiel.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
// Base hébergée (Render…) : DATABASE_URL, déjà créée par l'hébergeur ; sinon PostgreSQL local (variables PG*)
const URL_BASE = process.env.DATABASE_URL;
const cfg = URL_BASE
  ? { connectionString: URL_BASE, ssl: { rejectUnauthorized: false } }
  : {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'lambanyi_db',
  };
const MOT_DE_PASSE_DEMO = process.env.MOT_DE_PASSE_DEMO || 'lambanyi2026';
const MOT_DE_PASSE_ADMIN = process.env.MOT_DE_PASSE_ADMIN || MOT_DE_PASSE_DEMO;

async function creerBaseSiAbsente() {
  const admin = new pg.Client({ ...cfg, database: 'postgres' });
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [cfg.database]);
  if (!rowCount) {
    await admin.query(`CREATE DATABASE "${cfg.database}" ENCODING 'UTF8'`);
    console.log(`Base « ${cfg.database} » créée.`);
  }
  await admin.end();
}

async function reset(db) {
  await db.query(`DROP TABLE IF EXISTS journal, sms_envoyes, paiements, clotures, contribuable_photos,
    contribuables, taches, utilisateurs, lignes_recettes, quartiers, services, parametres CASCADE;
    DROP SEQUENCE IF EXISTS contribuable_numero_seq;`);
  console.log('Tables supprimées.');
}

async function chargerReferentiel(db) {
  for (const s of services) {
    await db.query(
      `INSERT INTO services (code, sigle, nom, champs) VALUES ($1,$2,$3,$4)
       ON CONFLICT (code) DO NOTHING`,
      [s.code, s.sigle, s.nom, JSON.stringify(s.champs || [])]);
  }
  const lignes = JSON.parse(fs.readFileSync(path.join(dir, 'donnees', 'lignes_recettes.json'), 'utf8'));
  for (const l of lignes) {
    await db.query(
      `INSERT INTO lignes_recettes (code, libelle, niveau, parent_code, service_id, service_indique, prevision_2025)
       VALUES ($1,$2,$3,$4,(SELECT id FROM services WHERE code = $5),$6,$7)
       ON CONFLICT (code) DO NOTHING`,
      [l.code, l.libelle, l.niveau, l.parent_code, l.service_code, l.service_indique, l.prevision_2025]);
  }

  // Seul compte créé d'office : l'administrateur Mairie, qui crée ensuite les responsables de service
  await db.query(
    `INSERT INTO utilisateurs (identifiant, nom, prenoms, role, fonction, mot_de_passe_hash)
     VALUES ('maire', 'Maire', 'Commune de Lambanyi', 'MAIRIE', 'Maire', $1)
     ON CONFLICT (identifiant) DO NOTHING`,
    [await bcrypt.hash(MOT_DE_PASSE_ADMIN, 10)]);

  // Identifiant de cette base : les téléphones vident leur copie locale s'il change (base réinitialisée)
  await db.query(`INSERT INTO parametres (cle, valeur) VALUES ('base_id', gen_random_uuid()::text) ON CONFLICT (cle) DO NOTHING`);

  console.log(`Référentiel : ${services.length} services, ${lignes.length} lignes de recettes, compte « maire ».`);
}

// Comptes, quartiers et tâches FICTIFS : uniquement avec --demo
async function chargerReferentielDemo(db) {
  for (const q of quartiers) {
    await db.query(
      'INSERT INTO quartiers (nom, latitude, longitude) VALUES ($1,$2,$3) ON CONFLICT (nom) DO NOTHING',
      [q.nom, q.latitude, q.longitude]);
  }

  const hash = await bcrypt.hash(MOT_DE_PASSE_DEMO, 10);
  for (const u of utilisateurs) {
    await db.query(
      `INSERT INTO utilisateurs (identifiant, nom, prenoms, telephone, role, fonction, service_id, mot_de_passe_hash)
       VALUES ($1,$2,$3,$4,$5,$6,(SELECT id FROM services WHERE sigle = $7),$8)
       ON CONFLICT (identifiant) DO NOTHING`,
      [u.identifiant, u.nom, u.prenoms, u.telephone || null, u.role, u.fonction || null, u.sigle || null, hash]);
  }

  const { rows: [{ n }] } = await db.query('SELECT count(*)::int AS n FROM taches');
  if (n === 0) {
    for (const t of taches) {
      await db.query(
        `INSERT INTO taches (service_id, ligne_code, libelle, mode_calcul, montant, tarif_unitaire,
                             base_libelle, base_champ, bareme, frequence)
         VALUES ((SELECT id FROM services WHERE sigle = $1),$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [t.sigle, t.ligne, t.libelle, t.mode_calcul, t.montant ?? null, t.tarif_unitaire ?? null,
          t.base_libelle ?? null, t.base_champ ?? null, JSON.stringify(t.bareme || []), t.frequence]);
    }
  }
  console.log(`Démonstration : ${quartiers.length} quartiers, ${taches.length} tâches, ${utilisateurs.length} comptes fictifs.`);
}

// ---------------------------------------------------------------------------
// Données de démonstration : pour voir les tableaux de bord remplis dès le départ
// ---------------------------------------------------------------------------
function periode(frequence, d) {
  const iso = d.toISOString();
  if (frequence === 'JOURNALIERE') return iso.slice(0, 10);
  if (frequence === 'MENSUELLE') return iso.slice(0, 7);
  if (frequence === 'ANNUELLE') return iso.slice(0, 4);
  return 'UNIQUE';
}

async function chargerDemo(db) {
  const { rows: [{ n }] } = await db.query('SELECT count(*)::int AS n FROM contribuables');
  if (n > 0) { console.log('Données de démonstration déjà présentes.'); return; }

  let graine = 42;
  const alea = () => { graine = (graine * 16807) % 2147483647; return (graine - 1) / 2147483646; };
  const choix = (t) => t[Math.floor(alea() * t.length)];

  const noms = ['Diallo', 'Bah', 'Camara', 'Sylla', 'Soumah', 'Condé', 'Keïta', 'Touré', 'Barry', 'Sow', 'Kouyaté', 'Cissé', 'Bangoura', 'Kaba', 'Fofana'];
  const prenoms = ['Mamadou', 'Fatoumata', 'Ibrahima', 'Mariama', 'Alpha', 'Aminata', 'Ousmane', 'Kadiatou', 'Sékou', 'Hawa', 'Moussa', 'Djénabou', 'Lansana', 'Aïssatou'];
  const marches = ['Marché de Lambanyi', 'Marché de Kobaya', 'Marché de Sonfonia'];

  const { rows: qs } = await db.query('SELECT nom, latitude::float AS lat, longitude::float AS lon FROM quartiers');
  const { rows: agents } = await db.query(
    `SELECT u.id, u.identifiant, u.service_id, s.sigle FROM utilisateurs u JOIN services s ON s.id = u.service_id
     WHERE u.role = 'AGENT'`);
  const { rows: tachesBd } = await db.query('SELECT * FROM taches');

  const maintenant = Date.now();
  const compteurs = {};
  let nbC = 0, nbP = 0;

  for (let i = 0; i < 60; i++) {
    const agent = agents[i % agents.length];
    const q = choix(qs);
    const cree = new Date(maintenant - Math.floor(alea() * 30) * 86400000 - Math.floor(alea() * 8) * 3600000);
    const id = crypto.randomUUID();
    const estMarche = agent.sigle === 'PF';
    const complements = {};
    if (agent.sigle === 'CAD') complements.CAD = { type_bien: choix(['Bâtiment achevé', 'Bâtiment en construction']), usage: choix(['Habitation', 'Commerce', 'Mixte']), surface_parcelle: 300 + Math.floor(alea() * 400), surface_batie: 80 + Math.floor(alea() * 150) };
    if (agent.sigle === 'TRA') complements.TRA = { type_engin: choix(['Tricycle', 'Charrette', 'Taxi']), nb_engins: 1 + Math.floor(alea() * 3) };
    if (agent.sigle === 'ELV') complements.ELV = { espece: choix(['Bovins', 'Ovins', 'Caprins']), nb_tetes: 5 + Math.floor(alea() * 30) };
    if (estMarche) complements.PF = { type_emplacement: choix(['Étal / table', 'Kiosque', 'Stand']) };

    await db.query(
      `INSERT INTO contribuables (id, numero, nom, prenoms, sexe, telephone, statut_fiscal, type_site, quartier, secteur,
         nom_marche, numero_etal, latitude, longitude, precision_gps, activite_principale, forme_point, surface_m2, nb_etals,
         complements, service_id, agent_id, created_at, updated_at)
       VALUES ($1,'LBY-' || lpad(nextval('contribuable_numero_seq')::text, 6, '0'),$2,$3,$4,$5,'INFORMEL',$6,$7,$8,$9,$10,$11,$12,8,$13,$14,$15,$16,$17,$18,$19,$20,$20)`,
      [id, choix(noms), choix(prenoms), choix(['Homme', 'Femme']), '62' + String(1000000 + Math.floor(alea() * 8999999)),
        estMarche ? 'Marché / emplacement commercial' : (agent.sigle === 'CAD' ? 'Bien foncier' : 'Lieu d\'activité économique'),
        q.nom, 'Secteur ' + (1 + Math.floor(alea() * 5)),
        estMarche ? choix(marches) : null, estMarche ? `A-${1 + Math.floor(alea() * 120)}` : null,
        q.lat + (alea() - 0.5) * 0.012, q.lon + (alea() - 0.5) * 0.012,
        estMarche ? 'Commerce de détail' : choix(['Commerce de détail', 'Transport', 'Artisanat', 'Restauration / débit de boissons']),
        estMarche ? 'Étal / table de marché' : choix(['Boutique en dur', 'Hangar / atelier', 'Kiosque']),
        5 + Math.floor(alea() * 40), estMarche ? 1 + Math.floor(alea() * 3) : null,
        JSON.stringify(complements), agent.service_id, agent.id, cree]);
    nbC++;

    // Quelques encaissements sur les tâches du service de l'agent
    const tachesAgent = tachesBd.filter((t) => t.service_id === agent.service_id);
    const nbPaiements = tachesAgent.length ? 1 + Math.floor(alea() * 4) : 0;
    const dejaPaye = new Set();
    for (let k = 0; k < nbPaiements; k++) {
      const t = choix(tachesAgent);
      const date = new Date(cree.getTime() + Math.floor(alea() * ((maintenant - cree.getTime()) / 3600000)) * 3600000);
      const per = periode(t.frequence, date);
      if (dejaPaye.has(t.id + per)) continue;
      dejaPaye.add(t.id + per);
      let montant, base = null, categorie = null;
      if (t.mode_calcul === 'FORFAIT') montant = Number(t.montant);
      else if (t.mode_calcul === 'BAREME') { const b = choix(t.bareme); categorie = b.categorie; montant = b.montant; }
      else { base = 1 + Math.floor(alea() * 20); montant = base * Number(t.tarif_unitaire); }
      const jour = date.toISOString().slice(0, 10).replace(/-/g, '');
      const cle = agent.identifiant + jour;
      compteurs[cle] = (compteurs[cle] || 0) + 1;
      await db.query(
        `INSERT INTO paiements (id, numero_recu, contribuable_id, tache_id, service_id, agent_id, montant, base_valeur,
           categorie, periode, mode_paiement, date_paiement)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [crypto.randomUUID(), `${agent.identifiant}-${jour}-${String(compteurs[cle]).padStart(4, '0')}`, id, t.id,
          agent.service_id, agent.id, montant, base, categorie, per, alea() < 0.85 ? 'ESPECES' : 'MOBILE_MONEY', date]);
      nbP++;
    }
  }
  console.log(`Démonstration : ${nbC} contribuables et ${nbP} paiements créés.`);
}

async function main() {
  if (!URL_BASE && !cfg.password) {
    console.error('PGPASSWORD manquant : copiez .env.example en .env et renseignez le mot de passe PostgreSQL.');
    process.exit(1);
  }
  if (!URL_BASE) await creerBaseSiAbsente();
  const db = new pg.Client(cfg);
  await db.connect();
  try {
    if (args.has('--reset')) await reset(db);
    await db.query(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'));
    console.log('Schéma appliqué.');
    await chargerReferentiel(db);
    if (args.has('--demo')) {
      await chargerReferentielDemo(db);
      await chargerDemo(db);
    }
    console.log('Terminé. Compte administrateur : maire (mot de passe : MOT_DE_PASSE_ADMIN du fichier .env).');
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error('Échec de l\'initialisation :', e.message); process.exit(1); });
