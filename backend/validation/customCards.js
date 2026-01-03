import { z } from 'zod';

// Valid frametypes from DB constraint
const VALID_FRAMETYPES = [
    'spell', 'effect', 'normal', 'link', 'trap', 'fusion',
    'effect_pendulum', 'xyz', 'synchro', 'ritual', 'skill', 'token',
    'fusion_pendulum', 'normal_pendulum', 'synchro_pendulum',
    'xyz_pendulum', 'ritual_pendulum'
];

// Mapping from humanReadableCardType to frametype and type
const CARD_TYPE_MAPPING = {
    // Spells
    'Normal Spell': { frametype: 'spell', type: 'Spell Card' },
    'Quick-Play Spell': { frametype: 'spell', type: 'Spell Card' },
    'Continuous Spell': { frametype: 'spell', type: 'Spell Card' },
    'Equip Spell': { frametype: 'spell', type: 'Spell Card' },
    'Field Spell': { frametype: 'spell', type: 'Spell Card' },
    'Ritual Spell': { frametype: 'spell', type: 'Spell Card' },
    // Traps
    'Normal Trap': { frametype: 'trap', type: 'Trap Card' },
    'Continuous Trap': { frametype: 'trap', type: 'Trap Card' },
    'Counter Trap': { frametype: 'trap', type: 'Trap Card' },
    // Monsters
    'Normal Monster': { frametype: 'normal', type: 'Normal Monster' },
    'Effect Monster': { frametype: 'effect', type: 'Effect Monster' },
    'Flip Effect Monster': { frametype: 'effect', type: 'Flip Effect Monster' },
    'Tuner Monster': { frametype: 'effect', type: 'Tuner Monster' },
    'Gemini Monster': { frametype: 'effect', type: 'Gemini Monster' },
    'Spirit Monster': { frametype: 'effect', type: 'Spirit Monster' },
    'Union Monster': { frametype: 'effect', type: 'Union Effect Monster' },
    'Toon Monster': { frametype: 'effect', type: 'Toon Monster' },
    'Ritual Monster': { frametype: 'ritual', type: 'Ritual Monster' },
    'Ritual Effect Monster': { frametype: 'ritual', type: 'Ritual Effect Monster' },
    'Fusion Monster': { frametype: 'fusion', type: 'Fusion Monster' },
    'Synchro Monster': { frametype: 'synchro', type: 'Synchro Monster' },
    'Synchro Tuner Monster': { frametype: 'synchro', type: 'Synchro Tuner Monster' },
    'XYZ Monster': { frametype: 'xyz', type: 'XYZ Monster' },
    'Link Monster': { frametype: 'link', type: 'Link Monster' },
    'Pendulum Normal Monster': { frametype: 'normal_pendulum', type: 'Pendulum Normal Monster' },
    'Pendulum Effect Monster': { frametype: 'effect_pendulum', type: 'Pendulum Effect Monster' },
    'Pendulum Tuner Effect Monster': { frametype: 'effect_pendulum', type: 'Pendulum Tuner Effect Monster' },
    'Pendulum Flip Effect Monster': { frametype: 'effect_pendulum', type: 'Pendulum Flip Effect Monster' },
    'Synchro Pendulum Monster': { frametype: 'synchro_pendulum', type: 'Synchro Pendulum Effect Monster' },
    'XYZ Pendulum Monster': { frametype: 'xyz_pendulum', type: 'XYZ Pendulum Effect Monster' },
    'Fusion Pendulum Monster': { frametype: 'fusion_pendulum', type: 'Fusion Pendulum Effect Monster' },
    'Ritual Pendulum Monster': { frametype: 'ritual_pendulum', type: 'Ritual Pendulum Effect Monster' },
};

const VALID_HUMAN_READABLE_TYPES = Object.keys(CARD_TYPE_MAPPING);

// Helper to check if card type is a spell or trap
function isSpellOrTrap(humanReadableType) {
    return humanReadableType?.includes('Spell') || humanReadableType?.includes('Trap');
}

// Schema for creating a new custom card
export const createCustomCardSchema = z.object({
    name: z.string()
        .min(1, 'Card name is required')
        .max(200, 'Card name must be 200 characters or less')
        .trim(),
    humanreadablecardtype: z.enum(VALID_HUMAN_READABLE_TYPES, {
        errorMap: () => ({ message: `Card type must be one of: ${VALID_HUMAN_READABLE_TYPES.join(', ')}` })
    }),
    description: z.string()
        .min(1, 'Card description is required'),
    // Race/Type - free text, max 30 chars (e.g., "Dragon", "Continuous", "Counter")
    race: z.string()
        .min(1, 'Type is required')
        .max(30, 'Type must be 30 characters or less')
        .trim(),
    // Monster-only fields (optional, only for monsters)
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
    attribute: z.enum(['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND', 'DIVINE'], {
        errorMap: () => ({ message: 'Invalid attribute' })
    }).optional().nullable(),
    // Optional origin tracking
    originCardId: z.number().int().positive().optional().nullable(),
    originCustomCardId: z.number().int().positive().optional().nullable(),
    originUserId: z.number().int().positive().optional().nullable()
}).transform(data => {
    // Auto-set type and frametype based on humanreadablecardtype
    const mapping = CARD_TYPE_MAPPING[data.humanreadablecardtype];
    
    // For spells/traps, clear monster-specific fields
    if (isSpellOrTrap(data.humanreadablecardtype)) {
        return {
            ...data,
            type: mapping.type,
            frametype: mapping.frametype,
            atk: null,
            def: null,
            level: null,
            attribute: null
        };
    }
    
    // For monsters, keep all fields
    return {
        ...data,
        type: mapping.type,
        frametype: mapping.frametype
    };
});

// Schema for updating a custom card (all fields optional)
export const updateCustomCardSchema = z.object({
    name: z.string()
        .min(1, 'Card name is required')
        .max(200, 'Card name must be 200 characters or less')
        .trim()
        .optional(),
    humanreadablecardtype: z.enum(VALID_HUMAN_READABLE_TYPES).optional(),
    description: z.string().min(1, 'Card description is required').optional(),
    race: z.string()
        .min(1, 'Type is required')
        .max(30, 'Type must be 30 characters or less')
        .trim()
        .optional(),
    atk: z.number().int().min(0).optional().nullable(),
    def: z.number().int().min(0).optional().nullable(),
    level: z.number().int().min(0).max(13).optional().nullable(),
    attribute: z.enum(['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND', 'DIVINE']).optional().nullable()
}).refine(
    data => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
).transform(data => {
    // If humanreadablecardtype is being updated, auto-set type and frametype
    if (data.humanreadablecardtype) {
        const mapping = CARD_TYPE_MAPPING[data.humanreadablecardtype];
        
        if (isSpellOrTrap(data.humanreadablecardtype)) {
            return {
                ...data,
                type: mapping.type,
                frametype: mapping.frametype,
                atk: null,
                def: null,
                level: null,
                attribute: null
            };
        }
        
        return {
            ...data,
            type: mapping.type,
            frametype: mapping.frametype
        };
    }
    
    return data;
});

// Schema for editing a snapshot custom card
export const editSnapshotCustomCardSchema = z.object({
    changes: updateCustomCardSchema,
    propagateToSource: z.boolean().optional().default(true)
});

// Export for frontend use
export { CARD_TYPE_MAPPING, VALID_HUMAN_READABLE_TYPES };
