/**
 * controllers/authController.js
 * Handles user registration (admin-only) and login (public).
 * Issues signed JWT tokens containing { id, username, role }.
 */

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { query } = require('../config/db');

/**
 * POST /api/auth/login
 * Public endpoint — accepts { username, password }.
 * Returns a JWT and the user's safe profile on success.
 */
const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required.',
            });
        }

        // Fetch user by username
        const result = await query(
            'SELECT id, username, email, password_hash, role, is_active FROM users WHERE username = $1',
            [username]
        );

        const user = result.rows[0];

        if (!user) {
            // Use the same message for "user not found" and "wrong password"
            // to prevent username enumeration attacks
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials.',
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Account is disabled. Contact an administrator.',
            });
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials.',
            });
        }

        // Sign token — embed only the minimum needed payload
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        res.status(200).json({
            success: true,
            message: 'Login successful.',
            token,
            user: {
                id:       user.id,
                username: user.username,
                email:    user.email,
                role:     user.role,
            },
        });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/auth/register
 * Admin-only endpoint to create a new system user.
 * Protected by RBAC middleware in authRoutes.js.
 */
const register = async (req, res, next) => {
    try {
        const { username, email, password, role } = req.body;

        const validRoles = ['admin', 'clinician', 'receptionist'];
        if (!username || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: 'username, email, password, and role are all required.',
            });
        }
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: `role must be one of: ${validRoles.join(', ')}.`,
            });
        }
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters.',
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await query(
            `INSERT INTO users (username, email, password_hash, role)
             VALUES ($1, $2, $3, $4)
             RETURNING id, username, email, role, created_at`,
            [username, email, passwordHash, role]
        );

        res.status(201).json({
            success: true,
            message: 'User created successfully.',
            user: result.rows[0],
        });
    } catch (err) {
        next(err); // 23505 duplicate handled by errorHandler
    }
};

/**
 * GET /api/auth/me
 * Returns the current user's profile (token must be valid).
 */
const getMe = async (req, res, next) => {
    try {
        const result = await query(
            'SELECT id, username, email, role, created_at FROM users WHERE id = $1',
            [req.user.id]
        );
        const user = result.rows[0];
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        res.status(200).json({ success: true, user });
    } catch (err) {
        next(err);
    }
};

module.exports = { login, register, getMe };
