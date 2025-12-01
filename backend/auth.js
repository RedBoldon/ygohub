// auth.js
// Authentication logic for YGOHub

import argon2 from 'argon2';
import { pool } from './db.js';

//register user with email, password. set status to no_username

export async function registerUser(email, password) {

    try{
    //validation
    if (!email || !password) {
        throw new Error('Email and password are required');
    }
    
    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
    }
    
    // Password requirements
    if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
    }

    //hash password
    const passwordHash = await argon2.hash(password);
    
    //create user
    const userCreated = await pool.query(
        `INSERT INTO users (email, password_hash, status)
         VALUES ($1, $2, 'no_username')
         RETURNING id, email, status, created_at`,
        [email, passwordHash]
    );
    
    // Return the created user (note: we don't return password_hash!)
    return userCreated.rows[0];
}
catch(error){
    console.log(error);
}
}


