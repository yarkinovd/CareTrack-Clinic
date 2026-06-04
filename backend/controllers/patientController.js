/**
 * controllers/patientController.js
 * Full CRUD for patients + the comprehensive Patient Profile endpoint.
 *
 * RBAC summary:
 *   GET  (list/single/profile) → admin, clinician, receptionist
 *   POST (create)              → admin, receptionist
 *   PUT  (update)              → admin, clinician
 *   DELETE                     → admin
 */

const bcrypt            = require('bcryptjs');
const { getClient }     = require('../config/db');
const PatientModel      = require('../models/Patient');
const AppointmentModel  = require('../models/Appointment');

/** GET /api/patients  — list with optional ?search=, ?doctor_id=, ?gender= */
const getAllPatients = async (req, res, next) => {
    try {
        // Patient sees only their own record
        if (req.user.role === 'patient') {
            const patient = await PatientModel.findById(req.user.patient_id);
            if (!patient) return res.status(404).json({ success: false, message: 'Patient record not found.' });
            return res.status(200).json({ success: true, count: 1, data: [patient] });
        }

        const { search = '', doctor_id = '', gender = '' } = req.query;

        // Clinician sees patients who have appointments with them (not just assigned patients)
        if (req.user.role === 'clinician') {
            const patients = await PatientModel.findAll({
                search, gender, appointment_doctor_id: req.user.doctor_id,
            });
            return res.status(200).json({ success: true, count: patients.length, data: patients });
        }

        const patients = await PatientModel.findAll({ search, doctor_id, gender });
        res.status(200).json({ success: true, count: patients.length, data: patients });
    } catch (err) {
        next(err);
    }
};

/** GET /api/patients/:id — single patient with doctor info */
const getPatientById = async (req, res, next) => {
    try {
        const patient = await PatientModel.findById(req.params.id);
        if (!patient) {
            return res.status(404).json({ success: false, message: `Patient with id ${req.params.id} not found.` });
        }
        if (req.user.role === 'clinician') {
            const hasAppt = await AppointmentModel.hasAny(patient.id, req.user.doctor_id);
            if (!hasAppt) {
                return res.status(403).json({ success: false, message: 'Access denied: not your patient.' });
            }
        }
        if (req.user.role === 'patient' && Number(req.params.id) !== req.user.patient_id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        res.status(200).json({ success: true, data: patient });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/patients/:id/profile
 * The "Comprehensive Patient Profile" endpoint required by the spec.
 * Returns a single structured payload:
 *   { patient: {...}, doctor: {...}, diagnoses: [...] }
 */
const getPatientProfile = async (req, res, next) => {
    try {
        if (req.user.role === 'patient' && Number(req.params.id) !== req.user.patient_id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        const profile = await PatientModel.getProfile(req.params.id);
        if (!profile) {
            return res.status(404).json({ success: false, message: `Patient with id ${req.params.id} not found.` });
        }
        res.status(200).json({ success: true, data: profile });
    } catch (err) {
        next(err);
    }
};

/** POST /api/patients — create a new patient (optionally with a login account) */
const createPatient = async (req, res, next) => {
    try {
        const { name, dob, phone, gender, doctor_id, username, password } = req.body;

        if (!name || !dob || !gender || !doctor_id) {
            return res.status(400).json({
                success: false,
                message: 'name, dob, gender, and doctor_id are required.',
            });
        }

        const validGenders = ['Male', 'Female', 'Other'];
        if (!validGenders.includes(gender)) {
            return res.status(400).json({
                success: false,
                message: `gender must be one of: ${validGenders.join(', ')}.`,
            });
        }

        if (isNaN(Date.parse(dob))) {
            return res.status(400).json({ success: false, message: 'dob must be a valid date (YYYY-MM-DD).' });
        }

        // If credentials supplied, create patient + user account atomically
        if (username || password) {
            if (!username || !password) {
                return res.status(400).json({ success: false, message: 'Both username and password are required to create a login account.' });
            }

            const client = await getClient();
            try {
                await client.query('BEGIN');

                const patRow = await client.query(
                    `INSERT INTO patients (name, dob, phone, gender, doctor_id)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING id, name, dob, phone, gender, doctor_id, registered_at, created_at, updated_at`,
                    [name, dob, phone || null, gender, Number(doctor_id)]
                );
                const patient = patRow.rows[0];

                const passwordHash = await bcrypt.hash(password, 10);
                await client.query(
                    `INSERT INTO users (username, password_hash, role, patient_id) VALUES ($1, $2, 'patient', $3)`,
                    [username, passwordHash, patient.id]
                );

                await client.query('COMMIT');
                return res.status(201).json({ success: true, message: 'Patient registered successfully.', data: patient });
            } catch (txErr) {
                await client.query('ROLLBACK');
                if (txErr.code === '23505') {
                    return res.status(409).json({ success: false, message: `Username "${username}" is already taken.` });
                }
                throw txErr;
            } finally {
                client.release();
            }
        }

        // No credentials — create patient record only
        const patient = await PatientModel.create({ name, dob, phone, gender, doctor_id: Number(doctor_id) });
        res.status(201).json({ success: true, message: 'Patient registered successfully.', data: patient });
    } catch (err) {
        next(err);
    }
};

/** PUT /api/patients/:id — update patient details */
const updatePatient = async (req, res, next) => {
    try {
        // Clinician can only update their own patients
        if (req.user.role === 'clinician') {
            const existing = await PatientModel.findById(req.params.id);
            if (!existing) {
                return res.status(404).json({ success: false, message: `Patient with id ${req.params.id} not found.` });
            }
            const hasAppt = await AppointmentModel.hasAny(existing.id, req.user.doctor_id);
            if (!hasAppt) {
                return res.status(403).json({ success: false, message: 'Access denied: not your patient.' });
            }
        }

        const { name, dob, phone, gender, doctor_id } = req.body;

        const validGenders = ['Male', 'Female', 'Other'];
        if (gender && !validGenders.includes(gender)) {
            return res.status(400).json({
                success: false,
                message: `gender must be one of: ${validGenders.join(', ')}.`,
            });
        }

        if (dob && isNaN(Date.parse(dob))) {
            return res.status(400).json({ success: false, message: 'dob must be a valid date (YYYY-MM-DD).' });
        }

        const patient = await PatientModel.update(req.params.id, {
            name,
            dob,
            phone,
            gender,
            doctor_id: doctor_id ? Number(doctor_id) : undefined,
        });

        if (!patient) {
            return res.status(404).json({ success: false, message: `Patient with id ${req.params.id} not found.` });
        }
        res.status(200).json({ success: true, message: 'Patient updated successfully.', data: patient });
    } catch (err) {
        next(err);
    }
};

/** DELETE /api/patients/:id — delete patient (and their diagnoses via CASCADE) */
const deletePatient = async (req, res, next) => {
    try {
        const deleted = await PatientModel.delete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: `Patient with id ${req.params.id} not found.` });
        }
        res.status(200).json({ success: true, message: 'Patient and all associated records deleted.' });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getAllPatients,
    getPatientById,
    getPatientProfile,
    createPatient,
    updatePatient,
    deletePatient,
};
