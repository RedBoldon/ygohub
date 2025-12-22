import { verifyAccessToken } from "../utils/tokens.js";

export async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    // 2. Check it exists and has the right format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    // 3. Extract the token (remove "Bearer " prefix)
    const token = authHeader.split(' ')[1];

    // 4. Verify it
    const payload = await verifyAccessToken(token);

    if (!payload) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // 5. Attach user info to request and continue
    req.user = payload;
    next();
}

export async function optionalAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    req.user = null;  // default

    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const payload = await verifyAccessToken(token);
        if (payload) req.user = payload;
    }

    next();
}