/**
 * models/Patient.js
 * Data-access layer for the patients table.
 * Includes the comprehensive Patient Profile query (JOIN across all 3 tables).
 */

const { query } = require('../config/db');

const PatientModel = {
    /**
     * List patients with optional filtering.
     * appointment_doctor_id — when set, filters patients who have at least one
     * appointment with that doctor and adds has_pending_appointment flag.
     */
    async findAll({ search = '', doctor_id = '', appointment_doctor_id = '', gender = '' } = {}) {
        const conditions = [];
        const values     = [];

        if (search) {
            values.push(`%${search}%`);
            conditions.push(`p.name ILIKE $${values.length}`);
        }
        if (doctor_id) {
            values.push(Number(doctor_id));
            conditions.push(`p.doctor_id = $${values.length}`);
        }
        if (gender) {
            values.push(gender);
            conditions.push(`p.gender = $${values.length}`);
        }

        let aptParamIdx = null;
        if (appointment_doctor_id) {
            values.push(Number(appointment_doctor_id));
            aptParamIdx = values.length;
            conditions.push(`EXISTS (SELECT 1 FROM appointments _af WHERE _af.patient_id = p.id AND _af.doctor_id = $${aptParamIdx})`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const aptJoin = aptParamIdx
            ? `LEFT JOIN appointments _appt ON _appt.patient_id = p.id AND _appt.doctor_id = $${aptParamIdx}`
            : '';
        const aptSelect = aptParamIdx
            ? `BOOL_OR(_appt.status = 'pending') AS has_pending_appointment`
            : `false AS has_pending_appointment`;

        const sql = `
            SELECT
                p.id,
                p.name,
                p.dob,
                p.phone,
                p.gender,
                p.doctor_id,
                d.name       AS doctor_name,
                d.specialty  AS doctor_specialty,
                p.created_at,
                p.updated_at,
                COUNT(DISTINCT dx.id) AS diagnosis_count,
                ${aptSelect}
            FROM   patients p
            LEFT JOIN doctors  d ON d.id = p.doctor_id
            LEFT JOIN diagnoses dx ON dx.patient_id = p.id
            ${aptJoin}
            ${where}
            GROUP BY p.id, p.name, p.dob, p.phone, p.gender, p.doctor_id,
                     d.name, d.specialty, p.created_at, p.updated_at
            ORDER  BY p.name ASC
        `;

        const result = await query(sql, values);
        return result.rows;
    },

    /** Fetch a single patient row (without aggregated diagnoses). */
    async findById(id) {
        const sql = `
            SELECT
                p.id, p.name, p.dob, p.phone, p.gender, p.doctor_id,
                d.name      AS doctor_name,
                d.specialty AS doctor_specialty,
                d.department,
                d.contact_info,
                p.created_at, p.updated_at
            FROM   patients p
            LEFT JOIN doctors  d ON d.id = p.doctor_id
            WHERE  p.id = $1
        `;
        const result = await query(sql, [id]);
        return result.rows[0] || null;
    },

    /**
     * Comprehensive Patient Profile.
     * Returns a single object combining:
     *   • patient personal information
     *   • assigned doctor details
     *   • full diagnosis history (array, newest first)
     *
     * This satisfies the BTEC "Comprehensive Patient Profile View" requirement.
     */
    async getProfile(id) {
        // --- Patient + Doctor details ---
        const patientSql = `
            SELECT
                p.id         AS patient_id,
                p.name       AS patient_name,
                p.dob,
                p.phone,
                p.gender,
                p.created_at AS registered_at,
                d.id         AS doctor_id,
                d.name       AS doctor_name,
                d.specialty  AS doctor_specialty,
                d.department AS doctor_department,
                d.contact_info AS doctor_contact
            FROM   patients p
            LEFT JOIN doctors  d ON d.id = p.doctor_id
            WHERE  p.id = $1
        `;
        const patientResult = await query(patientSql, [id]);
        if (!patientResult.rows.length) return null;

        // --- Full diagnosis history ---
        const diagnosisSql = `
            SELECT id, icd_code, description, severity_level, diagnosed_at, notes, created_at
            FROM   diagnoses
            WHERE  patient_id = $1
            ORDER  BY diagnosed_at DESC, created_at DESC
        `;
        const diagnosisResult = await query(diagnosisSql, [id]);

        // --- Appointment history ---
        const appointmentSql = `
            SELECT a.id, a.status, a.notes, a.booked_at, a.created_at,
                   d.id AS doctor_id, d.name AS doctor_name, d.specialty
            FROM   appointments a
            JOIN   doctors d ON d.id = a.doctor_id
            WHERE  a.patient_id = $1
            ORDER  BY a.booked_at DESC
        `;
        const appointmentResult = await query(appointmentSql, [id]);

        const row = patientResult.rows[0];
        return {
            patient: {
                id:              row.patient_id,
                name:            row.patient_name,
                dob:             row.dob,
                phone:           row.phone,
                gender:          row.gender,
                registered_at:   row.registered_at,
                diagnosis_count: diagnosisResult.rows.length,
            },
            doctor: {
                id:         row.doctor_id,
                name:       row.doctor_name,
                specialty:  row.doctor_specialty,
                department: row.doctor_department,
                contact:    row.doctor_contact,
            },
            diagnoses:    diagnosisResult.rows,
            appointments: appointmentResult.rows,
        };
    },

    /** Create a new patient record. */
    async create({ name, dob, phone, gender, doctor_id }) {
        const sql = `
            INSERT INTO patients (name, dob, phone, gender, doctor_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name, dob, phone, gender, doctor_id, created_at, updated_at
        `;
        const result = await query(sql, [name, dob, phone, gender, doctor_id]);
        return result.rows[0];
    },

    /** Update patient details. Returns the updated row, or null if not found. */
    async update(id, { name, dob, phone, gender, doctor_id }) {
        const sql = `
            UPDATE patients
            SET    name      = COALESCE($1, name),
                   dob       = COALESCE($2, dob),
                   phone     = COALESCE($3, phone),
                   gender    = COALESCE($4, gender),
                   doctor_id = COALESCE($5, doctor_id)
            WHERE  id = $6
            RETURNING id, name, dob, phone, gender, doctor_id, created_at, updated_at
        `;
        const result = await query(sql, [name, dob, phone, gender, doctor_id, id]);
        return result.rows[0] || null;
    },

    /** Delete a patient — cascades to diagnoses (ON DELETE CASCADE in schema). */
    async delete(id) {
        const sql = `DELETE FROM patients WHERE id = $1 RETURNING id`;
        const result = await query(sql, [id]);
        return result.rows[0] || null;
    },
};

module.exports = PatientModel;
