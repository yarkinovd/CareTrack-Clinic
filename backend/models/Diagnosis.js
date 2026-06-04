/**
 * models/Diagnosis.js
 * Data-access layer for the diagnoses table.
 */

const { query } = require('../config/db');

const DiagnosisModel = {
    /**
     * List diagnoses with optional filtering.
     * Joins patient name for context in the list view.
     */
    async findAll({ patient_id = '', severity = '', icd_code = '', search = '' } = {}) {
        const conditions = [];
        const values     = [];

        if (patient_id) {
            values.push(Number(patient_id));
            conditions.push(`d.patient_id = $${values.length}`);
        }
        if (severity) {
            values.push(severity);
            conditions.push(`d.severity_level = $${values.length}`);
        }
        if (icd_code) {
            values.push(`%${icd_code}%`);
            conditions.push(`d.icd_code ILIKE $${values.length}`);
        }
        if (search) {
            values.push(`%${search}%`);
            conditions.push(`(d.description ILIKE $${values.length} OR d.icd_code ILIKE $${values.length})`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const sql = `
            SELECT
                d.id,
                d.icd_code,
                d.description,
                d.severity_level,
                d.diagnosed_at,
                d.notes,
                d.patient_id,
                p.name  AS patient_name,
                d.created_at,
                d.updated_at
            FROM   diagnoses d
            JOIN   patients  p ON p.id = d.patient_id
            ${where}
            ORDER  BY d.diagnosed_at DESC, d.created_at DESC
        `;

        const result = await query(sql, values);
        return result.rows;
    },

    /** Fetch one diagnosis by primary key. */
    async findById(id) {
        const sql = `
            SELECT
                d.id, d.icd_code, d.description, d.severity_level,
                d.diagnosed_at, d.notes, d.patient_id,
                p.name AS patient_name,
                d.created_at, d.updated_at
            FROM   diagnoses d
            JOIN   patients  p ON p.id = d.patient_id
            WHERE  d.id = $1
        `;
        const result = await query(sql, [id]);
        return result.rows[0] || null;
    },

    /** Create a new diagnosis. */
    async create({ icd_code, description, severity_level, patient_id, diagnosed_at, notes }) {
        const sql = `
            INSERT INTO diagnoses (icd_code, description, severity_level, patient_id, diagnosed_at, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, icd_code, description, severity_level, patient_id, diagnosed_at, notes, created_at, updated_at
        `;
        const result = await query(sql, [
            icd_code,
            description,
            severity_level,
            patient_id,
            diagnosed_at || new Date().toISOString().split('T')[0],
            notes || null,
        ]);
        return result.rows[0];
    },

    /** Update a diagnosis record. */
    async update(id, { icd_code, description, severity_level, diagnosed_at, notes }) {
        const sql = `
            UPDATE diagnoses
            SET    icd_code       = COALESCE($1, icd_code),
                   description    = COALESCE($2, description),
                   severity_level = COALESCE($3, severity_level),
                   diagnosed_at   = COALESCE($4, diagnosed_at),
                   notes          = COALESCE($5, notes)
            WHERE  id = $6
            RETURNING id, icd_code, description, severity_level, patient_id, diagnosed_at, notes, created_at, updated_at
        `;
        const result = await query(sql, [icd_code, description, severity_level, diagnosed_at, notes, id]);
        return result.rows[0] || null;
    },

    /** Delete a diagnosis by id. */
    async delete(id) {
        const sql = `DELETE FROM diagnoses WHERE id = $1 RETURNING id`;
        const result = await query(sql, [id]);
        return result.rows[0] || null;
    },
};

module.exports = DiagnosisModel;
