/**
 * config/db.js
 * PostgreSQL connection pool.
 *
 * Uses the `pg` Pool so that connections are reused across requests
 * rather than opened/closed on every query. On Render the DATABASE_URL
 * already includes the ssl=require parameter, so we enable ssl only when
 * not running locally.
 */

const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Render's managed Postgres requires SSL; skip in local dev unless overridden
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    // Pool tuning — sensible defaults for a small clinic workload
    max: 10,               // maximum simultaneous connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Emit a single log on first successful connection
pool.on('connect', () => {
    if (process.env.NODE_ENV !== 'test') {
        console.log('[DB] PostgreSQL pool connection established');
    }
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected pool client error:', err.message);
    process.exit(1); // crash fast — let Render restart the service
});

/**
 * query(text, params)
 * Thin wrapper so controllers import one function rather than the pool.
 * Always returns a pg QueryResult; destructure .rows as needed.
 */
const query = (text, params) => pool.query(text, params);

/**
 * getClient()
 * Returns a dedicated client for multi-statement transactions.
 * Caller MUST call client.release() in a finally block.
 */
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
