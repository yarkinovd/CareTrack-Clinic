/**
 * middleware/errorHandler.js
 * Centralised Express error-handling middleware.
 * Must be registered LAST in server.js (after all routes).
 *
 * Catches errors thrown or passed to next(err) anywhere in the app,
 * translates known PostgreSQL error codes into user-friendly messages,
 * and ensures the client always receives a consistent JSON shape.
 */

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
    // Log full stack in dev; just the message in production
    if (process.env.NODE_ENV !== 'production') {
        console.error('[ERROR]', err.stack || err.message);
    } else {
        console.error('[ERROR]', err.message);
    }

    // Default to 500 unless the error already carries a statusCode
    let statusCode = err.statusCode || 500;
    let message    = err.message   || 'An unexpected server error occurred.';

    // ----------------------------------------------------------------
    // PostgreSQL-specific error codes (pg driver sets err.code)
    // ----------------------------------------------------------------
    if (err.code) {
        switch (err.code) {
            case '23505': // unique_violation
                statusCode = 409;
                message    = `Duplicate value: ${err.detail || 'A record with that value already exists.'}`;
                break;

            case '23503': // foreign_key_violation
                statusCode = 409;
                message    = `Referential integrity violation: ${err.detail || 'The referenced record does not exist.'}`;
                break;

            case '23502': // not_null_violation
                statusCode = 400;
                message    = `Missing required field: ${err.column || 'unknown column'}.`;
                break;

            case '23514': // check_violation
                statusCode = 400;
                message    = `Value failed validation constraint: ${err.constraint || err.detail || 'check constraint violated'}.`;
                break;

            case '22P02': // invalid_text_representation (bad UUID / enum cast)
                statusCode = 400;
                message    = 'Invalid data format in request.';
                break;

            default:
                break;
        }
    }

    // Never leak internal stack traces to clients in production
    const body = {
        success: false,
        message,
    };

    if (process.env.NODE_ENV !== 'production') {
        body.stack = err.stack;
    }

    res.status(statusCode).json(body);
};

module.exports = errorHandler;
