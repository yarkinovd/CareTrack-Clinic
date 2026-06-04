const { query } = require('../config/db');

const AppointmentModel = {
    async findByPatient(patientId) {
        const sql = `
            SELECT a.id, a.status, a.notes, a.booked_at, a.created_at,
                   d.id AS doctor_id, d.name AS doctor_name, d.specialty
            FROM   appointments a
            JOIN   doctors d ON d.id = a.doctor_id
            WHERE  a.patient_id = $1
            ORDER  BY a.booked_at DESC
        `;
        const result = await query(sql, [patientId]);
        return result.rows;
    },

    async create({ patient_id, doctor_id, notes = null }) {
        const sql = `
            INSERT INTO appointments (patient_id, doctor_id, notes)
            VALUES ($1, $2, $3)
            RETURNING id, patient_id, doctor_id, status, notes, booked_at, created_at
        `;
        const result = await query(sql, [patient_id, doctor_id, notes]);
        return result.rows[0];
    },

    /** Mark the most recent pending appointment for this patient+doctor as completed. */
    async completeLatest(patientId, doctorId) {
        const sql = `
            UPDATE appointments SET status = 'completed'
            WHERE id = (
                SELECT id FROM appointments
                WHERE  patient_id = $1 AND doctor_id = $2 AND status = 'pending'
                ORDER  BY booked_at DESC
                LIMIT  1
            )
        `;
        await query(sql, [patientId, doctorId]);
    },

    /** True if any appointment (any status) exists between this patient and doctor. */
    async hasAny(patientId, doctorId) {
        const sql = `SELECT 1 FROM appointments WHERE patient_id = $1 AND doctor_id = $2 LIMIT 1`;
        const result = await query(sql, [patientId, doctorId]);
        return result.rows.length > 0;
    },
};

module.exports = AppointmentModel;
