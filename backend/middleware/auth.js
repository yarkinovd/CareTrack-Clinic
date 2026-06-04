/**
 * middleware/auth.js
 * JWT verification + Role-Based Access Control (RBAC) middleware.
 *
 * Usage:
 *   router.get('/doctors', protect, authorize('admin', 'clinician'), handler)
 *
 * protect     — verifies the Bearer token and attaches req.user
 * authorize   — factory that checks req.user.role against allowed roles
 */

const jwt = require('jsonwebtoken');

/**
 * protect
 * Reads the Authorization header, verifies the JWT, and populates req.user.
 * Responds 401 if the token is missing, malformed, or expired.
 */
const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'No authentication token provided. Please log in.',
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Attach decoded payload (id, username, role) to the request
        req.user = decoded;
        next();
    } catch (err) {
        // Differentiate expired vs. invalid for clearer client messages
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Session expired. Please log in again.',
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Invalid token. Authentication failed.',
        });
    }
};

/**
 * authorize(...roles)
 * Factory middleware — call with the roles that are permitted for the route.
 * Must be used AFTER protect (relies on req.user being set).
 *
 * Role hierarchy (highest → lowest):
 *   admin        — full CRUD on all resources
 *   clinician    — view/update patients and diagnoses only
 *   receptionist — create patients, view doctors only
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated.',
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}.`,
            });
        }

        next();
    };
};

module.exports = { protect, authorize };
