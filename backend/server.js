/**
 * server.js
 * CareTrack Clinic — Express entry point.
 *
 * Startup order:
 *   1. Load env vars
 *   2. Configure Express + security middleware
 *   3. Mount API routes
 *   4. Attach global error handler
 *   5. Start HTTP server
 */

require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

const { runMigrations } = require('./config/db');
const errorHandler   = require('./middleware/errorHandler');
const authRoutes     = require('./routes/authRoutes');
const doctorRoutes   = require('./routes/doctorRoutes');
const patientRoutes  = require('./routes/patientRoutes');
const diagnosisRoutes = require('./routes/diagnosisRoutes');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Security ────────────────────────────────────────────────────────────────

// Sets secure HTTP headers (XSS protection, no-sniff, frameguard, etc.)
app.use(helmet());

// CORS — if CORS_ORIGINS=* allow all, otherwise check against comma-separated list
const corsOriginsSetting = process.env.CORS_ORIGINS || 'http://localhost:3000';
const allowAllOrigins   = corsOriginsSetting.trim() === '*';
const allowedOrigins    = allowAllOrigins
    ? []
    : corsOriginsSetting.split(',').map((o) => o.trim());

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS policy does not allow origin: ${origin}`));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

// Rate limiting — 100 requests per 15 min per IP to mitigate brute-force
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

// ─── Request Parsing ──────────────────────────────────────────────────────────

app.use(express.json({ limit: '10kb' }));       // body-parser with size cap
app.use(express.urlencoded({ extended: false }));

// ─── Logging ─────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── Static Frontend ─────────────────────────────────────────────────────────
// Serve the Vanilla JS frontend from the sibling /frontend folder.
// On Render you can either host it as a separate Static Site or let Express serve it.
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/auth',      authRoutes);
app.use('/api/doctors',   doctorRoutes);
app.use('/api/patients',  patientRoutes);
app.use('/api/diagnoses', diagnosisRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        service: 'CareTrack Clinic API',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});

// ─── 404 Catch-All ────────────────────────────────────────────────────────────

app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found.` });
});

// ─── Global Error Handler (must be last) ─────────────────────────────────────

app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
// Run DB migrations first, then open the HTTP port.

const start = async () => {
    await runMigrations();
    app.listen(PORT, () => {
        console.log(`[SERVER] CareTrack Clinic API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
};

start();

module.exports = app; // exported for testing
