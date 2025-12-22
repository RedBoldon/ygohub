import * as jose from 'jose';
import crypto from 'crypto';
import {pool} from "../db.js";

const accessSecret = new TextEncoder().encode(process.env.ACCESS_TOKEN_SECRET);
const refreshSecret = new TextEncoder().encode(process.env.REFRESH_TOKEN_SECRET);

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export async function generateAccessToken(userId){
    return await new jose.SignJWT({userId})
        .setProtectedHeader({ alg: 'HS256'})
        .setIssuedAt()
        .setExpirationTime('15min')
        .sign(accessSecret);
}

export async function generateRefreshToken(userId){
    const token = await new jose.SignJWT({userId})
        .setProtectedHeader({ alg: 'HS256'})
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(refreshSecret);
    // Store hash in database
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await pool.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt]
    );

    return token;
}

export async function verifyAccessToken(token){
    try {
        const { payload } = await jose.jwtVerify(token, accessSecret);
        return payload;
    } catch (error) {
        return null;
    }
}

export async function verifyRefreshToken(token) {
    try {
        // 1. Verify signature
        const { payload } = await jose.jwtVerify(token, refreshSecret);

        // 2. Check if token exists in database
        const tokenHash = hashToken(token);
        const result = await pool.query(
            `SELECT id FROM refresh_tokens WHERE token_hash = $1`,
            [tokenHash]
        );

        if (result.rows.length === 0) {
            return null; // Token was revoked
        }

        return payload;
    } catch (err) {
        return null;
    }
}

export async function revokeRefreshToken(token) {
    const tokenHash = hashToken(token);
    await pool.query(
        `DELETE FROM refresh_tokens WHERE token_hash = $1`,
        [tokenHash]
    );
}

export async function revokeAllUserTokens(userId) {
    await pool.query(
        `DELETE FROM refresh_tokens WHERE user_id = $1`,
        [userId]
    );
}