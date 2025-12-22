import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
    createCustomCollection,
    getUserCustomCollections,
    getCustomCollection,
    updateCustomCollection,
    deleteCustomCollection,
    addCustomDeck,
    getCustomDeck,
    updateCustomDeck,
    deleteCustomDeck,
    addCardToCustomDeck,
    removeCardFromCustomDeck,
    createCustomSeriesSnapshot,
    createCustomTournamentSnapshot,
    getCustomSnapshot,
    lockSnapshot
} from '../customCards.js';

const router = Router();

// ------------------------------------------------------------------
// COLLECTIONS
// ------------------------------------------------------------------

/**
 * GET /custom-collections
 * Get all custom collections for the user
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const collections = await getUserCustomCollections(req.user.userId);
        res.json({ collections });
    } catch (err) {
        console.error('Get custom collections error:', err);
        res.status(500).json({ error: 'Failed to get collections' });
    }
});

/**
 * GET /custom-collections/:id
 * Get a specific collection with its decks
 */
router.get('/:id', authMiddleware, async (req, res) => {
    const collectionId = parseInt(req.params.id);
    if (isNaN(collectionId)) {
        return res.status(400).json({ error: 'Invalid collection ID' });
    }

    try {
        const collection = await getCustomCollection(collectionId, req.user.userId);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        res.json({ collection });
    } catch (err) {
        console.error('Get custom collection error:', err);
        res.status(500).json({ error: 'Failed to get collection' });
    }
});

/**
 * POST /custom-collections
 * Create a new collection
 */
router.post('/', authMiddleware, async (req, res) => {
    const { name, description } = req.body;

    if (!name || name.length < 2 || name.length > 200) {
        return res.status(400).json({ error: 'Name must be between 2 and 200 characters' });
    }

    try {
        const collection = await createCustomCollection(req.user.userId, name, description);
        res.status(201).json({ collection });
    } catch (err) {
        console.error('Create custom collection error:', err);
        res.status(500).json({ error: 'Failed to create collection' });
    }
});

/**
 * PATCH /custom-collections/:id
 * Update a collection
 */
router.patch('/:id', authMiddleware, async (req, res) => {
    const collectionId = parseInt(req.params.id);
    if (isNaN(collectionId)) {
        return res.status(400).json({ error: 'Invalid collection ID' });
    }

    try {
        const collection = await updateCustomCollection(collectionId, req.user.userId, req.body);
        res.json({ collection });
    } catch (err) {
        if (err.message === 'Collection not found or not owned by user') {
            return res.status(404).json({ error: err.message });
        }
        if (err.message === 'No valid fields to update') {
            return res.status(400).json({ error: err.message });
        }
        console.error('Update custom collection error:', err);
        res.status(500).json({ error: 'Failed to update collection' });
    }
});

/**
 * DELETE /custom-collections/:id
 * Delete a collection
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    const collectionId = parseInt(req.params.id);
    if (isNaN(collectionId)) {
        return res.status(400).json({ error: 'Invalid collection ID' });
    }

    try {
        await deleteCustomCollection(collectionId, req.user.userId);
        res.json({ message: 'Collection deleted' });
    } catch (err) {
        if (err.message === 'Collection not found or not owned by user') {
            return res.status(404).json({ error: err.message });
        }
        console.error('Delete custom collection error:', err);
        res.status(500).json({ error: 'Failed to delete collection' });
    }
});

// ------------------------------------------------------------------
// DECKS
// ------------------------------------------------------------------

/**
 * POST /custom-collections/:collectionId/decks
 * Add a deck to a collection
 */
router.post('/:collectionId/decks', authMiddleware, async (req, res) => {
    const collectionId = parseInt(req.params.collectionId);
    if (isNaN(collectionId)) {
        return res.status(400).json({ error: 'Invalid collection ID' });
    }

    const { deckName, archetype, description } = req.body;
    if (!deckName || deckName.length < 2 || deckName.length > 200) {
        return res.status(400).json({ error: 'Deck name must be between 2 and 200 characters' });
    }

    try {
        const deck = await addCustomDeck(collectionId, req.user.userId, { deckName, archetype, description });
        res.status(201).json({ deck });
    } catch (err) {
        if (err.message === 'Collection not found or not owned by user') {
            return res.status(404).json({ error: err.message });
        }
        console.error('Add custom deck error:', err);
        res.status(500).json({ error: 'Failed to add deck' });
    }
});

/**
 * GET /custom-collections/decks/:deckId
 * Get a deck with its cards
 */
router.get('/decks/:deckId', authMiddleware, async (req, res) => {
    const deckId = parseInt(req.params.deckId);
    if (isNaN(deckId)) {
        return res.status(400).json({ error: 'Invalid deck ID' });
    }

    try {
        const deck = await getCustomDeck(deckId, req.user.userId);
        if (!deck) {
            return res.status(404).json({ error: 'Deck not found' });
        }
        res.json({ deck });
    } catch (err) {
        console.error('Get custom deck error:', err);
        res.status(500).json({ error: 'Failed to get deck' });
    }
});

/**
 * PATCH /custom-collections/decks/:deckId
 * Update a deck
 */
router.patch('/decks/:deckId', authMiddleware, async (req, res) => {
    const deckId = parseInt(req.params.deckId);
    if (isNaN(deckId)) {
        return res.status(400).json({ error: 'Invalid deck ID' });
    }

    try {
        const deck = await updateCustomDeck(deckId, req.user.userId, req.body);
        res.json({ deck });
    } catch (err) {
        if (err.message === 'Deck not found or not owned by user') {
            return res.status(404).json({ error: err.message });
        }
        if (err.message === 'No valid fields to update') {
            return res.status(400).json({ error: err.message });
        }
        console.error('Update custom deck error:', err);
        res.status(500).json({ error: 'Failed to update deck' });
    }
});

/**
 * DELETE /custom-collections/decks/:deckId
 * Delete a deck
 */
router.delete('/decks/:deckId', authMiddleware, async (req, res) => {
    const deckId = parseInt(req.params.deckId);
    if (isNaN(deckId)) {
        return res.status(400).json({ error: 'Invalid deck ID' });
    }

    try {
        await deleteCustomDeck(deckId, req.user.userId);
        res.json({ message: 'Deck deleted' });
    } catch (err) {
        if (err.message === 'Deck not found or not owned by user') {
            return res.status(404).json({ error: err.message });
        }
        console.error('Delete custom deck error:', err);
        res.status(500).json({ error: 'Failed to delete deck' });
    }
});

// ------------------------------------------------------------------
// DECK CARDS
// ------------------------------------------------------------------

/**
 * POST /custom-collections/decks/:deckId/cards
 * Add a card to a deck
 */
router.post('/decks/:deckId/cards', authMiddleware, async (req, res) => {
    const deckId = parseInt(req.params.deckId);
    if (isNaN(deckId)) {
        return res.status(400).json({ error: 'Invalid deck ID' });
    }

    const { cardId, customCardId, quantity, deckSection } = req.body;

    if (!cardId && !customCardId) {
        return res.status(400).json({ error: 'Either cardId or customCardId must be provided' });
    }
    if (cardId && customCardId) {
        return res.status(400).json({ error: 'Cannot provide both cardId and customCardId' });
    }
    if (!quantity || quantity < 1 || quantity > 3) {
        return res.status(400).json({ error: 'Quantity must be between 1 and 3' });
    }
    if (!['main', 'extra', 'side'].includes(deckSection)) {
        return res.status(400).json({ error: 'Deck section must be main, extra, or side' });
    }

    try {
        const card = await addCardToCustomDeck(deckId, req.user.userId, { cardId, customCardId, quantity, deckSection });
        res.status(201).json({ card });
    } catch (err) {
        if (err.message === 'Deck not found or not owned by user') {
            return res.status(404).json({ error: err.message });
        }
        if (err.message === 'Custom card not found or not owned by user') {
            return res.status(404).json({ error: err.message });
        }
        console.error('Add card to deck error:', err);
        res.status(500).json({ error: 'Failed to add card to deck' });
    }
});

/**
 * DELETE /custom-collections/decks/:deckId/cards
 * Remove a card from a deck
 */
router.delete('/decks/:deckId/cards', authMiddleware, async (req, res) => {
    const deckId = parseInt(req.params.deckId);
    if (isNaN(deckId)) {
        return res.status(400).json({ error: 'Invalid deck ID' });
    }

    const { cardId, customCardId, deckSection } = req.body;

    if (!cardId && !customCardId) {
        return res.status(400).json({ error: 'Either cardId or customCardId must be provided' });
    }
    if (!['main', 'extra', 'side'].includes(deckSection)) {
        return res.status(400).json({ error: 'Deck section must be main, extra, or side' });
    }

    try {
        await removeCardFromCustomDeck(deckId, req.user.userId, { cardId, customCardId, deckSection });
        res.json({ message: 'Card removed from deck' });
    } catch (err) {
        if (err.message === 'Deck not found or not owned by user') {
            return res.status(404).json({ error: err.message });
        }
        if (err.message === 'Card not found in deck') {
            return res.status(404).json({ error: err.message });
        }
        console.error('Remove card from deck error:', err);
        res.status(500).json({ error: 'Failed to remove card from deck' });
    }
});

// ------------------------------------------------------------------
// SNAPSHOTS
// ------------------------------------------------------------------

/**
 * POST /custom-collections/:collectionId/snapshots/series
 * Create a series snapshot from a collection
 */
router.post('/:collectionId/snapshots/series', authMiddleware, async (req, res) => {
    const collectionId = parseInt(req.params.collectionId);
    if (isNaN(collectionId)) {
        return res.status(400).json({ error: 'Invalid collection ID' });
    }

    const { seriesId } = req.body;
    if (!seriesId) {
        return res.status(400).json({ error: 'Series ID is required' });
    }

    try {
        const snapshot = await createCustomSeriesSnapshot(seriesId, collectionId, req.user.userId);
        res.status(201).json({ snapshot });
    } catch (err) {
        if (err.message === 'Collection not found or not owned by user') {
            return res.status(404).json({ error: err.message });
        }
        console.error('Create series snapshot error:', err);
        res.status(500).json({ error: 'Failed to create snapshot' });
    }
});

/**
 * POST /custom-collections/snapshots/tournament
 * Create a tournament snapshot
 */
router.post('/snapshots/tournament', authMiddleware, async (req, res) => {
    const { tournamentId, sourceType, sourceId, seriesId } = req.body;

    if (!tournamentId) {
        return res.status(400).json({ error: 'Tournament ID is required' });
    }
    if (!sourceType || !['series_snapshot', 'previous_tournament', 'user_collection'].includes(sourceType)) {
        return res.status(400).json({ error: 'Invalid source type' });
    }
    if (!sourceId) {
        return res.status(400).json({ error: 'Source ID is required' });
    }

    try {
        const snapshot = await createCustomTournamentSnapshot(
            tournamentId,
            { sourceType, sourceId, seriesId },
            req.user.userId
        );
        res.status(201).json({ snapshot });
    } catch (err) {
        if (err.message.includes('not found') || err.message.includes('not owned')) {
            return res.status(404).json({ error: err.message });
        }
        console.error('Create tournament snapshot error:', err);
        res.status(500).json({ error: 'Failed to create snapshot' });
    }
});

/**
 * GET /custom-collections/snapshots/:snapshotId
 * Get a snapshot with its decks and cards
 */
router.get('/snapshots/:snapshotId', authMiddleware, async (req, res) => {
    const snapshotId = parseInt(req.params.snapshotId);
    if (isNaN(snapshotId)) {
        return res.status(400).json({ error: 'Invalid snapshot ID' });
    }

    try {
        const snapshot = await getCustomSnapshot(snapshotId);
        if (!snapshot) {
            return res.status(404).json({ error: 'Snapshot not found' });
        }
        res.json({ snapshot });
    } catch (err) {
        console.error('Get snapshot error:', err);
        res.status(500).json({ error: 'Failed to get snapshot' });
    }
});

/**
 * POST /custom-collections/snapshots/:snapshotId/lock
 * Lock a snapshot (prevents further sync)
 */
router.post('/snapshots/:snapshotId/lock', authMiddleware, async (req, res) => {
    const snapshotId = parseInt(req.params.snapshotId);
    if (isNaN(snapshotId)) {
        return res.status(400).json({ error: 'Invalid snapshot ID' });
    }

    try {
        const snapshot = await lockSnapshot(snapshotId);
        if (!snapshot) {
            return res.status(404).json({ error: 'Snapshot not found' });
        }
        res.json({ snapshot, message: 'Snapshot locked' });
    } catch (err) {
        console.error('Lock snapshot error:', err);
        res.status(500).json({ error: 'Failed to lock snapshot' });
    }
});

export default router;
