import pg from 'pg';

// NUMERIC et BIGINT renvoyés comme nombres JS (montants en GNF sans décimales)
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
// DATE renvoyée telle quelle (AAAA-MM-JJ) pour éviter tout décalage de fuseau horaire
pg.types.setTypeParser(1082, (v) => v);

// En ligne (Render) : DATABASE_URL ; en local : variables PG* du fichier .env.
// SSL pour les bases hébergées (PGSSL=true, ou adresse externe Render).
const url = process.env.DATABASE_URL;
const ssl = process.env.PGSSL === 'true' || /\.render\.com/.test(url || '') ? { rejectUnauthorized: false } : false;

export const pool = new pg.Pool(url
  ? { connectionString: url, ssl, max: 10 }
  : {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl,
    max: 10,
  });

export const query = (text, params) => pool.query(text, params);

// Exécute `fn` dans une transaction et renvoie son résultat.
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultat = await fn(client);
    await client.query('COMMIT');
    return resultat;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Identifiant de la base : change quand la base est réinitialisée
export async function lireBaseId() {
  const { rows } = await pool.query("SELECT valeur FROM parametres WHERE cle = 'base_id'");
  return rows[0]?.valeur ?? null;
}

export async function journaliser(db, { utilisateurId, serviceId, action, entite, entiteId, details }) {
  await db.query(
    `INSERT INTO journal (utilisateur_id, service_id, application, action, entite, entite_id, details)
     VALUES ($1,$2,'MOBILE',$3,$4,$5,$6)`,
    [utilisateurId, serviceId, action, entite, entiteId, details ? JSON.stringify(details) : null]);
}
