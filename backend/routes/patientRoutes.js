/**
 * routes/patientRoutes.js
 * Mounted at /api/patients in server.js
 *
 * RBAC:
 *   GET   → admin, clinician, receptionist
 *   POST  → admin, receptionist
 *   PUT   → admin, clinician
 *   DELETE → admin
 */

const express  = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
    getAllPatients,
    getPatientById,
    getPatientProfile,
    createPatient,
    updatePatient,
    deletePatient,
} = require('../controllers/patientController');

const router = express.Router();

router.use(protect);

// --- Read ---
router.get('/',            authorize('admin', 'clinician', 'receptionist'), getAllPatients);
router.get('/:id',         authorize('admin', 'clinician', 'receptionist'), getPatientById);
// Comprehensive profile endpoint — includes doctor details + full diagnosis history
router.get('/:id/profile', authorize('admin', 'clinician', 'receptionist'), getPatientProfile);

// --- Write ---
router.post('/',     authorize('admin', 'receptionist'), createPatient);
router.put('/:id',   authorize('admin', 'clinician'),    updatePatient);
router.delete('/:id', authorize('admin'),                deletePatient);

module.exports = router;
