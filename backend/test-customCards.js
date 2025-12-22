// test-customCards.js
import { pool } from './db.js';
import {
    createCustomCard,
    editCustomCard,
    deleteCustomCard,
    getCustomCard,
    getUserCustomCards,
    editSnapshotCustomCard,
    lockSnapshot
} from './customCards.js';

let testUserId;
let testCardId;
let testSnapshotId;
let testSnapshotCardId;
let testSeriesId;
let testOrganizerId;

async function setup() {
    console.log('\n=== SETUP ===\n');
    
    // Create test user
    const userRes = await pool.query(
        `INSERT INTO users (email, username, tag, password_hash)
         VALUES ('customcard-test@test.com', 'CustomCardTester', '0001', 'testhash')
         RETURNING id`
    );
    testUserId = userRes.rows[0].id;
    console.log('Created test user:', testUserId);
    
    // Create organizer for series
    const organizerRes = await pool.query(
        `INSERT INTO organizers (type, user_id, name)
         VALUES ('user', $1, 'Test Organizer')
         RETURNING id`,
        [testUserId]
    );
    testOrganizerId = organizerRes.rows[0].id;
    console.log('Created organizer:', testOrganizerId);
    
    // Create series
    const seriesRes = await pool.query(
        `INSERT INTO tournament_series (name, organizer_id, country_codes)
         VALUES ('Test Series', $1, ARRAY['CH'])
         RETURNING id`,
        [testOrganizerId]
    );
    testSeriesId = seriesRes.rows[0].id;
    console.log('Created series:', testSeriesId);
}

async function cleanup() {
    console.log('\n=== CLEANUP ===\n');
    
    // Clean up in reverse order of dependencies
    await pool.query('DELETE FROM custom_snapshot_deck_cards WHERE deck_id IN (SELECT id FROM custom_snapshot_decks WHERE snapshot_id IN (SELECT id FROM custom_collection_snapshots WHERE source_collection_id IN (SELECT id FROM custom_deck_collections WHERE user_id = $1)))', [testUserId]);
    await pool.query('DELETE FROM snapshot_custom_cards WHERE snapshot_id IN (SELECT id FROM custom_collection_snapshots WHERE source_collection_id IN (SELECT id FROM custom_deck_collections WHERE user_id = $1))', [testUserId]);
    await pool.query('DELETE FROM custom_snapshot_decks WHERE snapshot_id IN (SELECT id FROM custom_collection_snapshots WHERE source_collection_id IN (SELECT id FROM custom_deck_collections WHERE user_id = $1))', [testUserId]);
    await pool.query('DELETE FROM custom_collection_snapshots WHERE source_collection_id IN (SELECT id FROM custom_deck_collections WHERE user_id = $1)', [testUserId]);
    await pool.query('DELETE FROM custom_collection_deck_cards WHERE deck_id IN (SELECT id FROM custom_collection_decks WHERE collection_id IN (SELECT id FROM custom_deck_collections WHERE user_id = $1))', [testUserId]);
    await pool.query('DELETE FROM custom_collection_decks WHERE collection_id IN (SELECT id FROM custom_deck_collections WHERE user_id = $1)', [testUserId]);
    await pool.query('DELETE FROM custom_deck_collections WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM custom_cards WHERE created_by = $1', [testUserId]);
    await pool.query('DELETE FROM custom_cards WHERE created_by IS NULL'); // soft-deleted cards
    await pool.query('DELETE FROM tournament_series WHERE organizer_id = $1', [testOrganizerId]);
    await pool.query('DELETE FROM organizers WHERE id = $1', [testOrganizerId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    
    console.log('Cleanup complete');
}

async function testCreateCustomCard() {
    console.log('\n=== TEST: Create Custom Card ===\n');
    
    const cardData = {
        name: 'Test Dragon',
        type: 'Effect Monster',
        humanreadablecardtype: 'Effect Monster',
        frametype: 'effect',
        description: 'This is a test dragon with powerful effects.',
        race: 'Dragon',
        archetype: 'Test Archetype',
        atk: 2500,
        def: 2000,
        level: 7,
        attribute: 'DARK'
    };
    
    const card = await createCustomCard(testUserId, cardData);
    testCardId = card.id;
    
    console.log('Created card:', card);
    console.log('✓ Card created with version:', card.version);
    
    if (card.version !== 1) throw new Error('Expected version 1');
    if (card.name !== 'Test Dragon') throw new Error('Name mismatch');
    if (card.atk !== 2500) throw new Error('ATK mismatch');
}

async function testEditCustomCard() {
    console.log('\n=== TEST: Edit Custom Card (no snapshots) ===\n');
    
    const result = await editCustomCard(testCardId, testUserId, {
        atk: 3000,
        description: 'Updated description - now even more powerful!'
    });
    
    console.log('Edit result:', result);
    console.log('✓ Card updated, version:', result.card.version);
    console.log('✓ Propagated to:', result.propagatedTo, 'snapshots');
    
    if (result.card.version !== 2) throw new Error('Expected version 2');
    if (result.card.atk !== 3000) throw new Error('ATK should be 3000');
    if (result.propagatedTo !== 0) throw new Error('Should not propagate without snapshots');
}

async function testCreateSnapshotWithCard() {
    console.log('\n=== TEST: Create Snapshot with Custom Card ===\n');
    
    // 1. Create a custom deck collection
    const collectionRes = await pool.query(
        `INSERT INTO custom_deck_collections (user_id, name, description)
         VALUES ($1, 'Test Collection', 'For testing')
         RETURNING *`,
        [testUserId]
    );
    const collectionId = collectionRes.rows[0].id;
    console.log('Created collection:', collectionId);
    
    // 2. Create a deck in the collection
    const deckRes = await pool.query(
        `INSERT INTO custom_collection_decks (collection_id, deck_name, archetype)
         VALUES ($1, 'Dragon Deck', 'Test Archetype')
         RETURNING *`,
        [collectionId]
    );
    const deckId = deckRes.rows[0].id;
    console.log('Created deck:', deckId);
    
    // 3. Add custom card to deck
    await pool.query(
        `INSERT INTO custom_collection_deck_cards (deck_id, custom_card_id, quantity, deck_section)
         VALUES ($1, $2, 3, 'main')`,
        [deckId, testCardId]
    );
    console.log('Added card to deck');
    
    // 4. Create a snapshot (simulating series snapshot creation)
    const currentCard = await getCustomCard(testCardId);
    
    const snapshotRes = await pool.query(
        `INSERT INTO custom_collection_snapshots 
         (source_collection_id, snapshot_type, series_id, collection_name, version_number, sync_locked)
         VALUES ($1, 'series', $2, 'Test Collection Snapshot', 1, false)
         RETURNING *`,
        [collectionId, testSeriesId]
    );
    testSnapshotId = snapshotRes.rows[0].id;
    console.log('Created snapshot:', testSnapshotId);
    
    // 5. Copy custom card to snapshot
    const snapshotCardRes = await pool.query(
        `INSERT INTO snapshot_custom_cards 
         (snapshot_id, source_custom_card_id, name, type, humanreadablecardtype, frametype, 
          description, race, archetype, atk, def, level, attribute, version_at_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [testSnapshotId, testCardId, currentCard.name, currentCard.type, 
         currentCard.humanreadablecardtype, currentCard.frametype, currentCard.description,
         currentCard.race, currentCard.archetype, currentCard.atk, currentCard.def, 
         currentCard.level, currentCard.attribute, currentCard.version]
    );
    testSnapshotCardId = snapshotCardRes.rows[0].id;
    console.log('Created snapshot card:', testSnapshotCardId);
    console.log('✓ Snapshot created with card at version:', snapshotCardRes.rows[0].version_at_snapshot);
}

async function testEditCardPropagation() {
    console.log('\n=== TEST: Edit Custom Card (with propagation) ===\n');
    
    const result = await editCustomCard(testCardId, testUserId, {
        atk: 3500,
        def: 2500
    });
    
    console.log('Edit result:', result);
    console.log('✓ Card updated, version:', result.card.version);
    console.log('✓ Propagated to:', result.propagatedTo, 'snapshot(s)');
    
    if (result.card.version !== 3) throw new Error('Expected version 3');
    if (result.propagatedTo !== 1) throw new Error('Should propagate to 1 snapshot');
    
    // Verify snapshot was updated
    const snapshotCard = await pool.query(
        'SELECT * FROM snapshot_custom_cards WHERE id = $1',
        [testSnapshotCardId]
    );
    console.log('Snapshot card after propagation:', snapshotCard.rows[0]);
    
    if (snapshotCard.rows[0].atk !== 3500) throw new Error('Snapshot ATK should be 3500');
    if (snapshotCard.rows[0].version_at_snapshot !== 3) throw new Error('Snapshot version should be 3');
}

async function testEditSnapshotCardUnlocked() {
    console.log('\n=== TEST: Edit Snapshot Card (unlocked - propagates back) ===\n');
    
    const result = await editSnapshotCustomCard(testSnapshotCardId, testUserId, {
        name: 'Test Dragon Supreme',
        atk: 4000
    });
    
    console.log('Edit result:', result);
    console.log('✓ Snapshot locked:', result.isLocked);
    console.log('✓ Source updated:', result.sourceUpdated);
    console.log('✓ Propagated to others:', result.propagatedTo);
    
    if (result.isLocked) throw new Error('Snapshot should be unlocked');
    if (!result.sourceUpdated) throw new Error('Source should be updated');
    
    // Verify source card was updated
    const sourceCard = await getCustomCard(testCardId);
    console.log('Source card after edit:', sourceCard);
    
    if (sourceCard.name !== 'Test Dragon Supreme') throw new Error('Source name should be updated');
    if (sourceCard.atk !== 4000) throw new Error('Source ATK should be 4000');
    if (sourceCard.version !== 4) throw new Error('Source version should be 4');
}

async function testLockSnapshot() {
    console.log('\n=== TEST: Lock Snapshot ===\n');
    
    const locked = await lockSnapshot(testSnapshotId);
    console.log('Locked snapshot:', locked);
    console.log('✓ sync_locked:', locked.sync_locked);
    
    if (!locked.sync_locked) throw new Error('Snapshot should be locked');
}

async function testEditCardNoPropagatioToLocked() {
    console.log('\n=== TEST: Edit Custom Card (locked snapshot - no propagation) ===\n');
    
    const result = await editCustomCard(testCardId, testUserId, {
        atk: 5000
    });
    
    console.log('Edit result:', result);
    console.log('✓ Card updated, version:', result.card.version);
    console.log('✓ Propagated to:', result.propagatedTo, 'snapshot(s)');
    
    if (result.propagatedTo !== 0) throw new Error('Should NOT propagate to locked snapshot');
    
    // Verify snapshot was NOT updated
    const snapshotCard = await pool.query(
        'SELECT * FROM snapshot_custom_cards WHERE id = $1',
        [testSnapshotCardId]
    );
    console.log('Snapshot card (should be unchanged):', snapshotCard.rows[0]);
    
    if (snapshotCard.rows[0].atk !== 4000) throw new Error('Snapshot ATK should still be 4000');
}

async function testEditLockedSnapshotCard() {
    console.log('\n=== TEST: Edit Locked Snapshot Card ===\n');
    
    // Edit with propagateToSource = false
    const result1 = await editSnapshotCustomCard(testSnapshotCardId, testUserId, {
        def: 3000
    }, { propagateToSource: false });
    
    console.log('Edit result (no propagate):', result1);
    
    if (!result1.isLocked) throw new Error('Snapshot should be locked');
    if (result1.sourceUpdated) throw new Error('Source should NOT be updated');
    
    // Verify source was NOT updated
    let sourceCard = await getCustomCard(testCardId);
    if (sourceCard.def === 3000) throw new Error('Source DEF should NOT be 3000');
    
    // Edit with propagateToSource = true
    const result2 = await editSnapshotCustomCard(testSnapshotCardId, testUserId, {
        def: 3500
    }, { propagateToSource: true });
    
    console.log('Edit result (with propagate):', result2);
    
    if (!result2.sourceUpdated) throw new Error('Source SHOULD be updated');
    
    // Verify source WAS updated
    sourceCard = await getCustomCard(testCardId);
    console.log('Source card after propagate:', sourceCard);
    
    if (sourceCard.def !== 3500) throw new Error('Source DEF should be 3500');
}

async function testSoftDelete() {
    console.log('\n=== TEST: Soft Delete (card in snapshot) ===\n');
    
    const result = await deleteCustomCard(testCardId, testUserId);
    console.log('Delete result:', result);
    
    if (result.type !== 'soft') throw new Error('Should be soft delete');
    
    // Verify card still exists but is orphaned
    const card = await pool.query(
        'SELECT * FROM custom_cards WHERE id = $1',
        [testCardId]
    );
    console.log('Card after soft delete:', card.rows[0]);
    
    if (card.rows[0].created_by !== null) throw new Error('created_by should be NULL');
    if (!card.rows[0].deleted_at) throw new Error('deleted_at should be set');
    
    // Verify card doesn't appear in user's cards
    const userCards = await getUserCustomCards(testUserId);
    console.log('User cards count:', userCards.length);
    
    if (userCards.some(c => c.id === testCardId)) throw new Error('Soft-deleted card should not appear');
}

async function testHardDelete() {
    console.log('\n=== TEST: Hard Delete (card not in snapshot) ===\n');
    
    // Create a card that's not in any snapshot
    const card = await createCustomCard(testUserId, {
        name: 'Temporary Card',
        type: 'Normal Monster',
        humanreadablecardtype: 'Normal Monster',
        frametype: 'normal',
        description: 'This card will be deleted.',
        race: 'Warrior',
        atk: 1000,
        def: 1000,
        level: 4,
        attribute: 'EARTH'
    });
    console.log('Created temporary card:', card.id);
    
    const result = await deleteCustomCard(card.id, testUserId);
    console.log('Delete result:', result);
    
    if (result.type !== 'hard') throw new Error('Should be hard delete');
    
    // Verify card is completely gone
    const check = await pool.query(
        'SELECT * FROM custom_cards WHERE id = $1',
        [card.id]
    );
    
    if (check.rows.length > 0) throw new Error('Card should be completely deleted');
    console.log('✓ Card permanently deleted');
}

async function runTests() {
    try {
        await setup();
        
        await testCreateCustomCard();
        await testEditCustomCard();
        await testCreateSnapshotWithCard();
        await testEditCardPropagation();
        await testEditSnapshotCardUnlocked();
        await testLockSnapshot();
        await testEditCardNoPropagatioToLocked();
        await testEditLockedSnapshotCard();
        await testSoftDelete();
        await testHardDelete();
        
        console.log('\n========================================');
        console.log('✓ ALL TESTS PASSED!');
        console.log('========================================\n');
        
    } catch (error) {
        console.error('\n========================================');
        console.error('✗ TEST FAILED:', error.message);
        console.error('========================================\n');
        console.error(error);
    } finally {
        await cleanup();
        await pool.end();
    }
}

runTests();
