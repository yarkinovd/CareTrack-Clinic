-- =============================================================================
-- CareTrack Clinic — Medical Records Management System
-- PostgreSQL Schema (Production-Ready DDL)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EXTENSION: Enable pgcrypto for UUID generation (optional helper)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- TABLE: users
-- Stores system users for authentication. Roles drive RBAC throughout the API.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(100)  NOT NULL UNIQUE,
    email       VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role        VARCHAR(50)   NOT NULL
                    CHECK (role IN ('admin', 'clinician', 'receptionist')),
    is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- TABLE: doctors
-- Core entity. One doctor may supervise many patients (1:N with patients).
-- contact_info stored as JSONB for flexible phone/email/address payloads.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctors (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    specialty    VARCHAR(100) NOT NULL
                     CHECK (specialty IN (
                         'Cardiology',
                         'Neurology',
                         'Dermatology',
                         'Orthopedics',
                         'General Practice'
                     )),
    department   VARCHAR(100) NOT NULL,
    contact_info JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- TABLE: patients
-- Each patient is assigned to exactly one doctor (doctor_id FK).
-- ON DELETE RESTRICT prevents orphaning a patient by deleting their doctor.
-- personal_details are flat columns for indexed searching.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    dob        DATE         NOT NULL,
    phone      VARCHAR(50),
    gender     VARCHAR(20)  NOT NULL
                   CHECK (gender IN ('Male', 'Female', 'Other')),
    doctor_id  INTEGER      NOT NULL
                   REFERENCES doctors(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- TABLE: diagnoses
-- Each diagnosis belongs to exactly one patient (patient_id FK).
-- ON DELETE CASCADE: removing a patient wipes all their diagnosis records.
-- icd_code follows ICD-10/ICD-11 format (e.g. "I21.0", "G35").
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diagnoses (
    id             SERIAL PRIMARY KEY,
    icd_code       VARCHAR(20)  NOT NULL,
    description    TEXT         NOT NULL,
    severity_level VARCHAR(20)  NOT NULL
                       CHECK (severity_level IN ('Low', 'Medium', 'High')),
    patient_id     INTEGER      NOT NULL
                       REFERENCES patients(id) ON DELETE CASCADE ON UPDATE CASCADE,
    diagnosed_at   DATE         NOT NULL DEFAULT CURRENT_DATE,
    notes          TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES — optimise the most common query patterns
-- =============================================================================

-- Patient lookup by assigned doctor (used in JOIN-heavy profile queries)
CREATE INDEX IF NOT EXISTS idx_patients_doctor_id   ON patients(doctor_id);

-- Diagnosis lookup by patient (primary profile aggregation query)
CREATE INDEX IF NOT EXISTS idx_diagnoses_patient_id ON diagnoses(patient_id);

-- ICD code search / filter endpoint
CREATE INDEX IF NOT EXISTS idx_diagnoses_icd_code   ON diagnoses(icd_code);

-- Severity filter on diagnoses listing
CREATE INDEX IF NOT EXISTS idx_diagnoses_severity   ON diagnoses(severity_level);

-- Full-text-friendly name searches
CREATE INDEX IF NOT EXISTS idx_doctors_name         ON doctors(name);
CREATE INDEX IF NOT EXISTS idx_patients_name        ON patients(name);

-- Specialty filter on doctor listing
CREATE INDEX IF NOT EXISTS idx_doctors_specialty    ON doctors(specialty);

-- =============================================================================
-- TRIGGER FUNCTION — auto-update updated_at on any row mutation
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to each mutable table (OR REPLACE is idempotent — safe on re-runs)
CREATE OR REPLACE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_doctors_updated_at
    BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_diagnoses_updated_at
    BEFORE UPDATE ON diagnoses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- MIGRATION: Deduplicate doctors seeded multiple times, then lock with UNIQUE
-- Keeps the lowest id for each name; reassigns any patients that referenced a
-- duplicate id so foreign-key integrity is preserved.
-- Safe to re-run: the DO block exits early when no duplicates exist.
-- =============================================================================
DO $$
DECLARE
    dup RECORD;
BEGIN
    FOR dup IN
        SELECT name, MIN(id) AS keep_id
        FROM   doctors
        GROUP  BY name
        HAVING COUNT(*) > 1
    LOOP
        -- Point patients away from the soon-to-be-deleted duplicate rows
        UPDATE patients
        SET    doctor_id = dup.keep_id
        WHERE  doctor_id IN (
            SELECT id FROM doctors WHERE name = dup.name AND id <> dup.keep_id
        );
        -- Now it is safe to delete the duplicates
        DELETE FROM doctors WHERE name = dup.name AND id <> dup.keep_id;
    END LOOP;
END $$;

-- Prevent future duplicate doctors (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS uq_doctors_name ON doctors(name);
