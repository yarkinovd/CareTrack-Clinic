-- =============================================================================
-- CareTrack Clinic — Seed / Mock Data
-- Users are seeded via JavaScript (db.js) so bcrypt hashes are correct.
-- All inserts here use WHERE NOT EXISTS so the seed is fully idempotent:
-- re-running on every server start never creates duplicate rows.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- DOCTORS (3 required by BTEC)
-- -----------------------------------------------------------------------------
INSERT INTO doctors (name, specialty, department, contact_info)
SELECT 'Dr. Sarah Mitchell', 'Cardiology', 'Cardiovascular Unit',
       '{"phone": "+1-555-0101", "email": "s.mitchell@caretrack.com", "office": "Block A, Room 204"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name = 'Dr. Sarah Mitchell');

INSERT INTO doctors (name, specialty, department, contact_info)
SELECT 'Dr. James Okonkwo', 'Neurology', 'Neuroscience Wing',
       '{"phone": "+1-555-0102", "email": "j.okonkwo@caretrack.com", "office": "Block B, Room 110"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name = 'Dr. James Okonkwo');

INSERT INTO doctors (name, specialty, department, contact_info)
SELECT 'Dr. Priya Sharma', 'General Practice', 'Primary Care',
       '{"phone": "+1-555-0103", "email": "p.sharma@caretrack.com", "office": "Block C, Room 302"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name = 'Dr. Priya Sharma');

-- -----------------------------------------------------------------------------
-- PATIENTS (5 required by BTEC)
-- Identified by name + dob so the check survives across doctor-id changes.
-- -----------------------------------------------------------------------------
INSERT INTO patients (name, dob, phone, gender, doctor_id)
SELECT 'Alice Thompson', '1985-03-14', '+1-555-1001', 'Female',
       (SELECT id FROM doctors WHERE name = 'Dr. Sarah Mitchell' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM patients WHERE name = 'Alice Thompson' AND dob = '1985-03-14');

INSERT INTO patients (name, dob, phone, gender, doctor_id)
SELECT 'Brian Carter', '1972-07-22', '+1-555-1002', 'Male',
       (SELECT id FROM doctors WHERE name = 'Dr. Sarah Mitchell' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM patients WHERE name = 'Brian Carter' AND dob = '1972-07-22');

INSERT INTO patients (name, dob, phone, gender, doctor_id)
SELECT 'Clara Espinoza', '1990-11-05', '+1-555-1003', 'Female',
       (SELECT id FROM doctors WHERE name = 'Dr. James Okonkwo' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM patients WHERE name = 'Clara Espinoza' AND dob = '1990-11-05');

INSERT INTO patients (name, dob, phone, gender, doctor_id)
SELECT 'David Kim', '1968-01-30', '+1-555-1004', 'Male',
       (SELECT id FROM doctors WHERE name = 'Dr. James Okonkwo' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM patients WHERE name = 'David Kim' AND dob = '1968-01-30');

INSERT INTO patients (name, dob, phone, gender, doctor_id)
SELECT 'Eleanor Whitfield', '2000-06-18', '+1-555-1005', 'Female',
       (SELECT id FROM doctors WHERE name = 'Dr. Priya Sharma' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM patients WHERE name = 'Eleanor Whitfield' AND dob = '2000-06-18');

-- -----------------------------------------------------------------------------
-- DIAGNOSES (5 required by BTEC)
-- Identified by icd_code + patient so the check is unambiguous.
-- -----------------------------------------------------------------------------
INSERT INTO diagnoses (icd_code, description, severity_level, patient_id, diagnosed_at, notes)
SELECT 'I21.0',
       'ST-elevation myocardial infarction of anterior wall',
       'High',
       (SELECT id FROM patients WHERE name = 'Alice Thompson' AND dob = '1985-03-14' LIMIT 1),
       '2025-11-10',
       'Patient presented with chest pain; immediate PCI performed. Follow-up scheduled in 4 weeks.'
WHERE NOT EXISTS (
    SELECT 1 FROM diagnoses
    WHERE icd_code = 'I21.0'
      AND patient_id = (SELECT id FROM patients WHERE name = 'Alice Thompson' AND dob = '1985-03-14' LIMIT 1)
);

INSERT INTO diagnoses (icd_code, description, severity_level, patient_id, diagnosed_at, notes)
SELECT 'I10',
       'Essential (primary) hypertension',
       'Medium',
       (SELECT id FROM patients WHERE name = 'Brian Carter' AND dob = '1972-07-22' LIMIT 1),
       '2025-12-01',
       'Blood pressure 160/100 on admission. Prescribed lisinopril 10mg daily.'
WHERE NOT EXISTS (
    SELECT 1 FROM diagnoses
    WHERE icd_code = 'I10'
      AND patient_id = (SELECT id FROM patients WHERE name = 'Brian Carter' AND dob = '1972-07-22' LIMIT 1)
);

INSERT INTO diagnoses (icd_code, description, severity_level, patient_id, diagnosed_at, notes)
SELECT 'G35',
       'Multiple sclerosis',
       'High',
       (SELECT id FROM patients WHERE name = 'Clara Espinoza' AND dob = '1990-11-05' LIMIT 1),
       '2025-09-22',
       'Relapsing-remitting MS confirmed via MRI. Initiated interferon beta-1a therapy.'
WHERE NOT EXISTS (
    SELECT 1 FROM diagnoses
    WHERE icd_code = 'G35'
      AND patient_id = (SELECT id FROM patients WHERE name = 'Clara Espinoza' AND dob = '1990-11-05' LIMIT 1)
);

INSERT INTO diagnoses (icd_code, description, severity_level, patient_id, diagnosed_at, notes)
SELECT 'G43.909',
       'Migraine, unspecified, not intractable, without status migrainosus',
       'Low',
       (SELECT id FROM patients WHERE name = 'David Kim' AND dob = '1968-01-30' LIMIT 1),
       '2026-01-15',
       'Recurrent migraines 2-3x per month. Recommended sumatriptan PRN.'
WHERE NOT EXISTS (
    SELECT 1 FROM diagnoses
    WHERE icd_code = 'G43.909'
      AND patient_id = (SELECT id FROM patients WHERE name = 'David Kim' AND dob = '1968-01-30' LIMIT 1)
);

INSERT INTO diagnoses (icd_code, description, severity_level, patient_id, diagnosed_at, notes)
SELECT 'J06.9',
       'Acute upper respiratory infection, unspecified',
       'Low',
       (SELECT id FROM patients WHERE name = 'Eleanor Whitfield' AND dob = '2000-06-18' LIMIT 1),
       '2026-02-28',
       'Symptomatic treatment; advised rest and fluids. Resolved within 7 days.'
WHERE NOT EXISTS (
    SELECT 1 FROM diagnoses
    WHERE icd_code = 'J06.9'
      AND patient_id = (SELECT id FROM patients WHERE name = 'Eleanor Whitfield' AND dob = '2000-06-18' LIMIT 1)
);
