/**
 * config/db.js
 * PostgreSQL connection pool + auto-migration on startup.
 *
 * runMigrations() reads schema.sql and seed.sql and executes them against
 * the database every time the server starts. All statements use
 * IF NOT EXISTS / ON CONFLICT DO NOTHING so repeated runs are safe.
 */

const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
    if (process.env.NODE_ENV !== 'test') {
        console.log('[DB] PostgreSQL pool connection established');
    }
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected pool client error:', err.message);
    process.exit(1);
});

/**
 * runMigrations()
 * Reads schema.sql then seed.sql from the sql/ folder and executes them.
 * Safe to call on every startup — all SQL is idempotent.
 */
const runMigrations = async () => {
    const sqlDir  = path.join(__dirname, '..', 'sql');
    const files   = ['schema.sql', 'seed.sql'];
    const client  = await pool.connect();

    try {
        for (const file of files) {
            const filePath = path.join(sqlDir, file);
            const sql      = fs.readFileSync(filePath, 'utf8');
            console.log(`[DB] Running migration: ${file}`);
            await client.query(sql);
            console.log(`[DB] Migration complete: ${file}`);
        }
    } catch (err) {
        console.error('[DB] Migration failed:', err.message);
        throw err; // crash the server — misconfigured DB shouldn't serve requests
    } finally {
        client.release();
    }
};

const query     = (text, params) => pool.query(text, params);
const getClient = () => pool.connect();

module.exports = { query, getClient, pool, runMigrations };
