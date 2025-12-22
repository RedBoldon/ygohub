import { z } from 'zod';

export const registerSchema = z.object({
    email: z.email()
        .max(254, 'Email must be less than 254 characters')
        .toLowerCase()
        .trim(),

    password: z.string()
    .min(8, 'Password must be at least 8 characters')
        .max(72, 'Password must be less than 72 characters')
});

export const setUsernameSchema = z.object({
    username: z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(20, 'Username must be 20 characters or less')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
    tag: z.number()
        .int('Tag must be a whole number')
        .min(0, 'Tag must be between 0 and 9999')
        .max(9999, 'Tag must be between 0 and 9999')
});

export const loginSchema = z.object({
    email: z.email()
    .max(254, 'Email must be less than 254 characters')
    .toLowerCase()
    .trim(),
    password: z.string()
    .min(1, 'Password is required')
});