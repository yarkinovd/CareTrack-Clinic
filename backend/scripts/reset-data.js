/**
 * scripts/reset-data.js
 * Barcha test ma'lumotlarini o'chiradi.
 * Faqat admin va receptionist hisoblarini qoldiradi.
 *
 * Ishlatish: node backend/scripts/reset-data.js
 */

require('dotenv').config();
const { pool } = require('../config/db');

async function reset() {
    const client = await pool.connect();
    try {
        console.log('Ma\'lumotlarni tozalash boshlandi...');
        await client.query('BEGIN');

        await client.query(`DELETE FROM appointments`);
        await client.query(`DELETE FROM diagnoses`);
        await client.query(`DELETE FROM users WHERE role IN ('clinician', 'patient')`);
        await client.query(`DELETE FROM patients`);
        await client.query(`DELETE FROM doctors`);

        // ID ketma-ketliklarini qayta boshlash
        await client.query(`ALTER SEQUENCE IF EXISTS appointments_id_seq RESTART WITH 1`);
        await client.query(`ALTER SEQUENCE IF EXISTS diagnoses_id_seq    RESTART WITH 1`);
        await client.query(`ALTER SEQUENCE IF EXISTS patients_id_seq     RESTART WITH 1`);
        await client.query(`ALTER SEQUENCE IF EXISTS doctors_id_seq      RESTART WITH 1`);

        await client.query('COMMIT');
        console.log('✓ Barcha ma\'lumotlar tozalandi.');
        console.log('✓ Admin va receptionist hisoblar saqlab qolindi.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Xatolik:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

reset();
