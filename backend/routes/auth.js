import { Router } from 'express';
import { registerUser, setUsername, loginUser} from "../auth.js";
import { registerSchema, setUsernameSchema, loginSchema } from "../validation/auth.js";
import { generateAccessToken,
    generateRefreshToken,
verifyRefreshToken,
revokeRefreshToken} from "../utils/tokens.js";
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/me', authMiddleware, async (req, res) => {
    res.json({ message: 'You are authenticated', user: req.user });
});

router.post('/register', async (req, res) => {
    // 1. Validate input
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: result.error.flatten().fieldErrors
        });
    }

    // 2. result.data is now validated & transformed (lowercased, trimmed)
    try {
        const user = await registerUser(result.data.email, result.data.password);

        const accessToken = await generateAccessToken(user.id);
        const refreshToken = await generateRefreshToken(user.id);

        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                tag: user.tag,
                status: user.status
            },
            accessToken,
            refreshToken
        });
    } catch (err) {
        // Handle DB errors (like duplicate email)
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Email already registered' });
        }
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

router.post('/user/username', authMiddleware, async (req, res) => {
    const result = setUsernameSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: result.error.flatten().fieldErrors
        });
    }

    try {
        const user = await setUsername(req.user.userId, result.data.username, result.data.tag);
        res.json({ user });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Username and tag combination already taken' });
        }
        console.error('Set username error:', err);
        res.status(500).json({ error: 'Failed to set username' });
    }
});

// Refresh tokens
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
    }

    const payload = await verifyRefreshToken(refreshToken);

    if (!payload) {
        return res.status(401).json({ error: 'Invalid or revoked refresh token' });
    }

    // Revoke old token
    await revokeRefreshToken(refreshToken);

    // Issue new tokens
    const newAccessToken = await generateAccessToken(payload.userId);
    const newRefreshToken = await generateRefreshToken(payload.userId);

    res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
    });
});

// Logout
router.post('/logout', authMiddleware, async (req, res) => {
    const { refreshToken } = req.body;

    if (refreshToken) {
        await revokeRefreshToken(refreshToken);
    }

    res.json({ message: 'Logged out successfully' });
});

router.post('/login', async (req, res) => {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: result.error.flatten().fieldErrors
        });
    }

    try {
        const user = await loginUser(result.data.email, result.data.password);

        const accessToken = await generateAccessToken(user.id);
        const refreshToken = await generateRefreshToken(user.id);

        res.json({ user, accessToken, refreshToken });
    } catch (err) {
        res.status(401).json({ error: 'Invalid email or password' });
    }
});

export default router;