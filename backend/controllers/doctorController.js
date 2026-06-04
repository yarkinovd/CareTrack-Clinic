/**
 * controllers/doctorController.js
 * Full CRUD for the doctors resource.
 * Route-level RBAC: only 'admin' can write; all authenticated roles can read.
 */

const bcrypt      = require('bcryptjs');
const DoctorModel = require('../models/Doctor');
const { getClient } = require('../config/db');

/** GET /api/doctors  — list with optional ?search= and ?specialty= */
const getAllDoctors = async (req, res, next) => {
    try {
        const { search = '', specialty = '' } = req.query;
        const doctors = await DoctorModel.findAll({ search, specialty });
        res.status(200).json({ success: true, count: doctors.length, data: doctors });
    } catch (err) {
        next(err);
    }
};

/** GET /api/doctors/:id — single doctor */
const getDoctorById = async (req, res, next) => {
    try {
        const doctor = await DoctorModel.findById(req.params.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: `Doctor with id ${req.params.id} not found.` });
        }
        // Also include how many patients this doctor is managing
        const patientCount = await DoctorModel.patientCount(req.params.id);
        res.status(200).json({ success: true, data: { ...doctor, patient_count: patientCount } });
    } catch (err) {
        next(err);
    }
};

/** POST /api/doctors — create a new doctor + linked clinician account (admin only) */
const createDoctor = async (req, res, next) => {
    try {
        const { name, specialty, department, contact_info, username, password } = req.body;

        if (!name || !specialty || !department) {
            return res.status(400).json({ success: false, message: 'name, specialty, and department are required.' });
        }
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'username and password are required to create a login account.' });
        }

        const validSpecialties = ['Cardiology', 'Neurology', 'Dermatology', 'Orthopedics', 'General Practice'];
        if (!validSpecialties.includes(specialty)) {
            return res.status(400).json({ success: false, message: `specialty must be one of: ${validSpecialties.join(', ')}.` });
        }

        const contactData = (typeof contact_info === 'object' && contact_info !== null) ? contact_info : {};
        const loginEmail  = contactData.email || null;

        const client = await getClient();
        try {
            await client.query('BEGIN');

            const docRes = await client.query(
                `INSERT INTO doctors (name, specialty, department, contact_info)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, name, specialty, department, contact_info, created_at, updated_at`,
                [name, specialty, department, JSON.stringify(contactData)]
            );
            const doctor = docRes.rows[0];

            const passwordHash = await bcrypt.hash(password, 10);
            await client.query(
                `INSERT INTO users (username, email, password_hash, role, doctor_id)
                 VALUES ($1, $2, $3, 'clinician', $4)`,
                [username, loginEmail, passwordHash, doctor.id]
            );

            await client.query('COMMIT');
            res.status(201).json({ success: true, message: 'Doctor and login account created successfully.', data: doctor });
        } catch (txErr) {
            await client.query('ROLLBACK');
            if (txErr.code === '23505') {
                return res.status(409).json({ success: false, message: `Username "${username}" is already taken.` });
            }
            throw txErr;
        } finally {
            client.release();
        }
    } catch (err) {
        next(err);
    }
};

/** PUT /api/doctors/:id — update a doctor (admin only) */
const updateDoctor = async (req, res, next) => {
    try {
        const { name, specialty, department, contact_info } = req.body;

        const validSpecialties = ['Cardiology', 'Neurology', 'Dermatology', 'Orthopedics', 'General Practice'];
        if (specialty && !validSpecialties.includes(specialty)) {
            return res.status(400).json({
                success: false,
                message: `specialty must be one of: ${validSpecialties.join(', ')}.`,
            });
        }

        const contactData = contact_info
            ? (typeof contact_info === 'object' ? JSON.stringify(contact_info) : contact_info)
            : undefined;

        const doctor = await DoctorModel.update(req.params.id, { name, specialty, department, contact_info: contactData });
        if (!doctor) {
            return res.status(404).json({ success: false, message: `Doctor with id ${req.params.id} not found.` });
        }
        res.status(200).json({ success: true, message: 'Doctor updated successfully.', data: doctor });
    } catch (err) {
        next(err);
    }
};

/** DELETE /api/doctors/:id — delete a doctor (admin only) */
const deleteDoctor = async (req, res, next) => {
    try {
        const deleted = await DoctorModel.delete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: `Doctor with id ${req.params.id} not found.` });
        }
        res.status(200).json({ success: true, message: 'Doctor deleted successfully.' });
    } catch (err) {
        // 23503 FK violation (patients still exist) → errorHandler returns 409
        next(err);
    }
};

module.exports = { getAllDoctors, getDoctorById, createDoctor, updateDoctor, deleteDoctor };
