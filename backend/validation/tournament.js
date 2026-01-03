import { z } from 'zod';

export const createTournamentSchema = z.object({
    name: z.string()
        .min(1, 'Tournament name is required')
        .max(100, 'Tournament name must be 100 characters or less')
        .trim(),
    minPlayerCount: z.number()
        .int()
        .min(2, 'Minimum 2 players required')
        .default(2),
    maxPlayerCount: z.number()
        .int()
        .min(2, 'Maximum players must be at least 2')
        .optional(),
    formatId: z.number()
        .int()
        .positive('Format ID must be positive')
        .optional(),
    seriesId: z.number()
        .int()
        .positive()
        .optional(),
    location: z.string()
        .max(500, 'Location must be 500 characters or less')
        .trim()
        .optional(),
    startingTime: z.string()
        .datetime({ message: 'Invalid datetime format' })
        .optional(),
    numberOfRounds: z.number()
        .int()
        .min(1, 'Must have at least 1 round')
        .optional(),
    // Deck mode: 'player' = players bring own decks, 'organizer' = organizer assigns decks
    deckMode: z.enum(['player', 'organizer']).default('player'),
    // Collection ID for organizer deck mode
    collectionId: z.number()
        .int()
        .positive()
        .optional(),
}).refine(
    data => !data.maxPlayerCount || !data.minPlayerCount || data.maxPlayerCount >= data.minPlayerCount,
    { message: 'Max players must be greater than or equal to min players', path: ['maxPlayerCount'] }
).refine(
    data => data.deckMode !== 'organizer' || data.collectionId,
    { message: 'Collection is required when using organizer deck mode', path: ['collectionId'] }
);
