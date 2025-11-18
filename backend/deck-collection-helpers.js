// deck-collection-helpers.js
import { pool } from './db.js';

// ------------------------------------------------------------------
// CORE: Automatic version numbering based on source_collection_id
// ------------------------------------------------------------------
async function getNextVersionNumber(sourceCollectionId) {
    const res = await pool.query(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
         FROM collection_snapshots
         WHERE source_collection_id = $1`,
        [sourceCollectionId]
    );
    return res.rows[0].next_version;
}

// ------------------------------------------------------------------
// USER COLLECTIONS
// ------------------------------------------------------------------
export async function createCollection(userId, name, description = '') {
    const res = await pool.query(
        `INSERT INTO deck_collections (user_id, name, description)
         VALUES ($1, $2, $3) RETURNING *`,
        [userId, name, description]
    );
    return res.rows[0];
}

export async function addDeckToCollection(collectionId, deckName, archetype, description = '') {
    const res = await pool.query(
        `INSERT INTO collection_decks (collection_id, deck_name, archetype, description)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [collectionId, deckName, archetype, description]
    );
    return res.rows[0];
}

export async function addCardToDeck(deckId, cardId, quantity, section = 'main') {
    const res = await pool.query(
        `INSERT INTO collection_deck_cards (deck_id, card_id, quantity, deck_section)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (deck_id, card_id, deck_section) DO UPDATE
         SET quantity = EXCLUDED.quantity
         RETURNING *`,
        [deckId, cardId, quantity, section]
    );
    return res.rows[0];
}

// ------------------------------------------------------------------
// SNAPSHOTS
// ------------------------------------------------------------------
async function copyDecksToSnapshot(snapshotId, sourceCollectionId) {
    const decks = await pool.query(
        'SELECT * FROM collection_decks WHERE collection_id = $1',
        [sourceCollectionId]
    );

    for (const deck of decks.rows) {
        const newDeck = await pool.query(
            `INSERT INTO snapshot_decks
             (snapshot_id, source_deck_id, deck_name, archetype, description, times_selected, max_selections)
             VALUES ($1, $2, $3, $4, $5, 0, NULL)
             RETURNING *`,
            [snapshotId, deck.id, deck.deck_name, deck.archetype, deck.description || '']
        );

        const cards = await pool.query(
            'SELECT * FROM collection_deck_cards WHERE deck_id = $1',
            [deck.id]
        );

        for (const card of cards.rows) {
            await pool.query(
                `INSERT INTO snapshot_deck_cards (deck_id, card_id, quantity, deck_section)
                 VALUES ($1, $2, $3, $4)`,
                [newDeck.rows[0].id, card.card_id, card.quantity, card.deck_section]
            );
        }
    }
}

export async function createSeriesSnapshot(seriesId, collectionId) {
    const collection = await pool.query('SELECT name FROM deck_collections WHERE id = $1', [collectionId]);
    if (!collection.rows[0]) throw new Error('Collection not found');

    const version = await getNextVersionNumber(collectionId);

    const snapshot = await pool.query(
        `INSERT INTO collection_snapshots
         (source_collection_id, snapshot_type, series_id, collection_name, version_number)
         VALUES ($1, 'series', $2, $3, $4)
         RETURNING *`,
        [collectionId, seriesId, collection.rows[0].name, version]
    );

    await copyDecksToSnapshot(snapshot.rows[0].id, collectionId);
    return snapshot.rows[0];
}

export async function createTournamentSnapshot(tournamentId, { sourceType, sourceId, seriesId }) {
    let sourceCollectionId;
    let parentSnapshotId = null;

    if (sourceType === 'series_snapshot') {
        const ss = await pool.query('SELECT source_collection_id FROM collection_snapshots WHERE id = $1', [sourceId]);
        sourceCollectionId = ss.rows[0].source_collection_id;
        parentSnapshotId = sourceId;
    } else if (sourceType === 'previous_tournament') {
        const ts = await pool.query('SELECT source_collection_id FROM collection_snapshots WHERE id = $1', [sourceId]);
        sourceCollectionId = ts.rows[0].source_collection_id;
        parentSnapshotId = sourceId;
    } else if (sourceType === 'user_collection') {
        sourceCollectionId = sourceId;
    } else {
        throw new Error('Invalid sourceType');
    }

    const version = await getNextVersionNumber(sourceCollectionId);

    const collectionNameRes = await pool.query('SELECT name FROM deck_collections WHERE id = $1', [sourceCollectionId]);

    const snapshot = await pool.query(
        `INSERT INTO collection_snapshots
         (source_collection_id, parent_snapshot_id, snapshot_type, tournament_id, series_id, collection_name, version_number)
         VALUES ($1, $2, 'tournament', $3, $4, $5, $6)
         RETURNING *`,
        [sourceCollectionId, parentSnapshotId, tournamentId, seriesId, collectionNameRes.rows[0].name, version]
    );

    await copyDecksToSnapshot(snapshot.rows[0].id, sourceCollectionId);
    return snapshot.rows[0];
}

// ------------------------------------------------------------------
// PLAYER SELECTION
// ------------------------------------------------------------------
export async function selectDeckForTournament(tournamentId, userId, snapshotDeckId) {
    // Get snapshot for tournament
    const snapRes = await pool.query(
        'SELECT id FROM collection_snapshots WHERE tournament_id = $1',
        [tournamentId]
    );
    if (snapRes.rows.length === 0) throw new Error('Tournament has no deck pool');

    const snapshotId = snapRes.rows[0].id;

    // Check deck belongs to this snapshot
    const deckCheck = await pool.query(
        'SELECT id, max_selections, times_selected FROM snapshot_decks WHERE id = $1 AND snapshot_id = $2',
        [snapshotDeckId, snapshotId]
    );
    if (deckCheck.rows.length === 0) throw new Error('Deck not available in this tournament');

    const deck = deckCheck.rows[0];
    if (deck.max_selections !== null && deck.times_selected >= deck.max_selections) {
        throw new Error('This deck has reached its selection limit');
    }

    // Record selection
    const selection = await pool.query(
        `INSERT INTO player_tournament_decks (tournament_id, user_id, snapshot_deck_id)
         VALUES ($1, $2, $3) RETURNING *`,
        [tournamentId, userId, snapshotDeckId]
    );

    // Increment counter
    await pool.query(
        'UPDATE snapshot_decks SET times_selected = times_selected + 1 WHERE id = $1',
        [snapshotDeckId]
    );

    return selection.rows[0];
}

export async function getTournamentSnapshot(tournamentId) {
    const res = await pool.query(
        `SELECT cs.*, sd.* FROM collection_snapshots cs
         JOIN snapshot_decks sd ON sd.snapshot_id = cs.id
         WHERE cs.tournament_id = $1`,
        [tournamentId]
    );
    if (res.rows.length === 0) return null;
    return {
        snapshot: res.rows[0],
        decks: res.rows.map(r => ({
            id: r.id,
            deck_name: r.deck_name,
            archetype: r.archetype,
            times_selected: r.times_selected,
            max_selections: r.max_selections
        }))
    };
}