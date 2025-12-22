import { z } from 'zod';

// Valid frametypes from DB constraint
const VALID_FRAMETYPES = [
    'spell', 'effect', 'normal', 'link', 'trap', 'fusion',
    'effect_pendulum', 'xyz', 'synchro', 'ritual', 'skill', 'token',
    'fusion_pendulum', 'normal_pendulum', 'synchro_pendulum',
    'xyz_pendulum', 'ritual_pendulum'
];

// Base card fields schema (shared between create and update)
const cardFieldsSchema = {
    name: z.string()
        .min(1, 'Card name is required')
        .max(200, 'Card name must be 200 characters or less')
        .trim(),
    type: z.string()
        .min(1, 'Card type is required')
        .trim(),
    humanreadablecardtype: z.string()
        .min(1, 'Human readable card type is required')
        .trim(),
    frametype: z.enum(VALID_FRAMETYPES, {
        errorMap: () => ({ message: `Frame type must be one of: ${VALID_FRAMETYPES.join(', ')}` })
    }),
    description: z.string()
        .min(1, 'Card description is required'),
    race: z.string()
        .min(1, 'Race/Spell type is required')
        .trim(),
    archetype: z.string()
        .max(100, 'Archetype must be 100 characters or less')
        .trim()
        .optional()
        .nullable(),
    atk: z.number()
        .int()
        .min(0, 'ATK cannot be negative')
        .optional()
        .nullable(),
    def: z.number()
        .int()
        .min(0, 'DEF cannot be negative')
        .optional()
        .nullable(),
    level: z.number()
        .int()
        .min(0, 'Level cannot be negative')
        .max(13, 'Level cannot exceed 13')
        .optional()
        .nullable(),
    attribute: z.string()
        .max(20, 'Attribute must be 20 characters or less')
        .trim()
        .optional()
        .nullable()
};

// Schema for creating a new custom card
export const createCustomCardSchema = z.object({
    ...cardFieldsSchema,
    // Optional origin tracking
    originCardId: z.number()
        .int()
        .positive()
        .optional()
        .nullable(),
    originCustomCardId: z.number()
        .int()
        .positive()
        .optional()
        .nullable(),
    originUserId: z.number()
        .int()
        .positive()
        .optional()
        .nullable()
}).refine(
    data => {
        // If it's a monster card (has ATK), it should have level/rank
        const isMonster = data.atk !== null && data.atk !== undefined;
        if (isMonster && data.frametype !== 'link') {
            // Non-link monsters should have level
            // (this is a soft validation, can be adjusted)
        }
        return true;
    },
    { message: 'Invalid card configuration' }
);

// Schema for updating a custom card (all fields optional)
export const updateCustomCardSchema = z.object({
    name: cardFieldsSchema.name.optional(),
    type: cardFieldsSchema.type.optional(),
    humanreadablecardtype: cardFieldsSchema.humanreadablecardtype.optional(),
    frametype: z.enum(VALID_FRAMETYPES).optional(),
    description: cardFieldsSchema.description.optional(),
    race: cardFieldsSchema.race.optional(),
    archetype: cardFieldsSchema.archetype,
    atk: cardFieldsSchema.atk,
    def: cardFieldsSchema.def,
    level: cardFieldsSchema.level,
    attribute: cardFieldsSchema.attribute
}).refine(
    data => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
);

// Schema for editing a snapshot custom card
export const editSnapshotCustomCardSchema = z.object({
    changes: updateCustomCardSchema,
    propagateToSource: z.boolean().optional().default(true)
});
