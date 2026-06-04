const AppointmentModel = require('../models/Appointment');

/** GET /api/appointments
 *  - patient  → their own appointments
 *  - clinician → appointments booked with their doctor record (from JWT doctor_id)
 *  - admin    → query param ?patient_id= or ?doctor_id= supported
 */
const getAppointments = async (req, res, next) => {
    try {
        if (req.user.role === 'patient') {
            const rows = await AppointmentModel.findByPatient(req.user.patient_id);
            return res.status(200).json({ success: true, count: rows.length, data: rows });
        }
        // clinician / admin: return appointments relevant to them
        if (req.user.role === 'clinician') {
            const { query: q } = require('../config/db');
            const sql = `
                SELECT a.id, a.patient_id, a.status, a.notes, a.booked_at, a.created_at,
                       p.name AS patient_name, p.gender, p.dob, p.phone
                FROM   appointments a
                JOIN   patients p ON p.id = a.patient_id
                WHERE  a.doctor_id = $1
                ORDER  BY a.status ASC, a.booked_at DESC
            `;
            const result = await q(sql, [req.user.doctor_id]);
            return res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
        }
        // admin
        const { patient_id, doctor_id } = req.query;
        const conditions = [];
        const values = [];
        if (patient_id) { values.push(Number(patient_id)); conditions.push(`a.patient_id = $${values.length}`); }
        if (doctor_id)  { values.push(Number(doctor_id));  conditions.push(`a.doctor_id  = $${values.length}`); }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const { query: q } = require('../config/db');
        const sql = `
            SELECT a.id, a.patient_id, a.doctor_id, a.status, a.notes, a.booked_at, a.created_at,
                   p.name AS patient_name, d.name AS doctor_name
            FROM   appointments a
            JOIN   patients p ON p.id = a.patient_id
            JOIN   doctors  d ON d.id = a.doctor_id
            ${where}
            ORDER BY a.booked_at DESC
        `;
        const result = await q(sql, values);
        res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
    } catch (err) {
        next(err);
    }
};

/** POST /api/appointments — patient books a new appointment */
const createAppointment = async (req, res, next) => {
    try {
        const { doctor_id, notes } = req.body;
        if (!doctor_id) {
            return res.status(400).json({ success: false, message: 'doctor_id is required.' });
        }
        const appt = await AppointmentModel.create({
            patient_id: req.user.patient_id,
            doctor_id:  Number(doctor_id),
            notes:      notes || null,
        });
        res.status(201).json({ success: true, message: 'Appointment booked successfully.', data: appt });
    } catch (err) {
        next(err);
    }
};

module.exports = { getAppointments, createAppointment };
