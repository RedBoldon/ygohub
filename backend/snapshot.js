/**
 * Snapshot Service
 * 
 * Handles creating frozen copies of collections and decks for tournaments.
 * Each snapshot is linked to its tournament_id, so history can be traced via tournament dates.
 */

import { pool } from './db.js';

/**
 * Create a collection snapshot for a tournament (Organizer Mode)
 * 
 * @param {number} tournamentId - The tournament ID
 * @param {number} collectionId - The source collection ID
 * @param {number|null} seriesId - Optional series ID
 * @returns {Promise<{snapshotId: number}>}
 */
export async function createCollectionSnapshot(tournamentId, collectionId, seriesId = null) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Get collection info
        const collectionResult = await client.query(
            'SELECT name, description FROM deck_collections WHERE id = $1',
            [collectionId]
        );

        if (collectionResult.rows.length === 0) {
            throw new Error('Collection not found');
        }

        const collection = collectionResult.rows[0];

        // Create the snapshot
        const snapshotResult = await client.query(
            `INSERT INTO collection_snapshots 
             (source_collection_id, snapshot_type, series_id, tournament_id, 
              collection_name, description, version_number)
             VALUES ($1, 'tournament', $2, $3, $4, $5, 1)
             RETURNING id`,
            [collectionId, seriesId, tournamentId, collection.name, collection.description]
        );

        const snapshotId = snapshotResult.rows[0].id;

        // Copy all decks from the collection
        const decksResult = await client.query(
            `SELECT id, deck_name, archetype, description 
             FROM collection_decks 
             WHERE collection_id = $1`,
            [collectionId]
        );

        for (const deck of decksResult.rows) {
            // Create snapshot deck
            const snapshotDeckResult = await client.query(
                `INSERT INTO snapshot_decks 
                 (snapshot_id, source_deck_id, deck_name, archetype, description)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [snapshotId, deck.id, deck.deck_name, deck.archetype, deck.description]
            );

            const snapshotDeckId = snapshotDeckResult.rows[0].id;

            // Copy all cards in the deck
            await client.query(
                `INSERT INTO snapshot_deck_cards (deck_id, card_id, quantity, deck_section)
                 SELECT $1, card_id, quantity, deck_section
                 FROM collection_deck_cards
                 WHERE deck_id = $2`,
                [snapshotDeckId, deck.id]
            );
        }

        await client.query('COMMIT');

        return { snapshotId };

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Select a deck for a player (Player Mode) - stores reference only, no snapshot yet
 * Snapshot is created when tournament starts
 * 
 * @param {number} tournamentId - The tournament ID
 * @param {number} userId - The player's user ID
 * @param {number} deckId - The source deck ID from player's collection
 * @returns {Promise<{deckId: number, deckName: string}>}
 */
export async function selectPlayerDeck(tournamentId, userId, deckId) {
    // Verify deck belongs to user
    const deckResult = await pool.query(
        `SELECT cd.id, cd.deck_name, cd.archetype, cd.description, dc.user_id
         FROM collection_decks cd
         JOIN deck_collections dc ON cd.collection_id = dc.id
         WHERE cd.id = $1`,
        [deckId]
    );

    if (deckResult.rows.length === 0) {
        throw new Error('Deck not found');
    }

    const deck = deckResult.rows[0];

    if (deck.user_id !== userId) {
        throw new Error('Deck does not belong to user');
    }

    // Verify user is participant
    const participant = await pool.query(
        `SELECT id FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2`,
        [tournamentId, userId]
    );

    if (participant.rows.length === 0) {
        throw new Error('Not a participant in this tournament');
    }

    // Store deck selection (reference to live deck, not snapshot)
    await pool.query(
        `UPDATE tournament_participants 
         SET assigned_deck_id = $1
         WHERE tournament_id = $2 AND user_id = $3`,
        [deckId, tournamentId, userId]
    );

    return { deckId: deck.id, deckName: deck.deck_name };
}

/**
 * Snapshot all player decks when tournament starts (Player Mode)
 * Creates snapshots of each player's selected deck
 * 
 * @param {number} tournamentId - The tournament ID
 * @param {number|null} seriesId - Optional series ID
 * @returns {Promise<{snapshotId: number, deckCount: number}>}
 */
export async function snapshotPlayerDecks(tournamentId, seriesId = null) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get all participants with their selected decks
        const participantsResult = await client.query(
            `SELECT tp.user_id, tp.assigned_deck_id,
                    cd.deck_name, cd.archetype, cd.description
             FROM tournament_participants tp
             JOIN collection_decks cd ON tp.assigned_deck_id = cd.id
             WHERE tp.tournament_id = $1 AND tp.assigned_deck_id IS NOT NULL`,
            [tournamentId]
        );

        if (participantsResult.rows.length === 0) {
            await client.query('COMMIT');
            return { snapshotId: null, deckCount: 0 };
        }

        // Create a player-decks snapshot container
        const snapshotResult = await client.query(
            `INSERT INTO collection_snapshots 
             (source_collection_id, snapshot_type, series_id, tournament_id, 
              collection_name, version_number)
             VALUES (NULL, 'tournament', $1, $2, 'Player Decks', 1)
             RETURNING id`,
            [seriesId, tournamentId]
        );

        const snapshotId = snapshotResult.rows[0].id;

        // Create snapshot for each player's deck
        for (const participant of participantsResult.rows) {
            // Create the deck snapshot
            const snapshotDeckResult = await client.query(
                `INSERT INTO snapshot_decks 
                 (snapshot_id, source_deck_id, deck_name, archetype, description)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [snapshotId, participant.assigned_deck_id, participant.deck_name, 
                 participant.archetype, participant.description]
            );

            const snapshotDeckId = snapshotDeckResult.rows[0].id;

            // Copy all cards from the live deck
            await client.query(
                `INSERT INTO snapshot_deck_cards (deck_id, card_id, quantity, deck_section)
                 SELECT $1, card_id, quantity, deck_section
                 FROM collection_deck_cards
                 WHERE deck_id = $2`,
                [snapshotDeckId, participant.assigned_deck_id]
            );

            // Link player to their snapshot deck
            await client.query(
                `INSERT INTO player_tournament_decks (tournament_id, user_id, snapshot_deck_id)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (tournament_id, user_id) 
                 DO UPDATE SET snapshot_deck_id = $3, selected_at = NOW()`,
                [tournamentId, participant.user_id, snapshotDeckId]
            );
        }

        await client.query('COMMIT');

        return { snapshotId, deckCount: participantsResult.rows.length };

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Get snapshot info for a tournament
 */
export async function getTournamentSnapshot(tournamentId) {
    const result = await pool.query(
        `SELECT cs.*, 
                (SELECT COUNT(*) FROM snapshot_decks sd WHERE sd.snapshot_id = cs.id) as deck_count
         FROM collection_snapshots cs
         WHERE cs.tournament_id = $1`,
        [tournamentId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const snapshot = result.rows[0];

    // Get decks
    const decksResult = await pool.query(
        `SELECT sd.*, 
                (SELECT COUNT(*) FROM snapshot_deck_cards sdc WHERE sdc.deck_id = sd.id) as card_count
         FROM snapshot_decks sd
         WHERE sd.snapshot_id = $1
         ORDER BY sd.deck_name`,
        [snapshot.id]
    );

    return {
        ...snapshot,
        decks: decksResult.rows
    };
}

/**
 * Create snapshots for assigned decks in Organizer Mode
 * Called when tournament starts
 */
export async function snapshotAssignedDecks(tournamentId, collectionId, seriesId = null) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // First create the collection snapshot
        const { snapshotId } = await createCollectionSnapshot(tournamentId, collectionId, seriesId);

        // Get all participants with assigned decks
        const participantsResult = await client.query(
            `SELECT tp.user_id, tp.assigned_deck_id
             FROM tournament_participants tp
             WHERE tp.tournament_id = $1 AND tp.assigned_deck_id IS NOT NULL`,
            [tournamentId]
        );

        // Map original deck IDs to snapshot deck IDs
        const deckMappingResult = await client.query(
            `SELECT sd.id as snapshot_deck_id, sd.source_deck_id
             FROM snapshot_decks sd
             WHERE sd.snapshot_id = $1`,
            [snapshotId]
        );

        const deckMapping = new Map();
        for (const row of deckMappingResult.rows) {
            deckMapping.set(row.source_deck_id, row.snapshot_deck_id);
        }

        // Link each participant to their snapshot deck
        for (const participant of participantsResult.rows) {
            const snapshotDeckId = deckMapping.get(participant.assigned_deck_id);
            
            if (snapshotDeckId) {
                await client.query(
                    `INSERT INTO player_tournament_decks (tournament_id, user_id, snapshot_deck_id)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (tournament_id, user_id) 
                     DO UPDATE SET snapshot_deck_id = $3, selected_at = NOW()`,
                    [tournamentId, participant.user_id, snapshotDeckId]
                );

                // Increment times_selected on the snapshot deck
                await client.query(
                    `UPDATE snapshot_decks SET times_selected = times_selected + 1 WHERE id = $1`,
                    [snapshotDeckId]
                );
            }
        }

        await client.query('COMMIT');

        return { snapshotId, deckCount: deckMapping.size };

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// ------------------------------------------------------------------
// CUSTOM COLLECTION SNAPSHOTS
// ------------------------------------------------------------------

/**
 * Create a custom collection snapshot for a tournament (Organizer Mode with custom cards)
 * Also snapshots all custom cards used in the decks
 * 
 * @param {number} tournamentId - The tournament ID
 * @param {number} collectionId - The source custom collection ID
 * @param {number|null} seriesId - Optional series ID
 * @returns {Promise<{snapshotId: number}>}
 */
export async function createCustomCollectionSnapshot(tournamentId, collectionId, seriesId = null) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Get collection info
        const collectionResult = await client.query(
            'SELECT name, description FROM custom_deck_collections WHERE id = $1',
            [collectionId]
        );

        if (collectionResult.rows.length === 0) {
            throw new Error('Custom collection not found');
        }

        const collection = collectionResult.rows[0];

        // Create the snapshot
        const snapshotResult = await client.query(
            `INSERT INTO custom_collection_snapshots 
             (source_collection_id, snapshot_type, series_id, tournament_id, 
              collection_name, description, version_number)
             VALUES ($1, 'tournament', $2, $3, $4, $5, 1)
             RETURNING id`,
            [collectionId, seriesId, tournamentId, collection.name, collection.description]
        );

        const snapshotId = snapshotResult.rows[0].id;

        // Get all unique custom cards used in this collection's decks
        const customCardsResult = await client.query(
            `SELECT DISTINCT cc.id, cc.name, cc.type, cc.humanreadablecardtype, cc.frametype,
                    cc.description, cc.race, cc.archetype, cc.atk, cc.def, cc.level, 
                    cc.attribute, cc.version
             FROM custom_cards cc
             JOIN custom_collection_deck_cards ccdc ON ccdc.custom_card_id = cc.id
             JOIN custom_collection_decks ccd ON ccdc.deck_id = ccd.id
             WHERE ccd.collection_id = $1 AND cc.deleted_at IS NULL`,
            [collectionId]
        );

        // Create snapshot of each custom card and build mapping
        const customCardMapping = new Map();
        for (const card of customCardsResult.rows) {
            const snapshotCardResult = await client.query(
                `INSERT INTO snapshot_custom_cards 
                 (snapshot_id, source_custom_card_id, name, type, humanreadablecardtype, frametype,
                  description, race, archetype, atk, def, level, attribute, version_at_snapshot)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                 RETURNING id`,
                [snapshotId, card.id, card.name, card.type, card.humanreadablecardtype, card.frametype,
                 card.description, card.race, card.archetype, card.atk, card.def, card.level, 
                 card.attribute, card.version]
            );
            customCardMapping.set(card.id, snapshotCardResult.rows[0].id);
        }

        // Copy all decks from the collection
        const decksResult = await client.query(
            `SELECT id, deck_name, archetype, description 
             FROM custom_collection_decks 
             WHERE collection_id = $1`,
            [collectionId]
        );

        for (const deck of decksResult.rows) {
            // Create snapshot deck
            const snapshotDeckResult = await client.query(
                `INSERT INTO custom_snapshot_decks 
                 (snapshot_id, source_deck_id, deck_name, archetype, description)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [snapshotId, deck.id, deck.deck_name, deck.archetype, deck.description]
            );

            const snapshotDeckId = snapshotDeckResult.rows[0].id;

            // Copy all cards in the deck (both official and custom)
            const deckCardsResult = await client.query(
                `SELECT card_id, custom_card_id, quantity, deck_section
                 FROM custom_collection_deck_cards
                 WHERE deck_id = $1`,
                [deck.id]
            );

            for (const deckCard of deckCardsResult.rows) {
                if (deckCard.card_id) {
                    // Official card
                    await client.query(
                        `INSERT INTO custom_snapshot_deck_cards (deck_id, card_id, quantity, deck_section)
                         VALUES ($1, $2, $3, $4)`,
                        [snapshotDeckId, deckCard.card_id, deckCard.quantity, deckCard.deck_section]
                    );
                } else if (deckCard.custom_card_id) {
                    // Custom card - use the snapshot version
                    const snapshotCustomCardId = customCardMapping.get(deckCard.custom_card_id);
                    if (snapshotCustomCardId) {
                        await client.query(
                            `INSERT INTO custom_snapshot_deck_cards (deck_id, snapshot_custom_card_id, quantity, deck_section)
                             VALUES ($1, $2, $3, $4)`,
                            [snapshotDeckId, snapshotCustomCardId, deckCard.quantity, deckCard.deck_section]
                        );
                    }
                }
            }
        }

        await client.query('COMMIT');

        return { snapshotId, customCardsSnapshotted: customCardMapping.size };

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Create snapshots for assigned decks in Organizer Mode with custom cards
 * Called when tournament starts
 */
export async function snapshotCustomAssignedDecks(tournamentId, collectionId, seriesId = null) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // First create the custom collection snapshot
        const { snapshotId, customCardsSnapshotted } = await createCustomCollectionSnapshot(tournamentId, collectionId, seriesId);

        // Get all participants with assigned decks
        // Note: For custom collections, assigned_deck_id references custom_collection_decks
        const participantsResult = await client.query(
            `SELECT tp.user_id, tp.assigned_deck_id
             FROM tournament_participants tp
             WHERE tp.tournament_id = $1 AND tp.assigned_deck_id IS NOT NULL`,
            [tournamentId]
        );

        // Map original deck IDs to snapshot deck IDs
        const deckMappingResult = await client.query(
            `SELECT sd.id as snapshot_deck_id, sd.source_deck_id
             FROM custom_snapshot_decks sd
             WHERE sd.snapshot_id = $1`,
            [snapshotId]
        );

        const deckMapping = new Map();
        for (const row of deckMappingResult.rows) {
            deckMapping.set(row.source_deck_id, row.snapshot_deck_id);
        }

        // Link each participant to their snapshot deck
        // Note: We reuse player_tournament_decks but it now points to custom_snapshot_decks
        // This is a simplification - in production you might want a separate table
        for (const participant of participantsResult.rows) {
            const snapshotDeckId = deckMapping.get(participant.assigned_deck_id);
            
            if (snapshotDeckId) {
                // For custom snapshots, we store a reference but need to track it's custom
                // We'll use the existing player_tournament_decks for now
                // The frontend will need to know which type of snapshot to query
                await client.query(
                    `INSERT INTO player_tournament_decks (tournament_id, user_id, snapshot_deck_id)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (tournament_id, user_id) 
                     DO UPDATE SET snapshot_deck_id = $3, selected_at = NOW()`,
                    [tournamentId, participant.user_id, snapshotDeckId]
                );

                // Increment times_selected on the snapshot deck
                await client.query(
                    `UPDATE custom_snapshot_decks SET times_selected = times_selected + 1 WHERE id = $1`,
                    [snapshotDeckId]
                );
            }
        }

        await client.query('COMMIT');

        return { snapshotId, deckCount: deckMapping.size, customCardsSnapshotted };

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Get custom snapshot info for a tournament
 */
export async function getCustomTournamentSnapshot(tournamentId) {
    const result = await pool.query(
        `SELECT cs.*, 
                (SELECT COUNT(*) FROM custom_snapshot_decks sd WHERE sd.snapshot_id = cs.id) as deck_count
         FROM custom_collection_snapshots cs
         WHERE cs.tournament_id = $1`,
        [tournamentId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const snapshot = result.rows[0];

    // Get decks
    const decksResult = await pool.query(
        `SELECT sd.*, 
                (SELECT COUNT(*) FROM custom_snapshot_deck_cards sdc WHERE sdc.deck_id = sd.id) as card_count
         FROM custom_snapshot_decks sd
         WHERE sd.snapshot_id = $1
         ORDER BY sd.deck_name`,
        [snapshot.id]
    );

    // Get custom cards in this snapshot
    const customCardsResult = await pool.query(
        `SELECT * FROM snapshot_custom_cards WHERE snapshot_id = $1`,
        [snapshot.id]
    );

    return {
        ...snapshot,
        decks: decksResult.rows,
        customCards: customCardsResult.rows
    };
}
