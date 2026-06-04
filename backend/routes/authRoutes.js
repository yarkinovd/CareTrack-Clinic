/**
 * routes/authRoutes.js
 * Mounted at /api/auth in server.js
 */

const express    = require('express');
const { protect, authorize } = require('../middleware/auth');
const { login, register, registerPatient, getMe } = require('../controllers/authController');

const router = express.Router();

// POST /api/auth/login  — public
router.post('/login', login);

// POST /api/auth/register/patient — public (patient self-registration)
router.post('/register/patient', registerPatient);

// POST /api/auth/register — admin only (protect + authorize)
router.post('/register', protect, authorize('admin'), register);

// GET /api/auth/me — any authenticated user
router.get('/me', protect, getMe);

module.exports = router;
