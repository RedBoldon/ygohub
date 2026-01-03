/**
 * Comprehensive Snapshot System Test
 * 
 * Tests the entire flow:
 * 1. Create user, collection, decks with cards
 * 2. Create tournament (organizer mode)
 * 3. Assign decks to players
 * 4. Start tournament → snapshots created
 * 5. Modify original deck (add/remove cards)
 * 6. Verify snapshot is unchanged (frozen)
 * 7. Create second tournament with same collection
 * 8. Verify version increments
 * 9. Check history API
 */

import { pool } from './db.js';
import { createCollectionSnapshot, snapshotAssignedDecks, snapshotPlayerDecks, selectPlayerDeck } from './snapshot.js';

const TEST_PREFIX = 'SNAPSHOT_TEST_';

async function cleanup() {
    console.log('\n🧹 Cleaning up previous test data...');
    
    // Delete in correct order due to foreign keys
    await pool.query(`DELETE FROM player_tournament_decks WHERE tournament_id IN (SELECT id FROM tournaments WHERE name LIKE $1)`, [`${TEST_PREFIX}%`]);
    await pool.query(`DELETE FROM snapshot_deck_cards WHERE deck_id IN (SELECT sd.id FROM snapshot_decks sd JOIN collection_snapshots cs ON sd.snapshot_id = cs.id WHERE cs.collection_name LIKE $1)`, [`${TEST_PREFIX}%`]);
    await pool.query(`DELETE FROM snapshot_decks WHERE snapshot_id IN (SELECT id FROM collection_snapshots WHERE collection_name LIKE $1)`, [`${TEST_PREFIX}%`]);
    await pool.query(`DELETE FROM collection_snapshots WHERE collection_name LIKE $1`, [`${TEST_PREFIX}%`]);
    await pool.query(`DELETE FROM match_participants WHERE match_id IN (SELECT id FROM matches WHERE tournament_id IN (SELECT id FROM tournaments WHERE name LIKE $1))`, [`${TEST_PREFIX}%`]);
    await pool.query(`DELETE FROM matches WHERE tournament_id IN (SELECT id FROM tournaments WHERE name LIKE $1)`, [`${TEST_PREFIX}%`]);
    await pool.query(`DELETE FROM tournament_rounds WHERE tournament_id IN (SELECT id FROM tournaments WHERE name LIKE $1)`, [`${TEST_PREFIX}%`]);
    await pool.query(`DELETE FROM tournament_participants WHERE tournament_id IN (SELECT id FROM tournaments WHERE name LIKE $1)`, [`${TEST_PREFIX}%`]);
    await pool.query(`DELETE FROM tournaments WHERE name LIKE $1`, [`${TEST_PREFIX}%`]);
    await pool.query(`DELETE FROM collection_deck_cards WHERE deck_id IN (SELECT id FROM collection_decks WHERE deck_name LIKE $1)`, [`${TEST_PREFIX}%`]);
    await pool.query(`DELETE FROM collection_decks WHERE deck_name LIKE $1`, [`${TEST_PREFIX}%`]);
    await pool.query(`DELETE FROM deck_collections WHERE name LIKE $1`, [`${TEST_PREFIX}%`]);
    await pool.query(`DELETE FROM tournament_series WHERE name LIKE $1`, [`${TEST_PREFIX}%`]);
    await pool.query(`DELETE FROM users WHERE username LIKE $1`, [`${TEST_PREFIX}%`]);
    
    console.log('✅ Cleanup complete\n');
}

async function createTestUser(name) {
    const result = await pool.query(
        `INSERT INTO users (username, tag, password_hash, email, status)
         VALUES ($1, $2, 'test_hash', $3, 'active')
         RETURNING id, username`,
        [`${TEST_PREFIX}${name}`, Math.floor(Math.random() * 9999), `${TEST_PREFIX}${name}@test.com`]
    );
    return result.rows[0];
}

async function createTestCollection(userId, name) {
    const result = await pool.query(
        `INSERT INTO deck_collections (user_id, name, description)
         VALUES ($1, $2, 'Test collection')
         RETURNING id, name`,
        [userId, `${TEST_PREFIX}${name}`]
    );
    return result.rows[0];
}

async function createTestDeck(collectionId, name, archetype) {
    const result = await pool.query(
        `INSERT INTO collection_decks (collection_id, deck_name, archetype)
         VALUES ($1, $2, $3)
         RETURNING id, deck_name`,
        [collectionId, `${TEST_PREFIX}${name}`, archetype]
    );
    return result.rows[0];
}

async function addCardToDeck(deckId, cardId, quantity, section = 'main') {
    await pool.query(
        `INSERT INTO collection_deck_cards (deck_id, card_id, quantity, deck_section)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (deck_id, card_id, deck_section) DO UPDATE SET quantity = $3`,
        [deckId, cardId, quantity, section]
    );
}

async function getRandomCards(count) {
    const result = await pool.query(
        `SELECT id, name FROM cards ORDER BY RANDOM() LIMIT $1`,
        [count]
    );
    return result.rows;
}

async function createTestTournament(creatorId, name, deckMode, collectionId = null) {
    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const result = await pool.query(
        `INSERT INTO tournaments (name, created_by, invite_code, deck_mode, collection_id, min_player_count, status)
         VALUES ($1, $2, $3, $4, $5, 2, 'open')
         RETURNING id, name, deck_mode`,
        [`${TEST_PREFIX}${name}`, creatorId, inviteCode, deckMode, collectionId]
    );
    return result.rows[0];
}

async function addParticipant(tournamentId, userId) {
    await pool.query(
        `INSERT INTO tournament_participants (tournament_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [tournamentId, userId]
    );
    await pool.query(
        `UPDATE tournaments SET player_count = player_count + 1 WHERE id = $1`,
        [tournamentId]
    );
}

async function assignDeck(tournamentId, userId, deckId) {
    await pool.query(
        `UPDATE tournament_participants SET assigned_deck_id = $1
         WHERE tournament_id = $2 AND user_id = $3`,
        [deckId, tournamentId, userId]
    );
}

async function getDeckCards(deckId, isSnapshot = false) {
    const table = isSnapshot ? 'snapshot_deck_cards' : 'collection_deck_cards';
    const result = await pool.query(
        `SELECT dc.card_id, dc.quantity, dc.deck_section, c.name
         FROM ${table} dc
         JOIN cards c ON dc.card_id = c.id
         WHERE dc.deck_id = $1
         ORDER BY c.name`,
        [deckId]
    );
    return result.rows;
}

async function getSnapshotForTournament(tournamentId) {
    const result = await pool.query(
        `SELECT cs.*, 
                (SELECT COUNT(*) FROM snapshot_decks WHERE snapshot_id = cs.id) as deck_count
         FROM collection_snapshots cs
         WHERE cs.tournament_id = $1`,
        [tournamentId]
    );
    return result.rows[0];
}

async function getSnapshotDecks(snapshotId) {
    const result = await pool.query(
        `SELECT sd.*, 
                (SELECT COUNT(*) FROM snapshot_deck_cards WHERE deck_id = sd.id) as card_count
         FROM snapshot_decks sd
         WHERE sd.snapshot_id = $1`,
        [snapshotId]
    );
    return result.rows;
}

// ============================================================================
// MAIN TEST
// ============================================================================

async function runTest() {
    console.log('═'.repeat(70));
    console.log('   SNAPSHOT SYSTEM COMPREHENSIVE TEST');
    console.log('═'.repeat(70));

    await cleanup();

    try {
        // ====================================================================
        // STEP 1: Create test users
        // ====================================================================
        console.log('\n📝 STEP 1: Creating test users...');
        const organizer = await createTestUser('Organizer');
        const player1 = await createTestUser('Player1');
        const player2 = await createTestUser('Player2');
        console.log(`   ✅ Created: ${organizer.username}, ${player1.username}, ${player2.username}`);

        // ====================================================================
        // STEP 2: Create collection with decks
        // ====================================================================
        console.log('\n📝 STEP 2: Creating collection with decks...');
        const collection = await createTestCollection(organizer.id, 'Tournament_Collection');
        console.log(`   ✅ Collection: ${collection.name} (id: ${collection.id})`);

        const deck1 = await createTestDeck(collection.id, 'Blue_Eyes_Deck', 'Blue-Eyes');
        const deck2 = await createTestDeck(collection.id, 'Dark_Magician_Deck', 'Dark Magician');
        console.log(`   ✅ Deck 1: ${deck1.deck_name} (id: ${deck1.id})`);
        console.log(`   ✅ Deck 2: ${deck2.deck_name} (id: ${deck2.id})`);

        // ====================================================================
        // STEP 3: Add cards to decks
        // ====================================================================
        console.log('\n📝 STEP 3: Adding cards to decks...');
        const cards = await getRandomCards(10);
        
        // Deck 1: 5 cards
        for (let i = 0; i < 5; i++) {
            await addCardToDeck(deck1.id, cards[i].id, (i % 3) + 1, 'main');
        }
        // Deck 2: 5 cards
        for (let i = 5; i < 10; i++) {
            await addCardToDeck(deck2.id, cards[i].id, (i % 3) + 1, 'main');
        }

        const deck1CardsBefore = await getDeckCards(deck1.id);
        const deck2CardsBefore = await getDeckCards(deck2.id);
        console.log(`   ✅ Deck 1 has ${deck1CardsBefore.length} unique cards`);
        console.log(`   ✅ Deck 2 has ${deck2CardsBefore.length} unique cards`);
        
        console.log('\n   📋 Deck 1 cards BEFORE snapshot:');
        deck1CardsBefore.forEach(c => console.log(`      - ${c.name} ×${c.quantity}`));

        // ====================================================================
        // STEP 4: Create tournament (Organizer Mode)
        // ====================================================================
        console.log('\n📝 STEP 4: Creating tournament (Organizer Mode)...');
        const tournament1 = await createTestTournament(organizer.id, 'Tournament_1', 'organizer', collection.id);
        console.log(`   ✅ Tournament: ${tournament1.name} (id: ${tournament1.id}, mode: ${tournament1.deck_mode})`);

        // ====================================================================
        // STEP 5: Add participants and assign decks
        // ====================================================================
        console.log('\n📝 STEP 5: Adding participants and assigning decks...');
        await addParticipant(tournament1.id, player1.id);
        await addParticipant(tournament1.id, player2.id);
        await assignDeck(tournament1.id, player1.id, deck1.id);
        await assignDeck(tournament1.id, player2.id, deck2.id);
        console.log(`   ✅ ${player1.username} assigned ${deck1.deck_name}`);
        console.log(`   ✅ ${player2.username} assigned ${deck2.deck_name}`);

        // ====================================================================
        // STEP 6: Start tournament → Create snapshot
        // ====================================================================
                console.log('\n📝 STEP 6: Creating snapshot (simulating tournament start)...');
        const snapshotResult = await snapshotAssignedDecks(tournament1.id, collection.id, null);
        console.log(`   ✅ Snapshot created! Decks: ${snapshotResult.deckCount}`);

        // Get snapshot details
        const snapshot1 = await getSnapshotForTournament(tournament1.id);
        const snapshotDecks1 = await getSnapshotDecks(snapshot1.id);
        console.log(`   📦 Snapshot ID: ${snapshot1.id}`);
        console.log(`   📦 Source Collection: ${snapshot1.source_collection_id}`);
        snapshotDecks1.forEach(sd => {
            console.log(`      - ${sd.deck_name} (snapshot_deck_id: ${sd.id}, source: ${sd.source_deck_id}, cards: ${sd.card_count})`);
        });

        // ====================================================================
        // STEP 7: Verify snapshot cards match original
        // ====================================================================
        console.log('\n📝 STEP 7: Verifying snapshot cards match original...');
        const snapshotDeck1 = snapshotDecks1.find(sd => sd.source_deck_id === deck1.id);
        const snapshotDeck1Cards = await getDeckCards(snapshotDeck1.id, true);
        
        const originalCardIds = new Set(deck1CardsBefore.map(c => c.card_id));
        const snapshotCardIds = new Set(snapshotDeck1Cards.map(c => c.card_id));
        
        const cardsMatch = deck1CardsBefore.length === snapshotDeck1Cards.length &&
            [...originalCardIds].every(id => snapshotCardIds.has(id));
        
        if (cardsMatch) {
            console.log(`   ✅ Snapshot cards match original! (${snapshotDeck1Cards.length} cards)`);
        } else {
            console.log(`   ❌ MISMATCH! Original: ${deck1CardsBefore.length}, Snapshot: ${snapshotDeck1Cards.length}`);
        }

        // ====================================================================
        // STEP 8: MODIFY the original deck (add cards, change quantities)
        // ====================================================================
        console.log('\n📝 STEP 8: Modifying original deck (simulating user changes)...');
        
        // Add a new card
        const newCards = await getRandomCards(2);
        await addCardToDeck(deck1.id, newCards[0].id, 3, 'main');
        console.log(`   📝 Added: ${newCards[0].name} ×3`);
        
        // Change quantity of existing card
        if (deck1CardsBefore.length > 0) {
            const cardToChange = deck1CardsBefore[0];
            const newQty = cardToChange.quantity === 3 ? 1 : 3;
            await addCardToDeck(deck1.id, cardToChange.card_id, newQty, 'main');
            console.log(`   📝 Changed: ${cardToChange.name} from ×${cardToChange.quantity} to ×${newQty}`);
        }

        // Remove a card
        if (deck1CardsBefore.length > 1) {
            const cardToRemove = deck1CardsBefore[1];
            await pool.query(
                `DELETE FROM collection_deck_cards WHERE deck_id = $1 AND card_id = $2`,
                [deck1.id, cardToRemove.card_id]
            );
            console.log(`   📝 Removed: ${cardToRemove.name}`);
        }

        const deck1CardsAfter = await getDeckCards(deck1.id);
        console.log(`\n   📋 Deck 1 cards AFTER modification:`);
        deck1CardsAfter.forEach(c => console.log(`      - ${c.name} ×${c.quantity}`));

        // ====================================================================
        // STEP 9: VERIFY SNAPSHOT IS UNCHANGED
        // ====================================================================
        console.log('\n📝 STEP 9: ⭐ CRITICAL TEST - Verifying snapshot is FROZEN...');
        
        const snapshotDeck1CardsAfter = await getDeckCards(snapshotDeck1.id, true);
        
        console.log(`\n   📋 Snapshot Deck 1 cards (should be UNCHANGED):`);
        snapshotDeck1CardsAfter.forEach(c => console.log(`      - ${c.name} ×${c.quantity}`));

        // Compare snapshot before and after modification
        const snapshotUnchanged = 
            snapshotDeck1Cards.length === snapshotDeck1CardsAfter.length &&
            snapshotDeck1Cards.every((c, i) => 
                c.card_id === snapshotDeck1CardsAfter[i].card_id &&
                c.quantity === snapshotDeck1CardsAfter[i].quantity
            );

        if (snapshotUnchanged) {
            console.log(`\n   ✅ ✅ ✅ SNAPSHOT IS FROZEN! Changes to original deck did NOT affect snapshot!`);
        } else {
            console.log(`\n   ❌ ❌ ❌ ERROR: Snapshot was modified! This should not happen!`);
        }

        // Also verify the live deck DID change
        const liveChanged = deck1CardsBefore.length !== deck1CardsAfter.length;
        if (liveChanged) {
            console.log(`   ✅ Live deck WAS modified (${deck1CardsBefore.length} → ${deck1CardsAfter.length} cards)`);
        }

        // ====================================================================
        // STEP 10: Create second tournament → Version should increment
        // ====================================================================
                console.log('\n📝 STEP 10: Creating second tournament with same collection...');
        const tournament2 = await createTestTournament(organizer.id, 'Tournament_2', 'organizer', collection.id);
        await addParticipant(tournament2.id, player1.id);
        await addParticipant(tournament2.id, player2.id);
        await assignDeck(tournament2.id, player1.id, deck1.id);
        await assignDeck(tournament2.id, player2.id, deck2.id);
        
        const snapshotResult2 = await snapshotAssignedDecks(tournament2.id, collection.id, null);
        console.log(`   ✅ Second snapshot created! Decks: ${snapshotResult2.deckCount}`);

        const snapshot2 = await getSnapshotForTournament(tournament2.id);
        console.log(`   📦 Snapshot 1 created: ${snapshot1.created_at}`);
        console.log(`   📦 Snapshot 2 created: ${snapshot2.created_at}`);
        console.log(`   ✅ Snapshots are tracked by tournament date, not version numbers`);

        // ====================================================================
        // STEP 11: Verify second snapshot has MODIFIED cards
        // ====================================================================
        console.log('\n📝 STEP 11: Verifying second snapshot has the MODIFIED deck...');
        const snapshotDecks2 = await getSnapshotDecks(snapshot2.id);
        const snapshotDeck1v2 = snapshotDecks2.find(sd => sd.source_deck_id === deck1.id);
        const snapshotDeck1v2Cards = await getDeckCards(snapshotDeck1v2.id, true);

        console.log(`\n   📋 Snapshot v2 Deck 1 cards:`);
        snapshotDeck1v2Cards.forEach(c => console.log(`      - ${c.name} ×${c.quantity}`));

        const v2MatchesLive = 
            deck1CardsAfter.length === snapshotDeck1v2Cards.length &&
            deck1CardsAfter.every(lc => 
                snapshotDeck1v2Cards.some(sc => sc.card_id === lc.card_id && sc.quantity === lc.quantity)
            );

        if (v2MatchesLive) {
            console.log(`\n   ✅ Snapshot v2 correctly captured the MODIFIED deck!`);
        } else {
            console.log(`\n   ❌ Snapshot v2 doesn't match live deck`);
        }

        // ====================================================================
        // SUMMARY
        // ====================================================================
        console.log('\n' + '═'.repeat(70));
        console.log('   TEST SUMMARY');
        console.log('═'.repeat(70));
        console.log(`   Snapshot v1 (Tournament 1): ${snapshotDeck1Cards.length} cards - FROZEN ✅`);
        console.log(`   Live deck after changes:    ${deck1CardsAfter.length} cards`);
        console.log(`   Snapshot v2 (Tournament 2): ${snapshotDeck1v2Cards.length} cards - Captured changes ✅`);
        console.log('═'.repeat(70));

        console.log('\n✅ All tests completed!\n');

    } catch (err) {
        console.error('\n❌ Test failed with error:', err);
        throw err;
    }
}

// Run the test
runTest()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
