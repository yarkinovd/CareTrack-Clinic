/**
 * routes/doctorRoutes.js
 * Mounted at /api/doctors in server.js
 *
 * RBAC:
 *   GET  (all/single) → admin, clinician, receptionist
 *   POST / PUT / DELETE → admin only
 */

const express  = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
    getAllDoctors,
    getDoctorById,
    createDoctor,
    updateDoctor,
    deleteDoctor,
} = require('../controllers/doctorController');

const router = express.Router();

// All doctor routes require at minimum a valid token
router.use(protect);

router.get('/',    authorize('admin', 'receptionist'), getAllDoctors);
router.get('/:id', authorize('admin', 'receptionist'), getDoctorById);

router.post('/',    authorize('admin'), createDoctor);
router.put('/:id',  authorize('admin'), updateDoctor);
router.delete('/:id', authorize('admin'), deleteDoctor);

module.exports = router;
