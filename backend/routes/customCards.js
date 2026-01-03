import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { 
    createCustomCardSchema, 
    updateCustomCardSchema,
    editSnapshotCustomCardSchema 
} from '../validation/customCards.js';
import {
    createCustomCard,
    editCustomCard,
    deleteCustomCard,
    getCustomCard,
    getUserCustomCards,
    editSnapshotCustomCard
} from '../customCards.js';

const router = Router();

// ------------------------------------------------------------------
// CUSTOM CARDS CRUD
// ------------------------------------------------------------------

/**
 * GET /custom-cards
 * Get all custom cards for the authenticated user
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const cards = await getUserCustomCards(req.user.userId);
        res.json({ cards });
    } catch (err) {
        console.error('Get custom cards error:', err);
        res.status(500).json({ error: 'Failed to get custom cards' });
    }
});

/**
 * GET /custom-cards/:id
 * Get a specific custom card
 */
router.get('/:id', authMiddleware, async (req, res) => {
    const cardId = parseInt(req.params.id);

    if (isNaN(cardId)) {
        return res.status(400).json({ error: 'Invalid card ID' });
    }

    try {
        const card = await getCustomCard(cardId);

        if (!card) {
            return res.status(404).json({ error: 'Card not found' });
        }

        // Check if user owns the card or it's shared
        if (card.created_by !== req.user.userId) {
            return res.status(403).json({ error: 'Not authorized to view this card' });
        }

        res.json({ card });
    } catch (err) {
        console.error('Get custom card error:', err);
        res.status(500).json({ error: 'Failed to get custom card' });
    }
});

/**
 * POST /custom-cards
 * Create a new custom card
 */
router.post('/', authMiddleware, async (req, res) => {
    const result = createCustomCardSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: result.error.flatten().fieldErrors
        });
    }

    try {
        const card = await createCustomCard(req.user.userId, result.data);
        res.status(201).json({ card });
    } catch (err) {
        console.error('Create custom card error:', err);
        res.status(500).json({ error: 'Failed to create custom card' });
    }
});

/**
 * PATCH /custom-cards/:id
 * Update a custom card (propagates to unlocked snapshots)
 */
router.patch('/:id', authMiddleware, async (req, res) => {
    const cardId = parseInt(req.params.id);

    if (isNaN(cardId)) {
        return res.status(400).json({ error: 'Invalid card ID' });
    }

    const result = updateCustomCardSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: result.error.flatten().fieldErrors
        });
    }

    try {
        const updateResult = await editCustomCard(cardId, req.user.userId, result.data);
        res.json({
            card: updateResult.card,
            propagatedTo: updateResult.propagatedTo,
            message: updateResult.propagatedTo > 0 
                ? `Card updated and propagated to ${updateResult.propagatedTo} snapshot(s)`
                : 'Card updated'
        });
    } catch (err) {
        if (err.message === 'Card not found or not owned by user') {
            return res.status(404).json({ error: err.message });
        }
        if (err.message === 'No valid fields to update') {
            return res.status(400).json({ error: err.message });
        }
        console.error('Update custom card error:', err);
        res.status(500).json({ error: 'Failed to update custom card' });
    }
});

/**
 * DELETE /custom-cards/:id
 * Delete a custom card
 * - Soft-delete if used in snapshots (card data preserved for history)
 * - Hard-delete if not used anywhere
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    const cardId = parseInt(req.params.id);

    if (isNaN(cardId)) {
        return res.status(400).json({ error: 'Invalid card ID' });
    }

    try {
        const result = await deleteCustomCard(cardId, req.user.userId);
        
        const message = result.type === 'soft'
            ? 'Card removed from your collection (preserved in tournament history)'
            : 'Card permanently deleted';
        
        res.json({ message, type: result.type });
    } catch (err) {
        if (err.message === 'Card not found or not owned by user') {
            return res.status(404).json({ error: err.message });
        }
        console.error('Delete custom card error:', err);
        res.status(500).json({ error: 'Failed to delete custom card' });
    }
});

// ------------------------------------------------------------------
// SNAPSHOT CUSTOM CARDS
// ------------------------------------------------------------------

/**
 * GET /custom-cards/:id/history
 * Get history of a custom card across tournaments
 */
router.get('/:id/history', authMiddleware, async (req, res) => {
    const cardId = parseInt(req.params.id);

    if (isNaN(cardId)) {
        return res.status(400).json({ error: 'Invalid card ID' });
    }

    try {
        // Verify ownership
        const card = await getCustomCard(cardId);
        if (!card) {
            return res.status(404).json({ error: 'Card not found' });
        }
        if (card.created_by !== req.user.userId) {
            return res.status(403).json({ error: 'Not authorized to view this card' });
        }

        // Get all snapshots of this card with tournament info
        const { pool } = await import('../db.js');
        const snapshotsResult = await pool.query(
            `SELECT scc.id, scc.name, scc.type, scc.humanreadablecardtype, scc.frametype,
                    scc.description, scc.race, scc.archetype, scc.atk, scc.def, scc.level, 
                    scc.attribute, scc.version_at_snapshot, scc.created_at,
                    ccs.id as snapshot_id,
                    t.id as tournament_id, t.name as tournament_name, t.status as tournament_status
             FROM snapshot_custom_cards scc
             JOIN custom_collection_snapshots ccs ON scc.snapshot_id = ccs.id
             JOIN tournaments t ON ccs.tournament_id = t.id
             WHERE scc.source_custom_card_id = $1
             ORDER BY scc.created_at DESC`,
            [cardId]
        );

        // Fields to compare for changes
        const compareFields = ['name', 'type', 'humanreadablecardtype', 'frametype', 
                               'description', 'race', 'archetype', 'atk', 'def', 'level', 'attribute'];

        const history = snapshotsResult.rows.map((snapshot, index) => {
            const entry = {
                snapshotCardId: snapshot.id,
                versionAtSnapshot: snapshot.version_at_snapshot,
                createdAt: snapshot.created_at,
                tournament: {
                    id: snapshot.tournament_id,
                    name: snapshot.tournament_name,
                    status: snapshot.tournament_status
                },
                cardData: {
                    name: snapshot.name,
                    type: snapshot.type,
                    humanreadablecardtype: snapshot.humanreadablecardtype,
                    frametype: snapshot.frametype,
                    description: snapshot.description,
                    race: snapshot.race,
                    archetype: snapshot.archetype,
                    atk: snapshot.atk,
                    def: snapshot.def,
                    level: snapshot.level,
                    attribute: snapshot.attribute
                },
                changes: null
            };

            // Compare with previous snapshot (next in array since sorted DESC)
            if (index < snapshotsResult.rows.length - 1) {
                const previous = snapshotsResult.rows[index + 1];
                const changes = [];

                for (const field of compareFields) {
                    const currentVal = snapshot[field];
                    const prevVal = previous[field];
                    
                    if (currentVal !== prevVal) {
                        changes.push({
                            field,
                            from: prevVal,
                            to: currentVal
                        });
                    }
                }

                entry.changes = changes.length > 0 ? changes : null;
            }

            return entry;
        });

        res.json({ 
            cardName: card.name,
            currentVersion: card.version,
            history 
        });
    } catch (err) {
        console.error('Get custom card history error:', err);
        res.status(500).json({ error: 'Failed to get custom card history' });
    }
});

/**
 * PATCH /custom-cards/snapshot/:snapshotCardId
 * Edit a snapshot custom card (with propagation logic)
 */
router.patch('/snapshot/:snapshotCardId', authMiddleware, async (req, res) => {
    const snapshotCardId = parseInt(req.params.snapshotCardId);

    if (isNaN(snapshotCardId)) {
        return res.status(400).json({ error: 'Invalid snapshot card ID' });
    }

    const result = editSnapshotCustomCardSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: result.error.flatten().fieldErrors
        });
    }

    const { changes, propagateToSource } = result.data;

    try {
        const updateResult = await editSnapshotCustomCard(
            snapshotCardId, 
            req.user.userId, 
            changes,
            { propagateToSource }
        );

        let message = 'Snapshot card updated';
        if (updateResult.isLocked) {
            message = updateResult.sourceUpdated 
                ? 'Snapshot card updated (locked), source card also updated'
                : 'Snapshot card updated (locked snapshot, no propagation)';
        } else {
            message = `Snapshot card updated, propagated to source and ${updateResult.propagatedTo} other snapshot(s)`;
        }

        res.json({
            ...updateResult,
            message
        });
    } catch (err) {
        if (err.message === 'Snapshot card not found') {
            return res.status(404).json({ error: err.message });
        }
        if (err.message === 'Not authorized to edit this card') {
            return res.status(403).json({ error: err.message });
        }
        console.error('Edit snapshot custom card error:', err);
        res.status(500).json({ error: 'Failed to edit snapshot custom card' });
    }
});

export default router;
