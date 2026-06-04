/**
 * models/Doctor.js
 * Data-access layer for the doctors table.
 * All functions return plain JS objects/arrays from pg query results.
 */

const { query } = require('../config/db');

const DoctorModel = {
    /**
     * Return all doctors, optionally filtered by name or specialty.
     * Search is case-insensitive using ILIKE.
     */
    async findAll({ search = '', specialty = '' } = {}) {
        const conditions = [];
        const values     = [];

        if (search) {
            values.push(`%${search}%`);
            conditions.push(`name ILIKE $${values.length}`);
        }
        if (specialty) {
            values.push(specialty);
            conditions.push(`specialty = $${values.length}`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const sql = `
            SELECT id, name, specialty, department, contact_info, created_at, updated_at
            FROM   doctors
            ${where}
            ORDER  BY name ASC
        `;

        const result = await query(sql, values);
        return result.rows;
    },

    /** Return one doctor by primary key, or null if not found. */
    async findById(id) {
        const sql = `
            SELECT id, name, specialty, department, contact_info, created_at, updated_at
            FROM   doctors
            WHERE  id = $1
        `;
        const result = await query(sql, [id]);
        return result.rows[0] || null;
    },

    /** Insert a new doctor and return the created record. */
    async create({ name, specialty, department, contact_info }) {
        const sql = `
            INSERT INTO doctors (name, specialty, department, contact_info)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, specialty, department, contact_info, created_at, updated_at
        `;
        const result = await query(sql, [name, specialty, department, contact_info]);
        return result.rows[0];
    },

    /** Update an existing doctor. Returns the updated record, or null if not found. */
    async update(id, { name, specialty, department, contact_info }) {
        const sql = `
            UPDATE doctors
            SET    name         = COALESCE($1, name),
                   specialty    = COALESCE($2, specialty),
                   department   = COALESCE($3, department),
                   contact_info = COALESCE($4, contact_info)
            WHERE  id = $5
            RETURNING id, name, specialty, department, contact_info, created_at, updated_at
        `;
        const result = await query(sql, [name, specialty, department, contact_info, id]);
        return result.rows[0] || null;
    },

    /**
     * Delete a doctor by id.
     * Will throw a 23503 FK error if any patient still references this doctor
     * (ON DELETE RESTRICT in schema) — let the error handler translate it.
     */
    async delete(id) {
        const sql = `DELETE FROM doctors WHERE id = $1 RETURNING id`;
        const result = await query(sql, [id]);
        return result.rows[0] || null;
    },

    /** Count patients per doctor — used in admin dashboards. */
    async patientCount(id) {
        const sql = `SELECT COUNT(*)::int AS count FROM patients WHERE doctor_id = $1`;
        const result = await query(sql, [id]);
        return result.rows[0].count;
    },
};

module.exports = DoctorModel;
