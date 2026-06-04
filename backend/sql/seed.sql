-- =============================================================================
-- CareTrack Clinic — Seed / Mock Data
-- Users are seeded via JavaScript (db.js) so bcrypt hashes are correct.
-- This file seeds only doctors, patients, and diagnoses.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- DOCTORS (3 required by BTEC)
-- -----------------------------------------------------------------------------
INSERT INTO doctors (name, specialty, department, contact_info) VALUES
    (
        'Dr. Sarah Mitchell',
        'Cardiology',
        'Cardiovascular Unit',
        '{"phone": "+1-555-0101", "email": "s.mitchell@caretrack.com", "office": "Block A, Room 204"}'
    ),
    (
        'Dr. James Okonkwo',
        'Neurology',
        'Neuroscience Wing',
        '{"phone": "+1-555-0102", "email": "j.okonkwo@caretrack.com", "office": "Block B, Room 110"}'
    ),
    (
        'Dr. Priya Sharma',
        'General Practice',
        'Primary Care',
        '{"phone": "+1-555-0103", "email": "p.sharma@caretrack.com", "office": "Block C, Room 302"}'
    )
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- PATIENTS (5 required by BTEC)
-- Assigned across the 3 doctors above (IDs 1, 2, 3)
-- -----------------------------------------------------------------------------
INSERT INTO patients (name, dob, phone, gender, doctor_id) VALUES
    ('Alice Thompson',  '1985-03-14', '+1-555-1001', 'Female', 1),
    ('Brian Carter',    '1972-07-22', '+1-555-1002', 'Male',   1),
    ('Clara Espinoza',  '1990-11-05', '+1-555-1003', 'Female', 2),
    ('David Kim',       '1968-01-30', '+1-555-1004', 'Male',   2),
    ('Eleanor Whitfield','2000-06-18', '+1-555-1005', 'Female', 3)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- DIAGNOSES (5 required by BTEC)
-- Spread across patients (IDs 1-5), uses real ICD-10 codes
-- -----------------------------------------------------------------------------
INSERT INTO diagnoses (icd_code, description, severity_level, patient_id, diagnosed_at, notes) VALUES
    (
        'I21.0',
        'ST-elevation myocardial infarction of anterior wall',
        'High',
        1,
        '2025-11-10',
        'Patient presented with chest pain; immediate PCI performed. Follow-up scheduled in 4 weeks.'
    ),
    (
        'I10',
        'Essential (primary) hypertension',
        'Medium',
        2,
        '2025-12-01',
        'Blood pressure 160/100 on admission. Prescribed lisinopril 10mg daily.'
    ),
    (
        'G35',
        'Multiple sclerosis',
        'High',
        3,
        '2025-09-22',
        'Relapsing-remitting MS confirmed via MRI. Initiated interferon beta-1a therapy.'
    ),
    (
        'G43.909',
        'Migraine, unspecified, not intractable, without status migrainosus',
        'Low',
        4,
        '2026-01-15',
        'Recurrent migraines 2-3x per month. Recommended sumatriptan PRN.'
    ),
    (
        'J06.9',
        'Acute upper respiratory infection, unspecified',
        'Low',
        5,
        '2026-02-28',
        'Symptomatic treatment; advised rest and fluids. Resolved within 7 days.'
    )
ON CONFLICT DO NOTHING;
