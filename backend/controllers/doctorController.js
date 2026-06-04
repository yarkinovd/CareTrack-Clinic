/**
 * controllers/doctorController.js
 * Full CRUD for the doctors resource.
 * Route-level RBAC: only 'admin' can write; all authenticated roles can read.
 */

const DoctorModel = require('../models/Doctor');

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

/** POST /api/doctors — create a new doctor (admin only) */
const createDoctor = async (req, res, next) => {
    try {
        const { name, specialty, department, contact_info } = req.body;

        if (!name || !specialty || !department) {
            return res.status(400).json({
                success: false,
                message: 'name, specialty, and department are required.',
            });
        }

        const validSpecialties = ['Cardiology', 'Neurology', 'Dermatology', 'Orthopedics', 'General Practice'];
        if (!validSpecialties.includes(specialty)) {
            return res.status(400).json({
                success: false,
                message: `specialty must be one of: ${validSpecialties.join(', ')}.`,
            });
        }

        // Ensure contact_info is either an object or defaults to {}
        const contactData = (typeof contact_info === 'object' && contact_info !== null)
            ? contact_info
            : {};

        const doctor = await DoctorModel.create({ name, specialty, department, contact_info: JSON.stringify(contactData) });
        res.status(201).json({ success: true, message: 'Doctor created successfully.', data: doctor });
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
