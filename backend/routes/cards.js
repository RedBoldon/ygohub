import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { pool } from '../db.js';

const router = Router();

// ------------------------------------------------------------------
// CARD SEARCH
// ------------------------------------------------------------------

/**
 * GET /cards
 * Search cards with filters
 */
router.get('/', async (req, res) => {
    const { 
        name, 
        type, 
        race, 
        attribute, 
        archetype, 
        frametype,
        level,
        atk_min,
        atk_max,
        def_min,
        def_max,
        limit = 50,
        offset = 0 
    } = req.query;

    try {
        let query = 'SELECT * FROM cards WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (name) {
            query += ` AND LOWER(name) LIKE LOWER($${paramIndex})`;
            params.push(`%${name}%`);
            paramIndex++;
        }

        if (type) {
            query += ` AND LOWER(type) LIKE LOWER($${paramIndex})`;
            params.push(`%${type}%`);
            paramIndex++;
        }

        if (race) {
            query += ` AND LOWER(race) = LOWER($${paramIndex})`;
            params.push(race);
            paramIndex++;
        }

        if (attribute) {
            query += ` AND UPPER(attribute) = UPPER($${paramIndex})`;
            params.push(attribute);
            paramIndex++;
        }

        if (archetype) {
            query += ` AND LOWER(archetype) LIKE LOWER($${paramIndex})`;
            params.push(`%${archetype}%`);
            paramIndex++;
        }

        if (frametype) {
            query += ` AND frametype = $${paramIndex}`;
            params.push(frametype);
            paramIndex++;
        }

        if (level) {
            query += ` AND level = $${paramIndex}`;
            params.push(parseInt(level));
            paramIndex++;
        }

        if (atk_min) {
            query += ` AND atk >= $${paramIndex}`;
            params.push(parseInt(atk_min));
            paramIndex++;
        }

        if (atk_max) {
            query += ` AND atk <= $${paramIndex}`;
            params.push(parseInt(atk_max));
            paramIndex++;
        }

        if (def_min) {
            query += ` AND def >= $${paramIndex}`;
            params.push(parseInt(def_min));
            paramIndex++;
        }

        if (def_max) {
            query += ` AND def <= $${paramIndex}`;
            params.push(parseInt(def_max));
            paramIndex++;
        }

        // Order and pagination
        query += ` ORDER BY name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) FROM cards WHERE 1=1';
        const countParams = params.slice(0, -2); // Remove limit/offset
        let countParamIndex = 1;

        if (name) {
            countQuery += ` AND LOWER(name) LIKE LOWER($${countParamIndex})`;
            countParamIndex++;
        }
        if (type) {
            countQuery += ` AND LOWER(type) LIKE LOWER($${countParamIndex})`;
            countParamIndex++;
        }
        if (race) {
            countQuery += ` AND LOWER(race) = LOWER($${countParamIndex})`;
            countParamIndex++;
        }
        if (attribute) {
            countQuery += ` AND UPPER(attribute) = UPPER($${countParamIndex})`;
            countParamIndex++;
        }
        if (archetype) {
            countQuery += ` AND LOWER(archetype) LIKE LOWER($${countParamIndex})`;
            countParamIndex++;
        }
        if (frametype) {
            countQuery += ` AND frametype = $${countParamIndex}`;
            countParamIndex++;
        }
        if (level) {
            countQuery += ` AND level = $${countParamIndex}`;
            countParamIndex++;
        }
        if (atk_min) {
            countQuery += ` AND atk >= $${countParamIndex}`;
            countParamIndex++;
        }
        if (atk_max) {
            countQuery += ` AND atk <= $${countParamIndex}`;
            countParamIndex++;
        }
        if (def_min) {
            countQuery += ` AND def >= $${countParamIndex}`;
            countParamIndex++;
        }
        if (def_max) {
            countQuery += ` AND def <= $${countParamIndex}`;
            countParamIndex++;
        }

        const countResult = await pool.query(countQuery, countParams);

        res.json({
            cards: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (err) {
        console.error('Card search error:', err);
        res.status(500).json({ error: 'Failed to search cards' });
    }
});

/**
 * GET /cards/:id
 * Get single card by ID
 */
router.get('/:id', async (req, res) => {
    const cardId = parseInt(req.params.id);

    if (isNaN(cardId)) {
        return res.status(400).json({ error: 'Invalid card ID' });
    }

    try {
        const result = await pool.query('SELECT * FROM cards WHERE id = $1', [cardId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Card not found' });
        }

        res.json({ card: result.rows[0] });
    } catch (err) {
        console.error('Get card error:', err);
        res.status(500).json({ error: 'Failed to get card' });
    }
});

/**
 * GET /cards/archetypes
 * Get list of all archetypes
 */
router.get('/meta/archetypes', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT DISTINCT archetype FROM cards 
             WHERE archetype IS NOT NULL AND archetype != ''
             ORDER BY archetype`
        );
        res.json({ archetypes: result.rows.map(r => r.archetype) });
    } catch (err) {
        console.error('Get archetypes error:', err);
        res.status(500).json({ error: 'Failed to get archetypes' });
    }
});

/**
 * GET /cards/meta/races
 * Get list of all races/types
 */
router.get('/meta/races', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT DISTINCT race FROM cards 
             WHERE race IS NOT NULL
             ORDER BY race`
        );
        res.json({ races: result.rows.map(r => r.race) });
    } catch (err) {
        console.error('Get races error:', err);
        res.status(500).json({ error: 'Failed to get races' });
    }
});

export default router;
