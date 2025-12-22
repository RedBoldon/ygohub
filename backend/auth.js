// auth.js
// Authentication logic for YGOHub

import argon2 from 'argon2';
import { pool } from './db.js';

//register user with email, password. set status to no_username

export async function registerUser(email, password) {

    try {
        const passwordHash = await argon2.hash(password);

        const maxAttempts = 10;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {

            const username = "user_" + crypto.randomUUID().slice(0, 12);
            const tag = Math.floor(Math.random() * 10000);

            try {
                const userCreated = await pool.query(
                    `INSERT INTO users (email, password_hash, username, tag, status)
                     VALUES ($1, $2, $3, $4, 'no_username')
                     RETURNING id, email, username, tag, status, created_at`,
                    [email, passwordHash, username, tag]
                );

                await pool.query(
                    `INSERT INTO audit_logs (entity_type, entity_id, action, new_value, performed_by)
     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        'user',
                        userCreated.rows[0].id,
                        'create',
                        JSON.stringify({ email, username, tag, attempts: attempt + 1 }),
                        null  // or the user's own id, or 'system'
                    ]
                );

                return userCreated.rows[0];
            } catch (err) {
                // 23505 = unique violation in PostgreSQL
                if (err.code === '23505' && attempt < maxAttempts - 1) {
                    continue;
                }
                throw err;
            }
        }

        throw new Error('Failed to generate unique username/tag');
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

export async function setUsername(userId, username, tag) {
    const result = await pool.query(
        `UPDATE users 
     SET username = $1, tag = $2, status = 'active'
     WHERE id = $3
     RETURNING id, email, username, tag, status`,
        [username, tag, userId]
    );

    return result.rows[0];
}

export async function loginUser(email, password) {
    const result = await pool.query(`
    SELECT id, email, username, tag, status, password_hash FROM users WHERE email = $1`, [email]);
    const user = result.rows[0];

    if(!user) {
        throw new Error('Invalid email or password');
    }

    const isPasswordValid = await argon2.verify(user.password_hash, password);
    if(!isPasswordValid) {
        throw new Error('Invalid email or password');
    }

    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
}


