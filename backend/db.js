import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

pool.query('SELECT NOW()')
.then(res => console.log('DB connected', res.rows[0]))
    .catch(err => console.log(err));