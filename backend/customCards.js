// customCards.js
import { pool } from './db.js';

// ------------------------------------------------------------------
// HELPER: Find all unlocked snapshots containing a custom card
// ------------------------------------------------------------------
async function findUnlockedSnapshotsWithCard(customCardId) {
    const res = await pool.query(
        `SELECT scc.id AS snapshot_card_id, scc.snapshot_id, ccs.id AS collection_snapshot_id
         FROM snapshot_custom_cards scc
         JOIN custom_collection_snapshots ccs ON scc.snapshot_id = ccs.id
         WHERE scc.source_custom_card_id = $1
         AND ccs.sync_locked = false`,
        [customCardId]
    );
    return res.rows;
}

// ------------------------------------------------------------------
// HELPER: Get card fields for copying/updating
// ------------------------------------------------------------------
function getCardFields(card) {
    return {
        name: card.name,
        type: card.type,
        humanreadablecardtype: card.humanreadablecardtype,
        frametype: card.frametype,
        description: card.description,
        race: card.race,
        archetype: card.archetype || null,
        atk: card.atk ?? null,
        def: card.def ?? null,
        level: card.level ?? null,
        attribute: card.attribute || null
    };
}

// ------------------------------------------------------------------
// CUSTOM CARD CRUD
// ------------------------------------------------------------------

/**
 * Create a new custom card
 */
export async function createCustomCard(userId, cardData) {
    const {
        name, type, humanreadablecardtype, frametype, description,
        race, archetype, atk, def, level, attribute,
        originCardId, originCustomCardId, originUserId
    } = cardData;

    const res = await pool.query(
        `INSERT INTO custom_cards (
            created_by, origin_card_id, origin_custom_card_id, origin_user_id,
            name, type, humanreadablecardtype, frametype, description,
            race, archetype, atk, def, level, attribute, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 1)
        RETURNING *`,
        [
            userId, originCardId || null, originCustomCardId || null, originUserId || null,
            name, type, humanreadablecardtype, frametype, description,
            race, archetype || null, atk ?? null, def ?? null, level ?? null, attribute || null
        ]
    );
    return res.rows[0];
}

/**
 * Edit a custom card - propagates to all unlocked snapshots
 */
export async function editCustomCard(customCardId, userId, changes) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Verify ownership
        const cardRes = await client.query(
            'SELECT * FROM custom_cards WHERE id = $1 AND created_by = $2',
            [customCardId, userId]
        );
        if (cardRes.rows.length === 0) {
            throw new Error('Card not found or not owned by user');
        }
        const currentCard = cardRes.rows[0];

        // 2. Build update query dynamically
        const allowedFields = [
            'name', 'type', 'humanreadablecardtype', 'frametype', 'description',
            'race', 'archetype', 'atk', 'def', 'level', 'attribute'
        ];
        
        const updates = [];
        const values = [];
        let paramIndex = 1;

        for (const field of allowedFields) {
            if (changes[field] !== undefined) {
                updates.push(`${field} = $${paramIndex}`);
                values.push(changes[field]);
                paramIndex++;
            }
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        // Add version increment and updated_at
        updates.push(`version = version + 1`);
        updates.push(`updated_at = now()`);

        // 3. Update the custom card
        values.push(customCardId);
        const updateRes = await client.query(
            `UPDATE custom_cards SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );
        const updatedCard = updateRes.rows[0];

        // 4. Propagate to all unlocked snapshots
        const unlockedSnapshots = await findUnlockedSnapshotsWithCardClient(client, customCardId);
        
        for (const snapshot of unlockedSnapshots) {
            await updateSnapshotCustomCard(client, snapshot.snapshot_card_id, changes, updatedCard.version);
        }

        await client.query('COMMIT');
        
        return {
            card: updatedCard,
            propagatedTo: unlockedSnapshots.length
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Delete a custom card
 * - If card is used in snapshots: soft-delete (set created_by = NULL, deleted_at = NOW())
 * - If card is not used anywhere: hard-delete
 */
export async function deleteCustomCard(customCardId, userId) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. Verify ownership
        const cardRes = await client.query(
            'SELECT id FROM custom_cards WHERE id = $1 AND created_by = $2',
            [customCardId, userId]
        );
        
        if (cardRes.rows.length === 0) {
            throw new Error('Card not found or not owned by user');
        }
        
        // 2. Check if card is used in any snapshot
        const snapshotUsage = await client.query(
            'SELECT COUNT(*) AS count FROM snapshot_custom_cards WHERE source_custom_card_id = $1',
            [customCardId]
        );
        
        const isUsedInSnapshot = parseInt(snapshotUsage.rows[0].count) > 0;
        
        if (isUsedInSnapshot) {
            // Soft-delete: remove ownership, mark as deleted
            await client.query(
                `UPDATE custom_cards 
                 SET created_by = NULL, deleted_at = NOW() 
                 WHERE id = $1`,
                [customCardId]
            );
            
            await client.query('COMMIT');
            return { deleted: true, id: customCardId, type: 'soft' };
        } else {
            // Hard-delete: remove completely
            await client.query(
                'DELETE FROM custom_cards WHERE id = $1',
                [customCardId]
            );
            
            await client.query('COMMIT');
            return { deleted: true, id: customCardId, type: 'hard' };
        }
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get a custom card by ID
 */
export async function getCustomCard(customCardId) {
    const res = await pool.query(
        'SELECT * FROM custom_cards WHERE id = $1',
        [customCardId]
    );
    return res.rows[0] || null;
}

/**
 * Get all custom cards by user (excludes soft-deleted)
 */
export async function getUserCustomCards(userId) {
    const res = await pool.query(
        `SELECT * FROM custom_cards 
         WHERE created_by = $1 AND deleted_at IS NULL 
         ORDER BY updated_at DESC`,
        [userId]
    );
    return res.rows;
}

// ------------------------------------------------------------------
// SNAPSHOT CUSTOM CARD EDITING (with propagation)
// ------------------------------------------------------------------

/**
 * Edit a snapshot custom card
 * - If snapshot is unlocked: propagates back to source AND to other unlocked snapshots
 * - If snapshot is locked: only edits this snapshot (optionally propagates to source)
 */
export async function editSnapshotCustomCard(snapshotCardId, userId, changes, options = {}) {
    const { propagateToSource = true } = options;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Get the snapshot card and check ownership via source
        const snapshotCardRes = await client.query(
            `SELECT scc.*, ccs.sync_locked, cc.created_by, cc.id AS source_card_id
             FROM snapshot_custom_cards scc
             JOIN custom_collection_snapshots ccs ON scc.snapshot_id = ccs.id
             LEFT JOIN custom_cards cc ON scc.source_custom_card_id = cc.id
             WHERE scc.id = $1`,
            [snapshotCardId]
        );

        if (snapshotCardRes.rows.length === 0) {
            throw new Error('Snapshot card not found');
        }

        const snapshotCard = snapshotCardRes.rows[0];
        
        // Verify user owns the source card
        if (snapshotCard.created_by !== userId) {
            throw new Error('Not authorized to edit this card');
        }

        const isLocked = snapshotCard.sync_locked;
        const sourceCardId = snapshotCard.source_card_id;

        // 2. Update this snapshot card
        await updateSnapshotCustomCardClient(client, snapshotCardId, changes, snapshotCard.version_at_snapshot);

        let propagatedTo = 0;
        let sourceUpdated = false;

        // 3. Handle propagation based on lock status
        if (!isLocked) {
            // Unlocked: Always propagate to source and other unlocked snapshots
            if (sourceCardId) {
                await updateCustomCardFromChanges(client, sourceCardId, changes);
                sourceUpdated = true;

                // Propagate to other unlocked snapshots (excluding this one)
                const otherSnapshots = await findUnlockedSnapshotsWithCardClient(client, sourceCardId);
                for (const snapshot of otherSnapshots) {
                    if (snapshot.snapshot_card_id !== snapshotCardId) {
                        const newVersion = await getCustomCardVersion(client, sourceCardId);
                        await updateSnapshotCustomCardClient(client, snapshot.snapshot_card_id, changes, newVersion);
                        propagatedTo++;
                    }
                }
            }
        } else {
            // Locked: Only update source if explicitly requested
            if (propagateToSource && sourceCardId) {
                await updateCustomCardFromChanges(client, sourceCardId, changes);
                sourceUpdated = true;
                // Note: Other snapshots are NOT updated when editing a locked snapshot
            }
        }

        await client.query('COMMIT');

        return {
            snapshotCardId,
            isLocked,
            sourceUpdated,
            propagatedTo
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// ------------------------------------------------------------------
// INTERNAL HELPERS (with client for transactions)
// ------------------------------------------------------------------

async function findUnlockedSnapshotsWithCardClient(client, customCardId) {
    const res = await client.query(
        `SELECT scc.id AS snapshot_card_id, scc.snapshot_id, ccs.id AS collection_snapshot_id
         FROM snapshot_custom_cards scc
         JOIN custom_collection_snapshots ccs ON scc.snapshot_id = ccs.id
         WHERE scc.source_custom_card_id = $1
         AND ccs.sync_locked = false`,
        [customCardId]
    );
    return res.rows;
}

async function updateSnapshotCustomCard(client, snapshotCardId, changes, versionAtSnapshot) {
    return updateSnapshotCustomCardClient(client, snapshotCardId, changes, versionAtSnapshot);
}

async function updateSnapshotCustomCardClient(client, snapshotCardId, changes, versionAtSnapshot) {
    const allowedFields = [
        'name', 'type', 'humanreadablecardtype', 'frametype', 'description',
        'race', 'archetype', 'atk', 'def', 'level', 'attribute'
    ];
    
    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
        if (changes[field] !== undefined) {
            updates.push(`${field} = $${paramIndex}`);
            values.push(changes[field]);
            paramIndex++;
        }
    }

    if (updates.length === 0) return;

    // Update version_at_snapshot to reflect the new version
    updates.push(`version_at_snapshot = $${paramIndex}`);
    values.push(versionAtSnapshot);
    paramIndex++;

    values.push(snapshotCardId);
    
    await client.query(
        `UPDATE snapshot_custom_cards SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
    );
}

async function updateCustomCardFromChanges(client, customCardId, changes) {
    const allowedFields = [
        'name', 'type', 'humanreadablecardtype', 'frametype', 'description',
        'race', 'archetype', 'atk', 'def', 'level', 'attribute'
    ];
    
    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
        if (changes[field] !== undefined) {
            updates.push(`${field} = $${paramIndex}`);
            values.push(changes[field]);
            paramIndex++;
        }
    }

    if (updates.length === 0) return;

    updates.push(`version = version + 1`);
    updates.push(`updated_at = now()`);

    values.push(customCardId);
    
    await client.query(
        `UPDATE custom_cards SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
    );
}

async function getCustomCardVersion(client, customCardId) {
    const res = await client.query(
        'SELECT version FROM custom_cards WHERE id = $1',
        [customCardId]
    );
    return res.rows[0]?.version || 1;
}

// ------------------------------------------------------------------
// UTILITY: Lock snapshot when tournament starts
// ------------------------------------------------------------------

/**
 * Lock a snapshot (called when tournament starts)
 */
export async function lockSnapshot(snapshotId) {
    const res = await pool.query(
        `UPDATE custom_collection_snapshots 
         SET sync_locked = true 
         WHERE id = $1 
         RETURNING *`,
        [snapshotId]
    );
    return res.rows[0];
}

/**
 * Lock all snapshots for a tournament
 */
export async function lockTournamentSnapshots(tournamentId) {
    const res = await pool.query(
        `UPDATE custom_collection_snapshots 
         SET sync_locked = true 
         WHERE tournament_id = $1 
         RETURNING id`,
        [tournamentId]
    );
    return res.rows.map(r => r.id);
}

// ------------------------------------------------------------------
// CUSTOM DECK COLLECTIONS
// ------------------------------------------------------------------

/**
 * Create a custom deck collection
 */
export async function createCustomCollection(userId, name, description = '') {
    const res = await pool.query(
        `INSERT INTO custom_deck_collections (user_id, name, description)
         VALUES ($1, $2, $3) RETURNING *`,
        [userId, name, description]
    );
    return res.rows[0];
}

/**
 * Get all custom collections for a user
 */
export async function getUserCustomCollections(userId) {
    const res = await pool.query(
        `SELECT * FROM custom_deck_collections 
         WHERE user_id = $1 
         ORDER BY updated_at DESC`,
        [userId]
    );
    return res.rows;
}

/**
 * Get a custom collection by ID (with decks)
 */
export async function getCustomCollection(collectionId, userId) {
    const collectionRes = await pool.query(
        `SELECT * FROM custom_deck_collections WHERE id = $1 AND user_id = $2`,
        [collectionId, userId]
    );
    
    if (collectionRes.rows.length === 0) return null;
    
    const decksRes = await pool.query(
        `SELECT * FROM custom_collection_decks WHERE collection_id = $1 ORDER BY created_at`,
        [collectionId]
    );
    
    return {
        ...collectionRes.rows[0],
        decks: decksRes.rows
    };
}

/**
 * Update a custom collection
 */
export async function updateCustomCollection(collectionId, userId, changes) {
    const { name, description } = changes;
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
        updates.push(`name = ${paramIndex}`);
        values.push(name);
        paramIndex++;
    }
    if (description !== undefined) {
        updates.push(`description = ${paramIndex}`);
        values.push(description);
        paramIndex++;
    }
    
    if (updates.length === 0) {
        throw new Error('No valid fields to update');
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(collectionId, userId);
    
    const res = await pool.query(
        `UPDATE custom_deck_collections 
         SET ${updates.join(', ')} 
         WHERE id = ${paramIndex} AND user_id = ${paramIndex + 1}
         RETURNING *`,
        values
    );
    
    if (res.rows.length === 0) {
        throw new Error('Collection not found or not owned by user');
    }
    
    return res.rows[0];
}

/**
 * Delete a custom collection
 */
export async function deleteCustomCollection(collectionId, userId) {
    const res = await pool.query(
        `DELETE FROM custom_deck_collections WHERE id = $1 AND user_id = $2 RETURNING id`,
        [collectionId, userId]
    );
    
    if (res.rows.length === 0) {
        throw new Error('Collection not found or not owned by user');
    }
    
    return { deleted: true, id: collectionId };
}

// ------------------------------------------------------------------
// CUSTOM COLLECTION DECKS
// ------------------------------------------------------------------

/**
 * Add a deck to a custom collection
 */
export async function addCustomDeck(collectionId, userId, deckData) {
    // Verify ownership
    const collection = await pool.query(
        'SELECT id FROM custom_deck_collections WHERE id = $1 AND user_id = $2',
        [collectionId, userId]
    );
    if (collection.rows.length === 0) {
        throw new Error('Collection not found or not owned by user');
    }
    
    const { deckName, archetype, description } = deckData;
    
    const res = await pool.query(
        `INSERT INTO custom_collection_decks (collection_id, deck_name, archetype, description)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [collectionId, deckName, archetype || null, description || null]
    );
    
    // Update collection timestamp
    await pool.query(
        'UPDATE custom_deck_collections SET updated_at = NOW() WHERE id = $1',
        [collectionId]
    );
    
    return res.rows[0];
}

/**
 * Get a deck with its cards
 */
export async function getCustomDeck(deckId, userId) {
    const deckRes = await pool.query(
        `SELECT d.*, c.user_id 
         FROM custom_collection_decks d
         JOIN custom_deck_collections c ON d.collection_id = c.id
         WHERE d.id = $1 AND c.user_id = $2`,
        [deckId, userId]
    );
    
    if (deckRes.rows.length === 0) return null;
    
    // Get cards (both official and custom)
    const cardsRes = await pool.query(
        `SELECT cdc.*, 
                cards.name AS card_name, cards.type AS card_type, cards.frametype AS card_frametype,
                cc.name AS custom_card_name, cc.type AS custom_card_type, cc.frametype AS custom_card_frametype
         FROM custom_collection_deck_cards cdc
         LEFT JOIN cards ON cdc.card_id = cards.id
         LEFT JOIN custom_cards cc ON cdc.custom_card_id = cc.id
         WHERE cdc.deck_id = $1`,
        [deckId]
    );
    
    return {
        ...deckRes.rows[0],
        cards: cardsRes.rows.map(c => ({
            id: c.id,
            card_id: c.card_id,
            custom_card_id: c.custom_card_id,
            quantity: c.quantity,
            deck_section: c.deck_section,
            name: c.card_name || c.custom_card_name,
            type: c.card_type || c.custom_card_type,
            frametype: c.card_frametype || c.custom_card_frametype,
            is_custom: c.custom_card_id !== null
        }))
    };
}

/**
 * Update a deck
 */
export async function updateCustomDeck(deckId, userId, changes) {
    // Verify ownership
    const deckCheck = await pool.query(
        `SELECT d.id, d.collection_id FROM custom_collection_decks d
         JOIN custom_deck_collections c ON d.collection_id = c.id
         WHERE d.id = $1 AND c.user_id = $2`,
        [deckId, userId]
    );
    if (deckCheck.rows.length === 0) {
        throw new Error('Deck not found or not owned by user');
    }
    
    const { deckName, archetype, description } = changes;
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (deckName !== undefined) {
        updates.push(`deck_name = ${paramIndex}`);
        values.push(deckName);
        paramIndex++;
    }
    if (archetype !== undefined) {
        updates.push(`archetype = ${paramIndex}`);
        values.push(archetype);
        paramIndex++;
    }
    if (description !== undefined) {
        updates.push(`description = ${paramIndex}`);
        values.push(description);
        paramIndex++;
    }
    
    if (updates.length === 0) {
        throw new Error('No valid fields to update');
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(deckId);
    
    const res = await pool.query(
        `UPDATE custom_collection_decks SET ${updates.join(', ')} WHERE id = ${paramIndex} RETURNING *`,
        values
    );
    
    // Update collection timestamp
    await pool.query(
        'UPDATE custom_deck_collections SET updated_at = NOW() WHERE id = $1',
        [deckCheck.rows[0].collection_id]
    );
    
    return res.rows[0];
}

/**
 * Delete a deck
 */
export async function deleteCustomDeck(deckId, userId) {
    const deckCheck = await pool.query(
        `SELECT d.id, d.collection_id FROM custom_collection_decks d
         JOIN custom_deck_collections c ON d.collection_id = c.id
         WHERE d.id = $1 AND c.user_id = $2`,
        [deckId, userId]
    );
    if (deckCheck.rows.length === 0) {
        throw new Error('Deck not found or not owned by user');
    }
    
    await pool.query('DELETE FROM custom_collection_decks WHERE id = $1', [deckId]);
    
    // Update collection timestamp
    await pool.query(
        'UPDATE custom_deck_collections SET updated_at = NOW() WHERE id = $1',
        [deckCheck.rows[0].collection_id]
    );
    
    return { deleted: true, id: deckId };
}

// ------------------------------------------------------------------
// CUSTOM DECK CARDS
// ------------------------------------------------------------------

/**
 * Add a card to a deck (official or custom)
 */
export async function addCardToCustomDeck(deckId, userId, cardData) {
    const { cardId, customCardId, quantity, deckSection } = cardData;
    
    // Verify deck ownership
    const deckCheck = await pool.query(
        `SELECT d.id, d.collection_id FROM custom_collection_decks d
         JOIN custom_deck_collections c ON d.collection_id = c.id
         WHERE d.id = $1 AND c.user_id = $2`,
        [deckId, userId]
    );
    if (deckCheck.rows.length === 0) {
        throw new Error('Deck not found or not owned by user');
    }
    
    // Verify custom card ownership if adding custom card
    if (customCardId) {
        const cardCheck = await pool.query(
            'SELECT id FROM custom_cards WHERE id = $1 AND created_by = $2 AND deleted_at IS NULL',
            [customCardId, userId]
        );
        if (cardCheck.rows.length === 0) {
            throw new Error('Custom card not found or not owned by user');
        }
    }
    
    const res = await pool.query(
        `INSERT INTO custom_collection_deck_cards (deck_id, card_id, custom_card_id, quantity, deck_section)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (deck_id, COALESCE(card_id, -1), COALESCE(custom_card_id, -1), deck_section) 
         DO UPDATE SET quantity = EXCLUDED.quantity
         RETURNING *`,
        [deckId, cardId || null, customCardId || null, quantity, deckSection]
    );
    
    // Update timestamps
    await pool.query('UPDATE custom_collection_decks SET updated_at = NOW() WHERE id = $1', [deckId]);
    await pool.query(
        'UPDATE custom_deck_collections SET updated_at = NOW() WHERE id = $1',
        [deckCheck.rows[0].collection_id]
    );
    
    return res.rows[0];
}

/**
 * Remove a card from a deck
 */
export async function removeCardFromCustomDeck(deckId, userId, cardData) {
    const { cardId, customCardId, deckSection } = cardData;
    
    // Verify deck ownership
    const deckCheck = await pool.query(
        `SELECT d.id, d.collection_id FROM custom_collection_decks d
         JOIN custom_deck_collections c ON d.collection_id = c.id
         WHERE d.id = $1 AND c.user_id = $2`,
        [deckId, userId]
    );
    if (deckCheck.rows.length === 0) {
        throw new Error('Deck not found or not owned by user');
    }
    
    let res;
    if (cardId) {
        res = await pool.query(
            `DELETE FROM custom_collection_deck_cards 
             WHERE deck_id = $1 AND card_id = $2 AND deck_section = $3
             RETURNING *`,
            [deckId, cardId, deckSection]
        );
    } else if (customCardId) {
        res = await pool.query(
            `DELETE FROM custom_collection_deck_cards 
             WHERE deck_id = $1 AND custom_card_id = $2 AND deck_section = $3
             RETURNING *`,
            [deckId, customCardId, deckSection]
        );
    } else {
        throw new Error('Either cardId or customCardId must be provided');
    }
    
    if (res.rows.length === 0) {
        throw new Error('Card not found in deck');
    }
    
    // Update timestamps
    await pool.query('UPDATE custom_collection_decks SET updated_at = NOW() WHERE id = $1', [deckId]);
    await pool.query(
        'UPDATE custom_deck_collections SET updated_at = NOW() WHERE id = $1',
        [deckCheck.rows[0].collection_id]
    );
    
    return { removed: true };
}

// ------------------------------------------------------------------
// CUSTOM COLLECTION SNAPSHOTS
// ------------------------------------------------------------------

/**
 * Get next version number for a collection's snapshots
 */
async function getNextCustomVersionNumber(sourceCollectionId) {
    const res = await pool.query(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
         FROM custom_collection_snapshots
         WHERE source_collection_id = $1`,
        [sourceCollectionId]
    );
    return res.rows[0].next_version;
}

/**
 * Copy decks and custom cards to snapshot
 */
async function copyCustomDecksToSnapshot(client, snapshotId, sourceCollectionId) {
    // Get all decks in the collection
    const decks = await client.query(
        'SELECT * FROM custom_collection_decks WHERE collection_id = $1',
        [sourceCollectionId]
    );
    
    // Track which custom cards we've already copied
    const copiedCustomCards = new Map(); // source_custom_card_id -> snapshot_custom_card_id
    
    for (const deck of decks.rows) {
        // Create snapshot deck
        const newDeck = await client.query(
            `INSERT INTO custom_snapshot_decks
             (snapshot_id, source_deck_id, deck_name, archetype, description)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [snapshotId, deck.id, deck.deck_name, deck.archetype, deck.description || '']
        );
        
        // Get all cards in the deck
        const cards = await client.query(
            'SELECT * FROM custom_collection_deck_cards WHERE deck_id = $1',
            [deck.id]
        );
        
        for (const card of cards.rows) {
            let snapshotCustomCardId = null;
            
            if (card.custom_card_id) {
                // Check if we already copied this custom card
                if (copiedCustomCards.has(card.custom_card_id)) {
                    snapshotCustomCardId = copiedCustomCards.get(card.custom_card_id);
                } else {
                    // Copy the custom card to snapshot
                    const customCard = await client.query(
                        'SELECT * FROM custom_cards WHERE id = $1',
                        [card.custom_card_id]
                    );
                    
                    if (customCard.rows[0]) {
                        const cc = customCard.rows[0];
                        const snapshotCard = await client.query(
                            `INSERT INTO snapshot_custom_cards
                             (snapshot_id, source_custom_card_id, name, type, humanreadablecardtype,
                              frametype, description, race, archetype, atk, def, level, attribute, version_at_snapshot)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                             RETURNING *`,
                            [snapshotId, cc.id, cc.name, cc.type, cc.humanreadablecardtype,
                             cc.frametype, cc.description, cc.race, cc.archetype,
                             cc.atk, cc.def, cc.level, cc.attribute, cc.version]
                        );
                        snapshotCustomCardId = snapshotCard.rows[0].id;
                        copiedCustomCards.set(card.custom_card_id, snapshotCustomCardId);
                    }
                }
            }
            
            // Add card to snapshot deck
            await client.query(
                `INSERT INTO custom_snapshot_deck_cards
                 (deck_id, card_id, snapshot_custom_card_id, quantity, deck_section)
                 VALUES ($1, $2, $3, $4, $5)`,
                [newDeck.rows[0].id, card.card_id, snapshotCustomCardId, card.quantity, card.deck_section]
            );
        }
    }
}

/**
 * Create a series snapshot from a custom collection
 */
export async function createCustomSeriesSnapshot(seriesId, collectionId, userId) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Verify collection ownership
        const collection = await client.query(
            'SELECT * FROM custom_deck_collections WHERE id = $1 AND user_id = $2',
            [collectionId, userId]
        );
        if (collection.rows.length === 0) {
            throw new Error('Collection not found or not owned by user');
        }
        
        const version = await getNextCustomVersionNumber(collectionId);
        
        // Create snapshot
        const snapshot = await client.query(
            `INSERT INTO custom_collection_snapshots
             (source_collection_id, snapshot_type, series_id, collection_name, version_number, sync_locked)
             VALUES ($1, 'series', $2, $3, $4, false)
             RETURNING *`,
            [collectionId, seriesId, collection.rows[0].name, version]
        );
        
        // Copy decks and cards
        await copyCustomDecksToSnapshot(client, snapshot.rows[0].id, collectionId);
        
        await client.query('COMMIT');
        return snapshot.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Create a tournament snapshot from various sources
 */
export async function createCustomTournamentSnapshot(tournamentId, options, userId) {
    const { sourceType, sourceId, seriesId } = options;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        let sourceCollectionId;
        let parentSnapshotId = null;
        
        if (sourceType === 'series_snapshot') {
            const ss = await client.query(
                'SELECT source_collection_id FROM custom_collection_snapshots WHERE id = $1',
                [sourceId]
            );
            if (ss.rows.length === 0) throw new Error('Series snapshot not found');
            sourceCollectionId = ss.rows[0].source_collection_id;
            parentSnapshotId = sourceId;
        } else if (sourceType === 'previous_tournament') {
            const ts = await client.query(
                'SELECT source_collection_id FROM custom_collection_snapshots WHERE id = $1',
                [sourceId]
            );
            if (ts.rows.length === 0) throw new Error('Tournament snapshot not found');
            sourceCollectionId = ts.rows[0].source_collection_id;
            parentSnapshotId = sourceId;
        } else if (sourceType === 'user_collection') {
            // Verify ownership
            const collection = await client.query(
                'SELECT id FROM custom_deck_collections WHERE id = $1 AND user_id = $2',
                [sourceId, userId]
            );
            if (collection.rows.length === 0) {
                throw new Error('Collection not found or not owned by user');
            }
            sourceCollectionId = sourceId;
        } else {
            throw new Error('Invalid sourceType');
        }
        
        const version = await getNextCustomVersionNumber(sourceCollectionId);
        
        const collectionNameRes = await client.query(
            'SELECT name FROM custom_deck_collections WHERE id = $1',
            [sourceCollectionId]
        );
        
        // Create snapshot
        const snapshot = await client.query(
            `INSERT INTO custom_collection_snapshots
             (source_collection_id, parent_snapshot_id, snapshot_type, tournament_id, series_id, collection_name, version_number, sync_locked)
             VALUES ($1, $2, 'tournament', $3, $4, $5, $6, false)
             RETURNING *`,
            [sourceCollectionId, parentSnapshotId, tournamentId, seriesId || null, collectionNameRes.rows[0].name, version]
        );
        
        // Copy decks and cards
        await copyCustomDecksToSnapshot(client, snapshot.rows[0].id, sourceCollectionId);
        
        await client.query('COMMIT');
        return snapshot.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get a snapshot with its decks and cards
 */
export async function getCustomSnapshot(snapshotId) {
    const snapshotRes = await pool.query(
        'SELECT * FROM custom_collection_snapshots WHERE id = $1',
        [snapshotId]
    );
    if (snapshotRes.rows.length === 0) return null;
    
    const decksRes = await pool.query(
        'SELECT * FROM custom_snapshot_decks WHERE snapshot_id = $1',
        [snapshotId]
    );
    
    const customCardsRes = await pool.query(
        'SELECT * FROM snapshot_custom_cards WHERE snapshot_id = $1',
        [snapshotId]
    );
    
    return {
        ...snapshotRes.rows[0],
        decks: decksRes.rows,
        customCards: customCardsRes.rows
    };
}
