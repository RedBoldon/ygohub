import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { pool } from '../db.js';

const router = Router();

// ------------------------------------------------------------------
// HELPER FUNCTIONS - Route to correct tables based on allowCustomCards
// ------------------------------------------------------------------

function getTableNames(allowCustomCards) {
    if (allowCustomCards) {
        return {
            collections: 'custom_deck_collections',
            decks: 'custom_collection_decks',
            deckCards: 'custom_collection_deck_cards',
            snapshots: 'custom_collection_snapshots',
            snapshotDecks: 'custom_snapshot_decks',
            snapshotDeckCards: 'custom_snapshot_deck_cards'
        };
    }
    return {
        collections: 'deck_collections',
        decks: 'collection_decks',
        deckCards: 'collection_deck_cards',
        snapshots: 'collection_snapshots',
        snapshotDecks: 'snapshot_decks',
        snapshotDeckCards: 'snapshot_deck_cards'
    };
}

// ------------------------------------------------------------------
// COLLECTIONS
// ------------------------------------------------------------------

/**
 * GET /collections
 * Get all collections for the user (both standard and custom)
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        // Get standard collections
        const standardResult = await pool.query(
            `SELECT dc.*, FALSE as allow_custom_cards,
                    (SELECT COUNT(*) FROM collection_decks cd WHERE cd.collection_id = dc.id) as deck_count
             FROM deck_collections dc
             WHERE dc.user_id = $1`,
            [req.user.userId]
        );

        // Get custom collections
        const customResult = await pool.query(
            `SELECT dc.*, TRUE as allow_custom_cards,
                    (SELECT COUNT(*) FROM custom_collection_decks cd WHERE cd.collection_id = dc.id) as deck_count
             FROM custom_deck_collections dc
             WHERE dc.user_id = $1`,
            [req.user.userId]
        );

        // Combine and sort by updated_at
        const collections = [...standardResult.rows, ...customResult.rows]
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

        res.json({ collections });
    } catch (err) {
        console.error('Get collections error:', err);
        res.status(500).json({ error: 'Failed to get collections' });
    }
});

/**
 * GET /collections/:id
 * Get a specific collection with its decks
 */
router.get('/:id', authMiddleware, async (req, res) => {
    const collectionId = parseInt(req.params.id);
    if (isNaN(collectionId)) {
        return res.status(400).json({ error: 'Invalid collection ID' });
    }

    const isCustom = req.query.custom === 'true';
    const tables = getTableNames(isCustom);

    try {
        const collectionResult = await pool.query(
            `SELECT * FROM ${tables.collections} WHERE id = $1 AND user_id = $2`,
            [collectionId, req.user.userId]
        );

        if (collectionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        // Get decks with card count
        let decksQuery;
        if (isCustom) {
            decksQuery = `
                SELECT cd.*,
                       (SELECT COUNT(*) FROM ${tables.deckCards} cdc WHERE cdc.deck_id = cd.id) as card_count
                FROM ${tables.decks} cd
                WHERE cd.collection_id = $1
                ORDER BY cd.updated_at DESC`;
        } else {
            decksQuery = `
                SELECT cd.*,
                       (SELECT COUNT(*) FROM ${tables.deckCards} cdc WHERE cdc.deck_id = cd.id) as card_count
                FROM ${tables.decks} cd
                WHERE cd.collection_id = $1
                ORDER BY cd.updated_at DESC`;
        }

        const decksResult = await pool.query(decksQuery, [collectionId]);

        res.json({
            collection: {
                ...collectionResult.rows[0],
                allow_custom_cards: isCustom,
                decks: decksResult.rows
            }
        });
    } catch (err) {
        console.error('Get collection error:', err);
        res.status(500).json({ error: 'Failed to get collection' });
    }
});

/**
 * POST /collections
 * Create a new collection
 */
router.post('/', authMiddleware, async (req, res) => {
    const { name, description, allowCustomCards = false } = req.body;

    if (!name || name.length < 2 || name.length > 200) {
        return res.status(400).json({ error: 'Name must be between 2 and 200 characters' });
    }

    const tables = getTableNames(allowCustomCards);

    try {
        const result = await pool.query(
            `INSERT INTO ${tables.collections} (user_id, name, description)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [req.user.userId, name.trim(), description?.trim() || null]
        );
        res.status(201).json({ 
            collection: {
                ...result.rows[0],
                allow_custom_cards: allowCustomCards
            }
        });
    } catch (err) {
        console.error('Create collection error:', err);
        res.status(500).json({ error: 'Failed to create collection' });
    }
});

/**
 * PATCH /collections/:id
 * Update a collection
 */
router.patch('/:id', authMiddleware, async (req, res) => {
    const collectionId = parseInt(req.params.id);
    if (isNaN(collectionId)) {
        return res.status(400).json({ error: 'Invalid collection ID' });
    }

    const isCustom = req.query.custom === 'true';
    const tables = getTableNames(isCustom);

    const { name, description } = req.body;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
        if (name.length < 2 || name.length > 200) {
            return res.status(400).json({ error: 'Name must be between 2 and 200 characters' });
        }
        updates.push(`name = $${paramIndex}`);
        values.push(name.trim());
        paramIndex++;
    }

    if (description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        values.push(description?.trim() || null);
        paramIndex++;
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = NOW()`);

    try {
        values.push(collectionId, req.user.userId);
        const result = await pool.query(
            `UPDATE ${tables.collections} 
             SET ${updates.join(', ')}
             WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        res.json({ 
            collection: {
                ...result.rows[0],
                allow_custom_cards: isCustom
            }
        });
    } catch (err) {
        console.error('Update collection error:', err);
        res.status(500).json({ error: 'Failed to update collection' });
    }
});

/**
 * DELETE /collections/:id
 * Delete a collection
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    const collectionId = parseInt(req.params.id);
    if (isNaN(collectionId)) {
        return res.status(400).json({ error: 'Invalid collection ID' });
    }

    const isCustom = req.query.custom === 'true';
    const tables = getTableNames(isCustom);

    try {
        const result = await pool.query(
            `DELETE FROM ${tables.collections} WHERE id = $1 AND user_id = $2 RETURNING id`,
            [collectionId, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        res.json({ message: 'Collection deleted' });
    } catch (err) {
        console.error('Delete collection error:', err);
        res.status(500).json({ error: 'Failed to delete collection' });
    }
});

// ------------------------------------------------------------------
// DECKS
// ------------------------------------------------------------------

/**
 * POST /collections/:collectionId/decks
 * Add a deck to a collection
 */
router.post('/:collectionId/decks', authMiddleware, async (req, res) => {
    const collectionId = parseInt(req.params.collectionId);
    if (isNaN(collectionId)) {
        return res.status(400).json({ error: 'Invalid collection ID' });
    }

    const isCustom = req.query.custom === 'true';
    const tables = getTableNames(isCustom);

    const { deckName, archetype, description } = req.body;
    if (!deckName || deckName.length < 2 || deckName.length > 200) {
        return res.status(400).json({ error: 'Deck name must be between 2 and 200 characters' });
    }

    try {
        // Verify collection ownership
        const collectionCheck = await pool.query(
            `SELECT id FROM ${tables.collections} WHERE id = $1 AND user_id = $2`,
            [collectionId, req.user.userId]
        );
        if (collectionCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        const result = await pool.query(
            `INSERT INTO ${tables.decks} (collection_id, deck_name, archetype, description)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [collectionId, deckName.trim(), archetype?.trim() || null, description?.trim() || null]
        );

        // Update collection timestamp
        await pool.query(
            `UPDATE ${tables.collections} SET updated_at = NOW() WHERE id = $1`,
            [collectionId]
        );

        res.status(201).json({ deck: result.rows[0] });
    } catch (err) {
        console.error('Create deck error:', err);
        res.status(500).json({ error: 'Failed to create deck' });
    }
});

/**
 * GET /collections/decks/:deckId
 * Get a deck with its cards
 */
router.get('/decks/:deckId', authMiddleware, async (req, res) => {
    const deckId = parseInt(req.params.deckId);
    if (isNaN(deckId)) {
        return res.status(400).json({ error: 'Invalid deck ID' });
    }

    const isCustom = req.query.custom === 'true';
    const tables = getTableNames(isCustom);

    try {
        // Get deck with ownership check
        const deckResult = await pool.query(
            `SELECT cd.*, dc.user_id, dc.id as collection_id
             FROM ${tables.decks} cd
             JOIN ${tables.collections} dc ON cd.collection_id = dc.id
             WHERE cd.id = $1`,
            [deckId]
        );

        if (deckResult.rows.length === 0) {
            return res.status(404).json({ error: 'Deck not found' });
        }

        if (deckResult.rows[0].user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Get cards in deck with full card details
        let cardsResult;
        if (isCustom) {
            // Custom deck: can have both official cards and custom cards
            cardsResult = await pool.query(
                `SELECT cdc.id as entry_id, cdc.quantity, cdc.deck_section, 
                        cdc.card_id, cdc.custom_card_id,
                        COALESCE(c.name, cc.name) as name,
                        COALESCE(c.type, cc.type) as type,
                        COALESCE(c.humanreadablecardtype, cc.humanreadablecardtype) as humanreadablecardtype,
                        COALESCE(c.frametype, cc.frametype) as frametype,
                        COALESCE(c.description, cc.description) as description,
                        COALESCE(c.race, cc.race) as race,
                        COALESCE(c.archetype, cc.archetype) as archetype,
                        COALESCE(c.atk, cc.atk) as atk,
                        COALESCE(c.def, cc.def) as def,
                        COALESCE(c.level, cc.level) as level,
                        COALESCE(c.attribute, cc.attribute) as attribute,
                        CASE WHEN cc.id IS NOT NULL THEN TRUE ELSE FALSE END as is_custom
                 FROM ${tables.deckCards} cdc
                 LEFT JOIN cards c ON cdc.card_id = c.id
                 LEFT JOIN custom_cards cc ON cdc.custom_card_id = cc.id
                 WHERE cdc.deck_id = $1
                 ORDER BY 
                    CASE cdc.deck_section 
                        WHEN 'main' THEN 1 
                        WHEN 'extra' THEN 2 
                        WHEN 'side' THEN 3 
                    END,
                    COALESCE(c.name, cc.name)`,
                [deckId]
            );
        } else {
            // Standard deck: only official cards
            cardsResult = await pool.query(
                `SELECT cdc.quantity, cdc.deck_section, 
                        c.id, c.name, c.type, c.humanreadablecardtype, c.frametype, 
                        c.description, c.race, c.archetype, c.atk, c.def, c.level, c.attribute,
                        FALSE as is_custom
                 FROM ${tables.deckCards} cdc
                 JOIN cards c ON cdc.card_id = c.id
                 WHERE cdc.deck_id = $1
                 ORDER BY 
                    CASE cdc.deck_section 
                        WHEN 'main' THEN 1 
                        WHEN 'extra' THEN 2 
                        WHEN 'side' THEN 3 
                    END,
                    c.name`,
                [deckId]
            );
        }

        const deck = deckResult.rows[0];
        delete deck.user_id;

        res.json({
            deck: {
                ...deck,
                allow_custom_cards: isCustom,
                cards: cardsResult.rows
            }
        });
    } catch (err) {
        console.error('Get deck error:', err);
        res.status(500).json({ error: 'Failed to get deck' });
    }
});

/**
 * PATCH /collections/decks/:deckId
 * Update a deck
 */
router.patch('/decks/:deckId', authMiddleware, async (req, res) => {
    const deckId = parseInt(req.params.deckId);
    if (isNaN(deckId)) {
        return res.status(400).json({ error: 'Invalid deck ID' });
    }

    const isCustom = req.query.custom === 'true';
    const tables = getTableNames(isCustom);

    const { deckName, archetype, description } = req.body;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (deckName !== undefined) {
        if (deckName.length < 2 || deckName.length > 200) {
            return res.status(400).json({ error: 'Deck name must be between 2 and 200 characters' });
        }
        updates.push(`deck_name = $${paramIndex}`);
        values.push(deckName.trim());
        paramIndex++;
    }

    if (archetype !== undefined) {
        updates.push(`archetype = $${paramIndex}`);
        values.push(archetype?.trim() || null);
        paramIndex++;
    }

    if (description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        values.push(description?.trim() || null);
        paramIndex++;
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = NOW()`);

    try {
        // Verify ownership
        const ownerCheck = await pool.query(
            `SELECT cd.id, dc.id as collection_id
             FROM ${tables.decks} cd
             JOIN ${tables.collections} dc ON cd.collection_id = dc.id
             WHERE cd.id = $1 AND dc.user_id = $2`,
            [deckId, req.user.userId]
        );

        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Deck not found' });
        }

        values.push(deckId);
        const result = await pool.query(
            `UPDATE ${tables.decks} 
             SET ${updates.join(', ')}
             WHERE id = $${paramIndex}
             RETURNING *`,
            values
        );

        // Update collection timestamp
        await pool.query(
            `UPDATE ${tables.collections} SET updated_at = NOW() WHERE id = $1`,
            [ownerCheck.rows[0].collection_id]
        );

        res.json({ deck: result.rows[0] });
    } catch (err) {
        console.error('Update deck error:', err);
        res.status(500).json({ error: 'Failed to update deck' });
    }
});

/**
 * DELETE /collections/decks/:deckId
 * Delete a deck
 */
router.delete('/decks/:deckId', authMiddleware, async (req, res) => {
    const deckId = parseInt(req.params.deckId);
    if (isNaN(deckId)) {
        return res.status(400).json({ error: 'Invalid deck ID' });
    }

    const isCustom = req.query.custom === 'true';
    const tables = getTableNames(isCustom);

    try {
        // Verify ownership and get collection_id
        const ownerCheck = await pool.query(
            `SELECT cd.id, dc.id as collection_id
             FROM ${tables.decks} cd
             JOIN ${tables.collections} dc ON cd.collection_id = dc.id
             WHERE cd.id = $1 AND dc.user_id = $2`,
            [deckId, req.user.userId]
        );

        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Deck not found' });
        }

        await pool.query(`DELETE FROM ${tables.decks} WHERE id = $1`, [deckId]);

        // Update collection timestamp
        await pool.query(
            `UPDATE ${tables.collections} SET updated_at = NOW() WHERE id = $1`,
            [ownerCheck.rows[0].collection_id]
        );

        res.json({ message: 'Deck deleted' });
    } catch (err) {
        console.error('Delete deck error:', err);
        res.status(500).json({ error: 'Failed to delete deck' });
    }
});

// ------------------------------------------------------------------
// DECK CARDS
// ------------------------------------------------------------------

/**
 * POST /collections/decks/:deckId/cards
 * Add a card to a deck (max 3 copies)
 */
router.post('/decks/:deckId/cards', authMiddleware, async (req, res) => {
    const deckId = parseInt(req.params.deckId);
    if (isNaN(deckId)) {
        return res.status(400).json({ error: 'Invalid deck ID' });
    }

    const isCustom = req.query.custom === 'true';
    const tables = getTableNames(isCustom);

    const { cardId, customCardId, quantity = 1, deckSection = 'main' } = req.body;

    // Must have either cardId or customCardId (but not both)
    if (!cardId && !customCardId) {
        return res.status(400).json({ error: 'Card ID or Custom Card ID is required' });
    }
    if (cardId && customCardId) {
        return res.status(400).json({ error: 'Cannot specify both Card ID and Custom Card ID' });
    }
    if (customCardId && !isCustom) {
        return res.status(400).json({ error: 'Custom cards can only be added to custom collections' });
    }

    if (!['main', 'extra', 'side'].includes(deckSection)) {
        return res.status(400).json({ error: 'Deck section must be main, extra, or side' });
    }

    if (quantity < 1 || quantity > 3) {
        return res.status(400).json({ error: 'Quantity must be between 1 and 3' });
    }

    try {
        // Verify deck ownership
        const ownerCheck = await pool.query(
            `SELECT cd.id, dc.id as collection_id
             FROM ${tables.decks} cd
             JOIN ${tables.collections} dc ON cd.collection_id = dc.id
             WHERE cd.id = $1 AND dc.user_id = $2`,
            [deckId, req.user.userId]
        );

        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Deck not found' });
        }

        // Verify card exists
        let cardName;
        if (cardId) {
            const cardCheck = await pool.query('SELECT id, name FROM cards WHERE id = $1', [cardId]);
            if (cardCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Card not found' });
            }
            cardName = cardCheck.rows[0].name;
        } else {
            // Custom card - verify ownership
            const cardCheck = await pool.query(
                'SELECT id, name FROM custom_cards WHERE id = $1 AND created_by = $2 AND deleted_at IS NULL',
                [customCardId, req.user.userId]
            );
            if (cardCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Custom card not found' });
            }
            cardName = cardCheck.rows[0].name;
        }

        // Check total copies across all sections (max 3)
        let existingCopiesQuery;
        let existingCopiesParams;
        if (isCustom) {
            if (cardId) {
                existingCopiesQuery = `SELECT SUM(quantity) as total FROM ${tables.deckCards} WHERE deck_id = $1 AND card_id = $2`;
                existingCopiesParams = [deckId, cardId];
            } else {
                existingCopiesQuery = `SELECT SUM(quantity) as total FROM ${tables.deckCards} WHERE deck_id = $1 AND custom_card_id = $2`;
                existingCopiesParams = [deckId, customCardId];
            }
        } else {
            existingCopiesQuery = `SELECT SUM(quantity) as total FROM ${tables.deckCards} WHERE deck_id = $1 AND card_id = $2`;
            existingCopiesParams = [deckId, cardId];
        }

        const existingCopies = await pool.query(existingCopiesQuery, existingCopiesParams);
        const currentTotal = parseInt(existingCopies.rows[0].total) || 0;

        // Check if adding to existing section
        let existingInSectionQuery;
        let existingInSectionParams;
        if (isCustom) {
            if (cardId) {
                existingInSectionQuery = `SELECT quantity FROM ${tables.deckCards} WHERE deck_id = $1 AND card_id = $2 AND deck_section = $3`;
                existingInSectionParams = [deckId, cardId, deckSection];
            } else {
                existingInSectionQuery = `SELECT quantity FROM ${tables.deckCards} WHERE deck_id = $1 AND custom_card_id = $2 AND deck_section = $3`;
                existingInSectionParams = [deckId, customCardId, deckSection];
            }
        } else {
            existingInSectionQuery = `SELECT quantity FROM ${tables.deckCards} WHERE deck_id = $1 AND card_id = $2 AND deck_section = $3`;
            existingInSectionParams = [deckId, cardId, deckSection];
        }

        const existingInSection = await pool.query(existingInSectionQuery, existingInSectionParams);
        const existingQtyInSection = existingInSection.rows[0]?.quantity || 0;
        const newTotal = currentTotal - existingQtyInSection + quantity;

        if (newTotal > 3) {
            return res.status(400).json({ 
                error: `Cannot have more than 3 copies of a card. Current: ${currentTotal}, Adding: ${quantity - existingQtyInSection}` 
            });
        }

        // Upsert card in deck
        let result;
        if (isCustom) {
            if (cardId) {
                result = await pool.query(
                    `INSERT INTO ${tables.deckCards} (deck_id, card_id, quantity, deck_section)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (deck_id, COALESCE(card_id, -1), COALESCE(custom_card_id, -1), deck_section) 
                     DO UPDATE SET quantity = $3
                     RETURNING *`,
                    [deckId, cardId, quantity, deckSection]
                );
            } else {
                result = await pool.query(
                    `INSERT INTO ${tables.deckCards} (deck_id, custom_card_id, quantity, deck_section)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (deck_id, COALESCE(card_id, -1), COALESCE(custom_card_id, -1), deck_section) 
                     DO UPDATE SET quantity = $3
                     RETURNING *`,
                    [deckId, customCardId, quantity, deckSection]
                );
            }
        } else {
            result = await pool.query(
                `INSERT INTO ${tables.deckCards} (deck_id, card_id, quantity, deck_section)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (deck_id, card_id, deck_section) 
                 DO UPDATE SET quantity = $3
                 RETURNING *`,
                [deckId, cardId, quantity, deckSection]
            );
        }

        // Update timestamps
        await pool.query(`UPDATE ${tables.decks} SET updated_at = NOW() WHERE id = $1`, [deckId]);
        await pool.query(
            `UPDATE ${tables.collections} SET updated_at = NOW() WHERE id = $1`,
            [ownerCheck.rows[0].collection_id]
        );

        res.status(201).json({ 
            card: {
                ...result.rows[0],
                name: cardName,
                is_custom: !!customCardId
            }
        });
    } catch (err) {
        console.error('Add card to deck error:', err);
        res.status(500).json({ error: 'Failed to add card to deck' });
    }
});

/**
 * PATCH /collections/decks/:deckId/cards/:cardId
 * Update card quantity in deck
 */
router.patch('/decks/:deckId/cards/:cardId', authMiddleware, async (req, res) => {
    const deckId = parseInt(req.params.deckId);
    const cardId = parseInt(req.params.cardId);
    
    if (isNaN(deckId) || isNaN(cardId)) {
        return res.status(400).json({ error: 'Invalid deck or card ID' });
    }

    const isCustom = req.query.custom === 'true';
    const isCustomCard = req.query.customCard === 'true';
    const tables = getTableNames(isCustom);

    const { quantity, deckSection } = req.body;

    if (quantity !== undefined && (quantity < 1 || quantity > 3)) {
        return res.status(400).json({ error: 'Quantity must be between 1 and 3' });
    }

    if (deckSection !== undefined && !['main', 'extra', 'side'].includes(deckSection)) {
        return res.status(400).json({ error: 'Deck section must be main, extra, or side' });
    }

    try {
        // Verify deck ownership
        const ownerCheck = await pool.query(
            `SELECT cd.id, dc.id as collection_id
             FROM ${tables.decks} cd
             JOIN ${tables.collections} dc ON cd.collection_id = dc.id
             WHERE cd.id = $1 AND dc.user_id = $2`,
            [deckId, req.user.userId]
        );

        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Deck not found' });
        }

        // Build the card ID condition
        const cardIdColumn = isCustomCard ? 'custom_card_id' : 'card_id';

        // If changing quantity, check total doesn't exceed 3
        if (quantity !== undefined) {
            const existingCopies = await pool.query(
                `SELECT deck_section, quantity
                 FROM ${tables.deckCards}
                 WHERE deck_id = $1 AND ${cardIdColumn} = $2`,
                [deckId, cardId]
            );

            const totalOther = existingCopies.rows
                .filter(r => r.deck_section !== (deckSection || existingCopies.rows[0]?.deck_section))
                .reduce((sum, r) => sum + r.quantity, 0);

            if (totalOther + quantity > 3) {
                return res.status(400).json({ error: 'Cannot have more than 3 copies of a card' });
            }
        }

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (quantity !== undefined) {
            updates.push(`quantity = $${paramIndex}`);
            values.push(quantity);
            paramIndex++;
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        values.push(deckId, cardId);
        
        // If deckSection provided, update only that section
        let whereClause = `deck_id = $${paramIndex} AND ${cardIdColumn} = $${paramIndex + 1}`;
        if (deckSection) {
            values.push(deckSection);
            whereClause += ` AND deck_section = $${paramIndex + 2}`;
        }

        const result = await pool.query(
            `UPDATE ${tables.deckCards} 
             SET ${updates.join(', ')}
             WHERE ${whereClause}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Card not found in deck' });
        }

        // Update timestamps
        await pool.query(`UPDATE ${tables.decks} SET updated_at = NOW() WHERE id = $1`, [deckId]);

        res.json({ card: result.rows[0] });
    } catch (err) {
        console.error('Update deck card error:', err);
        res.status(500).json({ error: 'Failed to update card' });
    }
});

/**
 * DELETE /collections/decks/:deckId/cards/:cardId
 * Remove a card from deck
 */
router.delete('/decks/:deckId/cards/:cardId', authMiddleware, async (req, res) => {
    const deckId = parseInt(req.params.deckId);
    const cardId = parseInt(req.params.cardId);
    
    if (isNaN(deckId) || isNaN(cardId)) {
        return res.status(400).json({ error: 'Invalid deck or card ID' });
    }

    const isCustom = req.query.custom === 'true';
    const isCustomCard = req.query.customCard === 'true';
    const tables = getTableNames(isCustom);

    const { deckSection } = req.query;

    try {
        // Verify deck ownership
        const ownerCheck = await pool.query(
            `SELECT cd.id, dc.id as collection_id
             FROM ${tables.decks} cd
             JOIN ${tables.collections} dc ON cd.collection_id = dc.id
             WHERE cd.id = $1 AND dc.user_id = $2`,
            [deckId, req.user.userId]
        );

        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Deck not found' });
        }

        const cardIdColumn = isCustomCard ? 'custom_card_id' : 'card_id';

        let query = `DELETE FROM ${tables.deckCards} WHERE deck_id = $1 AND ${cardIdColumn} = $2`;
        const params = [deckId, cardId];

        if (deckSection) {
            query += ' AND deck_section = $3';
            params.push(deckSection);
        }

        query += ' RETURNING *';

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Card not found in deck' });
        }

        // Update timestamps
        await pool.query(`UPDATE ${tables.decks} SET updated_at = NOW() WHERE id = $1`, [deckId]);

        res.json({ message: 'Card removed from deck', removed: result.rows.length });
    } catch (err) {
        console.error('Remove deck card error:', err);
        res.status(500).json({ error: 'Failed to remove card' });
    }
});

/**
 * GET /collections/decks/:deckId/stats
 * Get deck statistics
 */
router.get('/decks/:deckId/stats', authMiddleware, async (req, res) => {
    const deckId = parseInt(req.params.deckId);
    if (isNaN(deckId)) {
        return res.status(400).json({ error: 'Invalid deck ID' });
    }

    const isCustom = req.query.custom === 'true';
    const tables = getTableNames(isCustom);

    try {
        // Verify deck ownership
        const ownerCheck = await pool.query(
            `SELECT cd.id
             FROM ${tables.decks} cd
             JOIN ${tables.collections} dc ON cd.collection_id = dc.id
             WHERE cd.id = $1 AND dc.user_id = $2`,
            [deckId, req.user.userId]
        );

        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Deck not found' });
        }

        // Get counts by section
        const sectionCounts = await pool.query(
            `SELECT deck_section, SUM(quantity) as count
             FROM ${tables.deckCards}
             WHERE deck_id = $1
             GROUP BY deck_section`,
            [deckId]
        );

        // Get counts by card type
        let typeCounts;
        if (isCustom) {
            typeCounts = await pool.query(
                `SELECT COALESCE(c.frametype, cc.frametype) as frametype, SUM(cdc.quantity) as count
                 FROM ${tables.deckCards} cdc
                 LEFT JOIN cards c ON cdc.card_id = c.id
                 LEFT JOIN custom_cards cc ON cdc.custom_card_id = cc.id
                 WHERE cdc.deck_id = $1
                 GROUP BY COALESCE(c.frametype, cc.frametype)`,
                [deckId]
            );
        } else {
            typeCounts = await pool.query(
                `SELECT c.frametype, SUM(cdc.quantity) as count
                 FROM ${tables.deckCards} cdc
                 JOIN cards c ON cdc.card_id = c.id
                 WHERE cdc.deck_id = $1
                 GROUP BY c.frametype`,
                [deckId]
            );
        }

        // Get counts by attribute
        let attributeCounts;
        if (isCustom) {
            attributeCounts = await pool.query(
                `SELECT COALESCE(c.attribute, cc.attribute) as attribute, SUM(cdc.quantity) as count
                 FROM ${tables.deckCards} cdc
                 LEFT JOIN cards c ON cdc.card_id = c.id
                 LEFT JOIN custom_cards cc ON cdc.custom_card_id = cc.id
                 WHERE cdc.deck_id = $1 AND COALESCE(c.attribute, cc.attribute) IS NOT NULL
                 GROUP BY COALESCE(c.attribute, cc.attribute)`,
                [deckId]
            );
        } else {
            attributeCounts = await pool.query(
                `SELECT c.attribute, SUM(cdc.quantity) as count
                 FROM ${tables.deckCards} cdc
                 JOIN cards c ON cdc.card_id = c.id
                 WHERE cdc.deck_id = $1 AND c.attribute IS NOT NULL
                 GROUP BY c.attribute`,
                [deckId]
            );
        }

        const sections = {
            main: 0,
            extra: 0,
            side: 0
        };
        sectionCounts.rows.forEach(r => {
            sections[r.deck_section] = parseInt(r.count);
        });

        res.json({
            stats: {
                sections,
                total: sections.main + sections.extra + sections.side,
                byType: typeCounts.rows.reduce((acc, r) => {
                    acc[r.frametype] = parseInt(r.count);
                    return acc;
                }, {}),
                byAttribute: attributeCounts.rows.reduce((acc, r) => {
                    acc[r.attribute] = parseInt(r.count);
                    return acc;
                }, {})
            }
        });
    } catch (err) {
        console.error('Get deck stats error:', err);
        res.status(500).json({ error: 'Failed to get deck stats' });
    }
});

// ------------------------------------------------------------------
// HISTORY
// ------------------------------------------------------------------

/**
 * GET /collections/:id/history
 * Get snapshot history for a collection - shows which decks were in each tournament
 */
router.get('/:id/history', authMiddleware, async (req, res) => {
    const collectionId = parseInt(req.params.id);
    if (isNaN(collectionId)) {
        return res.status(400).json({ error: 'Invalid collection ID' });
    }

    const isCustom = req.query.custom === 'true';
    const tables = getTableNames(isCustom);

    try {
        // Verify ownership
        const ownerCheck = await pool.query(
            `SELECT id FROM ${tables.collections} WHERE id = $1 AND user_id = $2`,
            [collectionId, req.user.userId]
        );

        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        // Get all snapshots for this collection with tournament info
        const snapshotsResult = await pool.query(
            `SELECT cs.id, cs.version_number, cs.created_at,
                    t.id as tournament_id, t.name as tournament_name, t.status as tournament_status
             FROM ${tables.snapshots} cs
             JOIN tournaments t ON cs.tournament_id = t.id
             WHERE cs.source_collection_id = $1
             ORDER BY cs.created_at DESC`,
            [collectionId]
        );

        // For each snapshot, get the deck names
        const history = [];
        for (const snapshot of snapshotsResult.rows) {
            const decksResult = await pool.query(
                `SELECT sd.id, sd.deck_name, sd.source_deck_id
                 FROM ${tables.snapshotDecks} sd
                 WHERE sd.snapshot_id = $1
                 ORDER BY sd.deck_name`,
                [snapshot.id]
            );

            history.push({
                snapshotId: snapshot.id,
                version: snapshot.version_number,
                createdAt: snapshot.created_at,
                tournament: {
                    id: snapshot.tournament_id,
                    name: snapshot.tournament_name,
                    status: snapshot.tournament_status
                },
                decks: decksResult.rows.map(d => ({
                    id: d.id,
                    name: d.deck_name,
                    sourceDeckId: d.source_deck_id
                }))
            });
        }

        // Calculate changes between snapshots
        for (let i = 0; i < history.length; i++) {
            if (i < history.length - 1) {
                const current = history[i];
                const previous = history[i + 1];
                
                const currentDeckIds = new Set(current.decks.map(d => d.sourceDeckId));
                const previousDeckIds = new Set(previous.decks.map(d => d.sourceDeckId));
                
                current.changes = {
                    added: current.decks.filter(d => !previousDeckIds.has(d.sourceDeckId)).map(d => d.name),
                    removed: previous.decks.filter(d => !currentDeckIds.has(d.sourceDeckId)).map(d => d.name)
                };
            } else {
                // First snapshot - all decks are "new"
                history[i].changes = {
                    added: history[i].decks.map(d => d.name),
                    removed: []
                };
            }
        }

        res.json({ history });
    } catch (err) {
        console.error('Get collection history error:', err);
        res.status(500).json({ error: 'Failed to get collection history' });
    }
});

/**
 * GET /collections/decks/:deckId/history
 * Get snapshot history for a specific deck - shows card changes per tournament
 */
router.get('/decks/:deckId/history', authMiddleware, async (req, res) => {
    const deckId = parseInt(req.params.deckId);
    if (isNaN(deckId)) {
        return res.status(400).json({ error: 'Invalid deck ID' });
    }

    const isCustom = req.query.custom === 'true';
    const tables = getTableNames(isCustom);

    try {
        // Verify ownership
        const ownerCheck = await pool.query(
            `SELECT cd.id, cd.deck_name
             FROM ${tables.decks} cd
             JOIN ${tables.collections} dc ON cd.collection_id = dc.id
             WHERE cd.id = $1 AND dc.user_id = $2`,
            [deckId, req.user.userId]
        );

        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Deck not found' });
        }

        const deckName = ownerCheck.rows[0].deck_name;

        // Get all snapshot decks for this source deck with tournament info
        const snapshotsResult = await pool.query(
            `SELECT sd.id, sd.deck_name, sd.created_at,
                    cs.id as snapshot_id, cs.version_number,
                    t.id as tournament_id, t.name as tournament_name, t.status as tournament_status
             FROM ${tables.snapshotDecks} sd
             JOIN ${tables.snapshots} cs ON sd.snapshot_id = cs.id
             JOIN tournaments t ON cs.tournament_id = t.id
             WHERE sd.source_deck_id = $1
             ORDER BY sd.created_at DESC`,
            [deckId]
        );

        // For each snapshot, get the cards
        const history = [];
        for (const snapshot of snapshotsResult.rows) {
            let cardsResult;
            if (isCustom) {
                cardsResult = await pool.query(
                    `SELECT sdc.card_id, sdc.snapshot_custom_card_id, sdc.quantity, sdc.deck_section, 
                            COALESCE(c.name, scc.name) as name,
                            CASE WHEN scc.id IS NOT NULL THEN TRUE ELSE FALSE END as is_custom
                     FROM ${tables.snapshotDeckCards} sdc
                     LEFT JOIN cards c ON sdc.card_id = c.id
                     LEFT JOIN snapshot_custom_cards scc ON sdc.snapshot_custom_card_id = scc.id
                     WHERE sdc.deck_id = $1
                     ORDER BY sdc.deck_section, COALESCE(c.name, scc.name)`,
                    [snapshot.id]
                );
            } else {
                cardsResult = await pool.query(
                    `SELECT sdc.card_id, sdc.quantity, sdc.deck_section, c.name,
                            FALSE as is_custom
                     FROM ${tables.snapshotDeckCards} sdc
                     JOIN cards c ON sdc.card_id = c.id
                     WHERE sdc.deck_id = $1
                     ORDER BY sdc.deck_section, c.name`,
                    [snapshot.id]
                );
            }

            history.push({
                snapshotDeckId: snapshot.id,
                version: snapshot.version_number,
                createdAt: snapshot.created_at,
                tournament: {
                    id: snapshot.tournament_id,
                    name: snapshot.tournament_name,
                    status: snapshot.tournament_status
                },
                cards: cardsResult.rows,
                cardCount: cardsResult.rows.reduce((sum, c) => sum + c.quantity, 0)
            });
        }

        // Calculate card changes between snapshots
        for (let i = 0; i < history.length; i++) {
            if (i < history.length - 1) {
                const current = history[i];
                const previous = history[i + 1];
                
                // Create maps of card key -> {quantity, section, name}
                const currentCards = new Map();
                current.cards.forEach(c => {
                    const key = `${c.card_id || 'custom-' + c.snapshot_custom_card_id}-${c.deck_section}`;
                    currentCards.set(key, { ...c });
                });
                
                const previousCards = new Map();
                previous.cards.forEach(c => {
                    const key = `${c.card_id || 'custom-' + c.snapshot_custom_card_id}-${c.deck_section}`;
                    previousCards.set(key, { ...c });
                });

                const changes = { added: [], removed: [], changed: [] };

                // Find added and changed cards
                for (const [key, card] of currentCards) {
                    if (!previousCards.has(key)) {
                        changes.added.push({ name: card.name, quantity: card.quantity, section: card.deck_section, isCustom: card.is_custom });
                    } else {
                        const prev = previousCards.get(key);
                        if (prev.quantity !== card.quantity) {
                            changes.changed.push({ 
                                name: card.name, 
                                section: card.deck_section,
                                from: prev.quantity, 
                                to: card.quantity,
                                isCustom: card.is_custom
                            });
                        }
                    }
                }

                // Find removed cards
                for (const [key, card] of previousCards) {
                    if (!currentCards.has(key)) {
                        changes.removed.push({ name: card.name, quantity: card.quantity, section: card.deck_section, isCustom: card.is_custom });
                    }
                }

                current.changes = changes;
            } else {
                // First snapshot - show all cards as initial state
                history[i].changes = null;
            }
        }

        res.json({ deckName, history });
    } catch (err) {
        console.error('Get deck history error:', err);
        res.status(500).json({ error: 'Failed to get deck history' });
    }
});

export default router;
