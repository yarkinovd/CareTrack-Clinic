/**
 * config/db.js
 * PostgreSQL connection pool + auto-migration on startup.
 *
 * runMigrations() reads schema.sql and seed.sql and executes them against
 * the database every time the server starts. All statements use
 * IF NOT EXISTS / ON CONFLICT DO NOTHING so repeated runs are safe.
 */

const { Pool }  = require('pg');
const bcrypt    = require('bcryptjs');
const fs        = require('fs');
const path      = require('path');

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
    const sqlDir = path.join(__dirname, '..', 'sql');
    const client = await pool.connect();

    try {
        // 1. Schema — tables, indexes, triggers
        const schema = fs.readFileSync(path.join(sqlDir, 'schema.sql'), 'utf8');
        console.log('[DB] Running migration: schema.sql');
        await client.query(schema);
        console.log('[DB] Migration complete: schema.sql');

        // 2. Seed — doctors, patients, diagnoses
        const seed = fs.readFileSync(path.join(sqlDir, 'seed.sql'), 'utf8');
        console.log('[DB] Running migration: seed.sql');
        await client.query(seed);
        console.log('[DB] Migration complete: seed.sql');

        // 3. Seed users via JS so bcrypt hashes are correct
        await seedUsers(client);
    } catch (err) {
        console.error('[DB] Migration failed:', err.message);
        throw err;
    } finally {
        client.release();
    }
};

// Default users — all use Admin@1234 as password
const seedUsers = async (client) => {
    const users = [
        { username: 'admin',        email: 'admin@caretrack.com',      password: 'Admin@1234', role: 'admin' },
        { username: 'dr_wilson',    email: 'wilson@caretrack.com',     password: 'Admin@1234', role: 'clinician' },
        { username: 'receptionist', email: 'reception@caretrack.com',  password: 'Admin@1234', role: 'receptionist' },
    ];

    for (const u of users) {
        const exists = await client.query('SELECT id FROM users WHERE username = $1', [u.username]);
        if (exists.rows.length === 0) {
            const hash = await bcrypt.hash(u.password, 10);
            await client.query(
                'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)',
                [u.username, u.email, hash, u.role]
            );
            console.log(`[DB] Seeded user: ${u.username} (${u.role})`);
        }
    }

    // Link dr_wilson to Dr. James Okonkwo so patient filtering works
    const wilsonRes = await client.query("SELECT id FROM users WHERE username = 'dr_wilson'");
    const jamesRes  = await client.query("SELECT id FROM doctors WHERE name = 'Dr. James Okonkwo' LIMIT 1");
    if (wilsonRes.rows.length && jamesRes.rows.length) {
        await client.query(
            'UPDATE users SET doctor_id = $1 WHERE id = $2 AND doctor_id IS NULL',
            [jamesRes.rows[0].id, wilsonRes.rows[0].id]
        );
    }
};

const query     = (text, params) => pool.query(text, params);
const getClient = () => pool.connect();

module.exports = { query, getClient, pool, runMigrations };
