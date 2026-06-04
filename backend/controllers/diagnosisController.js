/**
 * controllers/diagnosisController.js
 * Full CRUD for diagnosis records.
 *
 * RBAC summary:
 *   GET    → admin, clinician
 *   POST   → admin, clinician
 *   PUT    → admin, clinician
 *   DELETE → admin
 *
 * Receptionists have no access to diagnosis endpoints (enforced in routes).
 */

const DiagnosisModel = require('../models/Diagnosis');
const PatientModel   = require('../models/Patient');

/**
 * GET /api/diagnoses
 * Supports filtering via query params:
 *   ?patient_id=  filter by patient
 *   ?severity=    Low | Medium | High
 *   ?icd_code=    partial match
 *   ?search=      description or ICD code partial match
 */
const getAllDiagnoses = async (req, res, next) => {
    try {
        const { patient_id = '', severity = '', icd_code = '', search = '' } = req.query;

        let filterDoctorId  = '';
        let filterPatientId = patient_id;

        if (req.user.role === 'clinician') {
            filterDoctorId = req.user.doctor_id;
        } else if (req.user.role === 'patient') {
            filterPatientId = req.user.patient_id; // patient sees only their own
        }

        const diagnoses = await DiagnosisModel.findAll({
            patient_id: filterPatientId, severity, icd_code, search, doctor_id: filterDoctorId,
        });
        res.status(200).json({ success: true, count: diagnoses.length, data: diagnoses });
    } catch (err) {
        next(err);
    }
};

/** GET /api/diagnoses/:id */
const getDiagnosisById = async (req, res, next) => {
    try {
        const diagnosis = await DiagnosisModel.findById(req.params.id);
        if (!diagnosis) {
            return res.status(404).json({ success: false, message: `Diagnosis with id ${req.params.id} not found.` });
        }
        if (req.user.role === 'clinician') {
            const patient = await PatientModel.findById(diagnosis.patient_id);
            if (!patient || patient.doctor_id !== req.user.doctor_id) {
                return res.status(403).json({ success: false, message: 'Access denied.' });
            }
        }
        if (req.user.role === 'patient' && diagnosis.patient_id !== req.user.patient_id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        res.status(200).json({ success: true, data: diagnosis });
    } catch (err) {
        next(err);
    }
};

/** POST /api/diagnoses */
const createDiagnosis = async (req, res, next) => {
    try {
        const { icd_code, description, severity_level, patient_id, diagnosed_at, notes } = req.body;

        if (!icd_code || !description || !severity_level || !patient_id) {
            return res.status(400).json({
                success: false,
                message: 'icd_code, description, severity_level, and patient_id are all required.',
            });
        }

        const validSeverities = ['Low', 'Medium', 'High'];
        if (!validSeverities.includes(severity_level)) {
            return res.status(400).json({
                success: false,
                message: `severity_level must be one of: ${validSeverities.join(', ')}.`,
            });
        }

        // Clinician can only create diagnoses for their own patients
        if (req.user.role === 'clinician') {
            const patient = await PatientModel.findById(patient_id);
            if (!patient || patient.doctor_id !== req.user.doctor_id) {
                return res.status(403).json({ success: false, message: 'Access denied: not your patient.' });
            }
        }

        const diagnosis = await DiagnosisModel.create({
            icd_code,
            description,
            severity_level,
            patient_id: Number(patient_id),
            diagnosed_at,
            notes,
        });

        res.status(201).json({ success: true, message: 'Diagnosis created successfully.', data: diagnosis });
    } catch (err) {
        next(err);
    }
};

/** PUT /api/diagnoses/:id */
const updateDiagnosis = async (req, res, next) => {
    try {
        // Clinician can only update diagnoses belonging to their patients
        if (req.user.role === 'clinician') {
            const existing = await DiagnosisModel.findById(req.params.id);
            if (!existing) {
                return res.status(404).json({ success: false, message: `Diagnosis with id ${req.params.id} not found.` });
            }
            const patient = await PatientModel.findById(existing.patient_id);
            if (!patient || patient.doctor_id !== req.user.doctor_id) {
                return res.status(403).json({ success: false, message: 'Access denied.' });
            }
        }

        const { icd_code, description, severity_level, diagnosed_at, notes } = req.body;

        const validSeverities = ['Low', 'Medium', 'High'];
        if (severity_level && !validSeverities.includes(severity_level)) {
            return res.status(400).json({
                success: false,
                message: `severity_level must be one of: ${validSeverities.join(', ')}.`,
            });
        }

        const diagnosis = await DiagnosisModel.update(req.params.id, {
            icd_code, description, severity_level, diagnosed_at, notes,
        });

        if (!diagnosis) {
            return res.status(404).json({ success: false, message: `Diagnosis with id ${req.params.id} not found.` });
        }

        res.status(200).json({ success: true, message: 'Diagnosis updated successfully.', data: diagnosis });
    } catch (err) {
        next(err);
    }
};

/** DELETE /api/diagnoses/:id (admin only) */
const deleteDiagnosis = async (req, res, next) => {
    try {
        const deleted = await DiagnosisModel.delete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: `Diagnosis with id ${req.params.id} not found.` });
        }
        res.status(200).json({ success: true, message: 'Diagnosis deleted successfully.' });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getAllDiagnoses,
    getDiagnosisById,
    createDiagnosis,
    updateDiagnosis,
    deleteDiagnosis,
};
