import { Router } from 'express';
import { query, transaction, journaliser, lireBaseId } from '../db.js';
import { asynchrone, CHAMPS_CONTRIBUABLE, nettoyer, UUID_RE } from '../outils.js';

const router = Router();

const fmtGNF = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/ | /g, ' ');

// Configuration envoyée au téléphone : service, formulaire, tâches paramétrées par le service, quartiers.
export async function chargerConfiguration(serviceId) {
  const [service, taches, quartiers] = await Promise.all([
    query('SELECT id, code, sigle, nom, champs FROM services WHERE id = $1', [serviceId]),
    query(`SELECT id, ligne_code, libelle, mode_calcul, montant, tarif_unitaire, base_libelle, base_champ, bareme, frequence
           FROM taches WHERE service_id = $1 AND actif ORDER BY libelle`, [serviceId]),
    query('SELECT nom, latitude, longitude FROM quartiers WHERE actif ORDER BY nom'),
  ]);
  return { service: service.rows[0], taches: taches.rows, quartiers: quartiers.rows };
}

router.get('/config', asynchrone(async (req, res) => {
  res.json(await chargerConfiguration(req.agent.service_id));
}));

// ---------------------------------------------------------------------------
// ENVOI : le téléphone transmet ce qu'il a saisi hors ligne.
// Chaque élément est traité indépendamment et de façon idempotente (UUID générés sur le téléphone) :
// un renvoi après une coupure réseau ne crée jamais de doublon.
// ---------------------------------------------------------------------------
async function recevoirContribuable(agent, c) {
  if (!UUID_RE.test(c.id || '')) return { id: c.id, statut: 'ERREUR', message: 'Identifiant invalide' };
  if (!c.nom) return { id: c.id, statut: 'ERREUR', message: 'Nom obligatoire' };

  return transaction(async (db) => {
    const { rows: [existant] } = await db.query('SELECT numero, updated_at FROM contribuables WHERE id = $1 FOR UPDATE', [c.id]);
    const valeurs = CHAMPS_CONTRIBUABLE.map((k) => (k === 'type_contribuable' ? c[k] || 'PERSONNE_PHYSIQUE' : nettoyer(c[k])));
    const complementService = c.complements?.[agent.sigle] ?? null;
    let numero;
    let statut = 'OK';

    if (!existant) {
      // Le contribuable est unique : on signale un doublon probable (même téléphone) sans bloquer l'agent.
      let doublon = null;
      if (c.telephone) {
        const { rows } = await db.query(
          'SELECT id FROM contribuables WHERE telephone = $1 AND id <> $2 ORDER BY created_at LIMIT 1', [c.telephone, c.id]);
        doublon = rows[0]?.id ?? null;
      }
      const cols = CHAMPS_CONTRIBUABLE.join(', ');
      const params = CHAMPS_CONTRIBUABLE.map((_, i) => `$${i + 1}`).join(', ');
      const n = CHAMPS_CONTRIBUABLE.length;
      const { rows: [ins] } = await db.query(
        `INSERT INTO contribuables (${cols}, id, numero, complements, service_id, agent_id, doublon_suspect_de, created_at, updated_at)
         VALUES (${params}, $${n + 1}, 'LBY-' || lpad(nextval('contribuable_numero_seq')::text, 6, '0'),
                 $${n + 2}, $${n + 3}, $${n + 4}, $${n + 5}, $${n + 6}, $${n + 7})
         RETURNING numero`,
        [...valeurs, c.id, JSON.stringify(complementService ? { [agent.sigle]: complementService } : {}),
          agent.service_id, agent.id, doublon, c.created_at || new Date(), c.updated_at || new Date()]);
      numero = ins.numero;
      if (doublon) statut = 'DOUBLON_SUSPECT';
      await journaliser(db, { utilisateurId: agent.id, serviceId: agent.service_id, action: 'RECENSEMENT',
        entite: 'contribuable', entiteId: c.id, details: { numero, nom: c.nom, doublon_suspect_de: doublon } });
    } else if (new Date(c.updated_at) > existant.updated_at) {
      // Fiche complétée par un autre service ou corrigée : la saisie la plus récente l'emporte,
      // et chaque service ne modifie que son propre bloc de compléments.
      const set = CHAMPS_CONTRIBUABLE.map((k, i) => `${k} = $${i + 1}`).join(', ');
      const n = CHAMPS_CONTRIBUABLE.length;
      await db.query(
        `UPDATE contribuables SET ${set},
           complements = CASE WHEN $${n + 1}::jsonb IS NULL THEN complements ELSE complements || $${n + 1}::jsonb END,
           updated_at = $${n + 2}, modifie_par = $${n + 3}, recu_le = now()
         WHERE id = $${n + 4}`,
        [...valeurs, complementService ? JSON.stringify({ [agent.sigle]: complementService }) : null,
          c.updated_at, agent.id, c.id]);
      numero = existant.numero;
      await journaliser(db, { utilisateurId: agent.id, serviceId: agent.service_id, action: 'MODIFICATION_FICHE',
        entite: 'contribuable', entiteId: c.id, details: { numero } });
    } else {
      numero = existant.numero;
      statut = 'DEJA_A_JOUR';
    }

    if (c.photo_base64) {
      await db.query(
        `INSERT INTO contribuable_photos (contribuable_id, image_base64) VALUES ($1, $2)
         ON CONFLICT (contribuable_id) DO UPDATE SET image_base64 = EXCLUDED.image_base64, updated_at = now()`,
        [c.id, c.photo_base64]);
    }
    return { id: c.id, numero, statut };
  });
}

async function recevoirPaiement(agent, p) {
  if (!UUID_RE.test(p.id || '')) return { id: p.id, statut: 'ERREUR', message: 'Identifiant invalide' };

  const { rows: [deja] } = await query('SELECT id FROM paiements WHERE id = $1', [p.id]);
  if (deja) return { id: p.id, statut: 'DEJA_RECU' };

  const { rows: [tache] } = await query('SELECT id, service_id, libelle FROM taches WHERE id = $1', [p.tache_id]);
  if (!tache || tache.service_id !== agent.service_id) {
    return { id: p.id, statut: 'ERREUR', message: 'Taxe inconnue ou hors du service de l\'agent' };
  }
  const { rows: [contrib] } = await query('SELECT numero, nom, prenoms FROM contribuables WHERE id = $1', [p.contribuable_id]);
  if (!contrib) return { id: p.id, statut: 'EN_ATTENTE', message: 'Contribuable pas encore reçu' };
  if (!(Number(p.montant) > 0)) return { id: p.id, statut: 'ERREUR', message: 'Montant invalide' };

  return transaction(async (db) => {
    const { rowCount } = await db.query(
      `INSERT INTO paiements (id, numero_recu, contribuable_id, tache_id, service_id, agent_id, montant, base_valeur,
         categorie, periode, mode_paiement, telephone_sms, latitude, longitude, date_paiement)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (numero_recu) DO NOTHING`,
      [p.id, p.numero_recu, p.contribuable_id, tache.id, agent.service_id, agent.id, p.montant, nettoyer(p.base_valeur),
        nettoyer(p.categorie), p.periode, p.mode_paiement || 'ESPECES', nettoyer(p.telephone_sms),
        nettoyer(p.latitude), nettoyer(p.longitude), p.date_paiement]);
    if (!rowCount) return { id: p.id, statut: 'ERREUR', message: `Numéro de reçu ${p.numero_recu} déjà utilisé` };

    // Reçu par SMS : simulé dans le prototype (enregistré, aucun opérateur branché)
    if (p.telephone_sms) {
      const message = `Commune de Lambanyi - ${agent.service_nom} - Recu ${p.numero_recu} : ${fmtGNF(p.montant)} GNF payes pour `
        + `${tache.libelle} (${p.periode}). Contribuable ${contrib.numero}.`;
      await db.query('INSERT INTO sms_envoyes (paiement_id, telephone, message) VALUES ($1,$2,$3)', [p.id, p.telephone_sms, message]);
    }
    await journaliser(db, { utilisateurId: agent.id, serviceId: agent.service_id, action: 'ENCAISSEMENT',
      entite: 'paiement', entiteId: p.id, details: { numero_recu: p.numero_recu, montant: p.montant, contribuable: contrib.numero } });
    return { id: p.id, statut: 'OK' };
  });
}

router.post('/sync/envoi', asynchrone(async (req, res) => {
  const { contribuables = [], paiements = [] } = req.body || {};
  const resultat = { contribuables: [], paiements: [] };

  // Les contribuables d'abord : les paiements y font référence.
  for (const c of contribuables) {
    try {
      resultat.contribuables.push(await recevoirContribuable(req.agent, c));
    } catch (e) {
      resultat.contribuables.push({ id: c.id, statut: 'ERREUR', message: e.message });
    }
  }
  for (const p of paiements) {
    try {
      resultat.paiements.push(await recevoirPaiement(req.agent, p));
    } catch (e) {
      resultat.paiements.push({ id: p.id, statut: 'ERREUR', message: e.message });
    }
  }
  res.json(resultat);
}));

// ---------------------------------------------------------------------------
// RÉCEPTION : le téléphone récupère ce qui a changé depuis sa dernière synchronisation.
// - tous les contribuables (la fiche est commune à tous les services, pour la recherche hors ligne)
// - les paiements de son service (pour savoir ce que chaque contribuable a déjà payé)
// - la configuration (formulaire, tâches, tarifs) que le service a pu modifier
// ---------------------------------------------------------------------------
router.get('/sync/reception', asynchrone(async (req, res) => {
  const depuis = req.query.depuis ? new Date(req.query.depuis) : new Date(0);
  if (Number.isNaN(depuis.getTime())) return res.status(400).json({ message: 'Paramètre « depuis » invalide' });

  // Horodatage pris AVANT les lectures : rien de ce qui arrive pendant la requête ne sera manqué.
  const { rows: [{ maintenant }] } = await query('SELECT now() AS maintenant');
  const champs = CHAMPS_CONTRIBUABLE.map((k) => `c.${k}`).join(', ');

  const [contribuables, paiements, config] = await Promise.all([
    query(
      `SELECT c.id, c.numero, ${champs}, c.complements, c.service_id, c.created_at, c.updated_at,
              (p.contribuable_id IS NOT NULL) AS a_photo
       FROM contribuables c LEFT JOIN contribuable_photos p ON p.contribuable_id = c.id
       WHERE c.recu_le > $1 ORDER BY c.recu_le LIMIT 5000`, [depuis]),
    query(
      `SELECT p.id, p.numero_recu, p.contribuable_id, p.tache_id, p.agent_id, p.montant, p.base_valeur, p.categorie,
              p.periode, p.mode_paiement, p.date_paiement, p.statut
       FROM paiements p
       WHERE p.service_id = $1 AND p.recu_le > $2 AND p.date_paiement > now() - interval '400 days'
       ORDER BY p.recu_le LIMIT 10000`, [req.agent.service_id, depuis]),
    chargerConfiguration(req.agent.service_id),
  ]);

  res.json({ base_id: await lireBaseId(), horodatage: maintenant, contribuables: contribuables.rows, paiements: paiements.rows, config });
}));

// Photo d'un contribuable (téléchargée à la demande, hors synchronisation)
router.get('/contribuables/:id/photo', asynchrone(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide' });
  const { rows } = await query('SELECT image_base64 FROM contribuable_photos WHERE contribuable_id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Aucune photo' });
  res.json({ image_base64: rows[0].image_base64 });
}));

export default router;
