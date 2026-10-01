-- =====================================================================
--  Base de données de la Commune de Lambanyi
--  Recensement des contribuables et collecte des taxes et redevances
--  Base unique partagée par : application mobile, web Mairie, web Service
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Paramètres techniques. « base_id » change à chaque réinitialisation de la base :
-- les téléphones le comparent pour savoir s'ils doivent vider leur copie locale.
CREATE TABLE IF NOT EXISTS parametres (
    cle    VARCHAR(50) PRIMARY KEY,
    valeur TEXT NOT NULL
);

-- ---------------------------------------------------------------------
-- Référentiel (géré par la Mairie)
-- ---------------------------------------------------------------------

-- Services collecteurs. `code` = numéro du service dans le classeur des lignes de recettes.
CREATE TABLE IF NOT EXISTS services (
    id          SERIAL PRIMARY KEY,
    code        INTEGER      NOT NULL UNIQUE,
    sigle       VARCHAR(10)  NOT NULL UNIQUE,
    nom         VARCHAR(150) NOT NULL,
    -- Champs propres au service, affichés dans le formulaire mobile.
    -- Format : [{ "cle": "nb_engins", "libelle": "Nombre d'engins", "type": "nombre|texte|choix", "options": [...] }]
    champs      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    actif       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quartiers (
    id          SERIAL PRIMARY KEY,
    nom         VARCHAR(100) NOT NULL UNIQUE,
    latitude    NUMERIC(9,6),
    longitude   NUMERIC(9,6),
    actif       BOOLEAN NOT NULL DEFAULT TRUE
);

-- Nomenclature budgétaire (chapitre > article > paragraphe > sous-paragraphe)
CREATE TABLE IF NOT EXISTS lignes_recettes (
    code             VARCHAR(10)  PRIMARY KEY,
    libelle          VARCHAR(255) NOT NULL,
    niveau           VARCHAR(20)  NOT NULL CHECK (niveau IN ('chapitre','article','paragraphe','sous_paragraphe')),
    parent_code      VARCHAR(10)  REFERENCES lignes_recettes(code),
    service_id       INTEGER      REFERENCES services(id),
    service_indique  VARCHAR(150),            -- libellé du service tel qu'écrit dans le classeur
    prevision_2025   BIGINT                    -- prévisions primitives du budget 2025 (GNF)
);

-- ---------------------------------------------------------------------
-- Utilisateurs : Mairie, chefs de service, agents de terrain
-- Règle « un agent, un service » : service_id obligatoire pour CHEF_SERVICE et AGENT.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS utilisateurs (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifiant        VARCHAR(50)  NOT NULL UNIQUE,
    nom                VARCHAR(100) NOT NULL,
    prenoms            VARCHAR(150),
    telephone          VARCHAR(30),
    role               VARCHAR(20)  NOT NULL CHECK (role IN ('MAIRIE','CHEF_SERVICE','AGENT')),
    fonction           VARCHAR(100),
    service_id         INTEGER REFERENCES services(id),
    mot_de_passe_hash  VARCHAR(100) NOT NULL,
    actif              BOOLEAN NOT NULL DEFAULT TRUE,
    derniere_connexion TIMESTAMPTZ,
    cree_par           UUID REFERENCES utilisateurs(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT utilisateur_service_requis CHECK (role = 'MAIRIE' OR service_id IS NOT NULL)
);

-- ---------------------------------------------------------------------
-- Tâches : taxes et redevances perçues par un service, paramétrées par lui
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taches (
    id              SERIAL PRIMARY KEY,
    service_id      INTEGER      NOT NULL REFERENCES services(id),
    ligne_code      VARCHAR(10)  REFERENCES lignes_recettes(code),
    libelle         VARCHAR(200) NOT NULL,
    mode_calcul     VARCHAR(15)  NOT NULL CHECK (mode_calcul IN ('FORFAIT','TARIF_BASE','BAREME')),
    montant         NUMERIC(14,0),          -- FORFAIT
    tarif_unitaire  NUMERIC(14,0),          -- TARIF_BASE : montant = tarif × base
    base_libelle    VARCHAR(50),            -- ex. « m² », « étal », « engin »
    -- Donnée de la fiche qui fournit la base : surface_m2, nb_etals, nb_personnes, ou c:<clé du champ service>
    base_champ      VARCHAR(60),
    bareme          JSONB NOT NULL DEFAULT '[]'::jsonb,   -- BAREME : [{ "categorie": "...", "montant": 0 }]
    frequence       VARCHAR(15)  NOT NULL CHECK (frequence IN ('JOURNALIERE','MENSUELLE','ANNUELLE','UNIQUE')),
    actif           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_taches_service ON taches(service_id);

-- ---------------------------------------------------------------------
-- Contribuables : fiche UNIQUE partagée par tous les services
-- L'identifiant est généré sur le téléphone (UUID) pour permettre la saisie hors ligne.
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS contribuable_numero_seq;

CREATE TABLE IF NOT EXISTS contribuables (
    id                   UUID PRIMARY KEY,
    numero               VARCHAR(20) UNIQUE,      -- attribué par le serveur à la réception : LBY-000001
    type_contribuable    VARCHAR(40) NOT NULL DEFAULT 'PERSONNE_PHYSIQUE',
    nom                  VARCHAR(100) NOT NULL,
    prenoms              VARCHAR(150),
    raison_sociale       VARCHAR(200),
    sexe                 VARCHAR(15),
    date_naissance       DATE,
    nationalite          VARCHAR(60),
    piece_type           VARCHAR(40),
    piece_numero         VARCHAR(60),
    telephone            VARCHAR(30),
    telephone2           VARCHAR(30),
    email                VARCHAR(120),
    statut_fiscal        VARCHAR(20),             -- FORMEL / INFORMEL / NON_VERIFIE
    nif                  VARCHAR(40),
    rccm                 VARCHAR(40),
    -- Localisation
    type_site            VARCHAR(60),
    quartier             VARCHAR(100),
    secteur              VARCHAR(100),
    rue                  VARCHAR(150),
    numero_porte         VARCHAR(40),             -- n° de porte / concession
    nom_marche           VARCHAR(100),
    numero_etal          VARCHAR(40),
    latitude             NUMERIC(9,6),
    longitude            NUMERIC(9,6),
    precision_gps        NUMERIC(8,1),
    repere               TEXT,
    -- Activité économique
    activite_principale  VARCHAR(80),
    description_activite TEXT,
    forme_point          VARCHAR(60),
    occupation           VARCHAR(60),
    surface_m2           NUMERIC(10,2),
    nb_etals             INTEGER,
    nb_personnes         INTEGER,
    -- Compléments propres à chaque service : { "CAD": {...}, "PF": {...} }
    complements          JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Traçabilité
    service_id           INTEGER NOT NULL REFERENCES services(id),   -- service qui a recensé
    agent_id             UUID    NOT NULL REFERENCES utilisateurs(id),
    modifie_par          UUID    REFERENCES utilisateurs(id),
    doublon_suspect_de   UUID    REFERENCES contribuables(id),
    created_at           TIMESTAMPTZ NOT NULL,                       -- heure de saisie sur le terrain
    updated_at           TIMESTAMPTZ NOT NULL,
    recu_le              TIMESTAMPTZ NOT NULL DEFAULT now()          -- dernière écriture côté serveur (sert à la synchro)
);
CREATE INDEX IF NOT EXISTS idx_contrib_recu_le   ON contribuables(recu_le);
CREATE INDEX IF NOT EXISTS idx_contrib_telephone ON contribuables(telephone);
CREATE INDEX IF NOT EXISTS idx_contrib_nom       ON contribuables(lower(nom));
CREATE INDEX IF NOT EXISTS idx_contrib_quartier  ON contribuables(quartier);
CREATE INDEX IF NOT EXISTS idx_contrib_updated   ON contribuables(updated_at);

CREATE TABLE IF NOT EXISTS contribuable_photos (
    contribuable_id UUID PRIMARY KEY REFERENCES contribuables(id) ON DELETE CASCADE,
    image_base64    TEXT NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Clôtures journalières de caisse (par agent, validées par le chef de service)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clotures (
    id               SERIAL PRIMARY KEY,
    agent_id         UUID    NOT NULL REFERENCES utilisateurs(id),
    service_id       INTEGER NOT NULL REFERENCES services(id),
    jour             DATE    NOT NULL,
    nb_paiements     INTEGER NOT NULL,
    montant_collecte NUMERIC(14,0) NOT NULL,
    montant_reverse  NUMERIC(14,0) NOT NULL,
    ecart            NUMERIC(14,0) GENERATED ALWAYS AS (montant_reverse - montant_collecte) STORED,
    statut           VARCHAR(15) NOT NULL CHECK (statut IN ('VALIDEE','REJETEE')),
    commentaire      TEXT,
    validee_par      UUID NOT NULL REFERENCES utilisateurs(id),
    validee_le       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (agent_id, jour)
);

-- ---------------------------------------------------------------------
-- Paiements (encaissements). Identifiant et n° de reçu générés hors ligne sur le téléphone.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paiements (
    id               UUID PRIMARY KEY,
    numero_recu      VARCHAR(40) NOT NULL UNIQUE,
    contribuable_id  UUID    NOT NULL REFERENCES contribuables(id),
    tache_id         INTEGER NOT NULL REFERENCES taches(id),
    service_id       INTEGER NOT NULL REFERENCES services(id),
    agent_id         UUID    NOT NULL REFERENCES utilisateurs(id),
    montant          NUMERIC(14,0) NOT NULL CHECK (montant > 0),
    base_valeur      NUMERIC(12,2),
    categorie        VARCHAR(100),
    periode          VARCHAR(10) NOT NULL,         -- 2026-10-01 / 2026-10 / 2026 / UNIQUE
    mode_paiement    VARCHAR(20) NOT NULL DEFAULT 'ESPECES',
    telephone_sms    VARCHAR(30),
    latitude         NUMERIC(9,6),
    longitude        NUMERIC(9,6),
    date_paiement    TIMESTAMPTZ NOT NULL,          -- heure de l'encaissement sur le terrain
    recu_le          TIMESTAMPTZ NOT NULL DEFAULT now(),   -- dernière écriture côté serveur (sert à la synchro)
    statut         VARCHAR(10) NOT NULL DEFAULT 'VALIDE' CHECK (statut IN ('VALIDE','ANNULE')),
    cloture_id       INTEGER REFERENCES clotures(id)
);
CREATE INDEX IF NOT EXISTS idx_paiements_service ON paiements(service_id, date_paiement);
CREATE INDEX IF NOT EXISTS idx_paiements_agent   ON paiements(agent_id, date_paiement);
CREATE INDEX IF NOT EXISTS idx_paiements_contrib ON paiements(contribuable_id);

-- SMS de reçu (simulés dans le prototype : aucun opérateur branché)
CREATE TABLE IF NOT EXISTS sms_envoyes (
    id          BIGSERIAL PRIMARY KEY,
    paiement_id UUID REFERENCES paiements(id),
    telephone   VARCHAR(30) NOT NULL,
    message     TEXT NOT NULL,
    statut      VARCHAR(15) NOT NULL DEFAULT 'SIMULE',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Journal des actions : qui a saisi, modifié, encaissé, quand
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal (
    id              BIGSERIAL PRIMARY KEY,
    utilisateur_id  UUID REFERENCES utilisateurs(id),
    service_id      INTEGER REFERENCES services(id),
    application     VARCHAR(10) NOT NULL CHECK (application IN ('MOBILE','MAIRIE','SERVICE')),
    action          VARCHAR(40) NOT NULL,
    entite          VARCHAR(30),
    entite_id       VARCHAR(60),
    details         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal(created_at DESC);
