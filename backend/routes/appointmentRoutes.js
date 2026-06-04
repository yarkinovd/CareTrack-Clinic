const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { getAppointments, createAppointment } = require('../controllers/appointmentController');

const router = express.Router();

router.use(protect);

router.get('/',  authorize('patient', 'clinician', 'admin'), getAppointments);
router.post('/', authorize('patient'),                        createAppointment);

module.exports = router;
