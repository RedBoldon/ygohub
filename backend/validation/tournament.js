import { z } from 'zod';

export const createTournamentSchema = z.object({
    name: z.string()
        .min(1, 'Tournament name is required')
        .max(100, 'Tournament name must be 100 characters or less')
        .trim(),
    minPlayerCount: z.number()
        .int()
        .min(2, 'Minimum 2 players required'),
    maxPlayerCount: z.number()
        .int()
        .min(2, 'Maximum players must be at least 2'),
    formatId: z.number()
        .int()
        .positive('Format is required'),
    seriesId: z.number()
        .int()
        .positive()
        .optional(),
    location: z.string()
        .max(200, 'Location must be 200 characters or less')
        .trim()
        .optional(),
    startingTime: z.iso
        .datetime({ message: 'Invalid datetime format' })
}).refine(
    data => data.maxPlayerCount >= data.minPlayerCount,
    { message: 'Max players must be greater than or equal to min players', path: ['maxPlayerCount'] }
);