/**
 * routes/diagnosisRoutes.js
 * Mounted at /api/diagnoses in server.js
 *
 * RBAC:
 *   GET / POST / PUT → admin, clinician
 *   DELETE            → admin only
 *
 * Receptionists have no access to any diagnosis endpoint.
 */

const express  = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
    getAllDiagnoses,
    getDiagnosisById,
    createDiagnosis,
    updateDiagnosis,
    deleteDiagnosis,
} = require('../controllers/diagnosisController');

const router = express.Router();

router.use(protect);

router.get('/',    authorize('admin', 'clinician'), getAllDiagnoses);
router.get('/:id', authorize('admin', 'clinician'), getDiagnosisById);

router.post('/',    authorize('admin', 'clinician'), createDiagnosis);
router.put('/:id',  authorize('admin', 'clinician'), updateDiagnosis);
router.delete('/:id', authorize('admin'),            deleteDiagnosis);

module.exports = router;
