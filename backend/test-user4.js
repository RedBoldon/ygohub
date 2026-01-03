/**
 * Create test data for User ID 4
 * Creates a collection with decks and tournament snapshots
 */

import { pool } from './db.js';
import { snapshotAssignedDecks } from './snapshot.js';

const USER_ID = 4;

async function getRandomCards(count) {
    const result = await pool.query(
        `SELECT id, name FROM cards ORDER BY RANDOM() LIMIT $1`,
        [count]
    );
    return result.rows;
}

async function run() {
    console.log('═'.repeat(70));
    console.log('   CREATING TEST DATA FOR USER ID 4');
    console.log('═'.repeat(70));

    // Check user exists
    const userCheck = await pool.query('SELECT id, username FROM users WHERE id = $1', [USER_ID]);
    if (userCheck.rows.length === 0) {
        console.log(`❌ User ID ${USER_ID} not found!`);
        process.exit(1);
    }
    console.log(`\n✅ User found: ${userCheck.rows[0].username}`);

    // Create collection
    console.log('\n📝 Creating collection...');
    const collectionResult = await pool.query(
        `INSERT INTO deck_collections (user_id, name, description)
         VALUES ($1, 'My Tournament Collection', 'Collection for testing snapshots')
         RETURNING id, name`,
        [USER_ID]
    );
    const collection = collectionResult.rows[0];
    console.log(`   ✅ Collection: ${collection.name} (id: ${collection.id})`);

    // Create decks
    console.log('\n📝 Creating decks...');
    const deck1Result = await pool.query(
        `INSERT INTO collection_decks (collection_id, deck_name, archetype, description)
         VALUES ($1, 'Blue-Eyes Chaos', 'Blue-Eyes', 'Classic Blue-Eyes with Chaos MAX')
         RETURNING id, deck_name`,
        [collection.id]
    );
    const deck1 = deck1Result.rows[0];

    const deck2Result = await pool.query(
        `INSERT INTO collection_decks (collection_id, deck_name, archetype, description)
         VALUES ($1, 'Dark Magician Control', 'Dark Magician', 'Spellcaster control deck')
         RETURNING id, deck_name`,
        [collection.id]
    );
    const deck2 = deck2Result.rows[0];

    const deck3Result = await pool.query(
        `INSERT INTO collection_decks (collection_id, deck_name, archetype, description)
         VALUES ($1, 'Branded Despia', 'Branded', 'Fusion-focused control')
         RETURNING id, deck_name`,
        [collection.id]
    );
    const deck3 = deck3Result.rows[0];

    console.log(`   ✅ Deck 1: ${deck1.deck_name} (id: ${deck1.id})`);
    console.log(`   ✅ Deck 2: ${deck2.deck_name} (id: ${deck2.id})`);
    console.log(`   ✅ Deck 3: ${deck3.deck_name} (id: ${deck3.id})`);

    // Add cards to decks
    console.log('\n📝 Adding cards to decks...');
    const cards = await getRandomCards(30);
    
    // Deck 1: 10 cards
    for (let i = 0; i < 10; i++) {
        await pool.query(
            `INSERT INTO collection_deck_cards (deck_id, card_id, quantity, deck_section)
             VALUES ($1, $2, $3, 'main')`,
            [deck1.id, cards[i].id, (i % 3) + 1]
        );
    }
    
    // Deck 2: 10 cards
    for (let i = 10; i < 20; i++) {
        await pool.query(
            `INSERT INTO collection_deck_cards (deck_id, card_id, quantity, deck_section)
             VALUES ($1, $2, $3, 'main')`,
            [deck2.id, cards[i].id, (i % 3) + 1]
        );
    }
    
    // Deck 3: 10 cards
    for (let i = 20; i < 30; i++) {
        await pool.query(
            `INSERT INTO collection_deck_cards (deck_id, card_id, quantity, deck_section)
             VALUES ($1, $2, $3, 'main')`,
            [deck3.id, cards[i].id, (i % 3) + 1]
        );
    }
    console.log('   ✅ Added 10 cards to each deck');

    // Create first tournament
    console.log('\n📝 Creating Tournament 1...');
    const inviteCode1 = Math.random().toString(36).substring(2, 10).toUpperCase();
    const t1Result = await pool.query(
        `INSERT INTO tournaments (name, created_by, invite_code, deck_mode, collection_id, min_player_count, status)
         VALUES ('Weekly Tournament #1', $1, $2, 'organizer', $3, 2, 'in_progress')
         RETURNING id, name`,
        [USER_ID, inviteCode1, collection.id]
    );
    const tournament1 = t1Result.rows[0];
    console.log(`   ✅ Tournament: ${tournament1.name} (id: ${tournament1.id})`);

    // Create snapshot for tournament 1
    const snapshot1 = await snapshotAssignedDecks(tournament1.id, collection.id, null);
    console.log(`   ✅ Snapshot created with ${snapshot1.deckCount} decks`);

    // Modify deck 1 (add/remove cards)
    console.log('\n📝 Modifying Deck 1...');
    const newCards = await getRandomCards(3);
    
    // Remove 2 cards
    await pool.query(
        `DELETE FROM collection_deck_cards WHERE deck_id = $1 AND card_id IN ($2, $3)`,
        [deck1.id, cards[0].id, cards[1].id]
    );
    console.log(`   📝 Removed: ${cards[0].name}, ${cards[1].name}`);
    
    // Add 3 new cards
    for (const card of newCards) {
        await pool.query(
            `INSERT INTO collection_deck_cards (deck_id, card_id, quantity, deck_section)
             VALUES ($1, $2, 2, 'main')
             ON CONFLICT DO NOTHING`,
            [deck1.id, card.id]
        );
    }
    console.log(`   📝 Added: ${newCards.map(c => c.name).join(', ')}`);

    // Add deck 4 to collection
    console.log('\n📝 Adding new deck to collection...');
    const deck4Result = await pool.query(
        `INSERT INTO collection_decks (collection_id, deck_name, archetype, description)
         VALUES ($1, 'Tearlaments Ishizu', 'Tearlaments', 'Mill-based combo deck')
         RETURNING id, deck_name`,
        [collection.id]
    );
    const deck4 = deck4Result.rows[0];
    
    // Add cards to deck 4
    const deck4Cards = await getRandomCards(8);
    for (let i = 0; i < deck4Cards.length; i++) {
        await pool.query(
            `INSERT INTO collection_deck_cards (deck_id, card_id, quantity, deck_section)
             VALUES ($1, $2, $3, 'main')`,
            [deck4.id, deck4Cards[i].id, (i % 3) + 1]
        );
    }
    console.log(`   ✅ Deck 4: ${deck4.deck_name} (id: ${deck4.id})`);

    // Create second tournament
    console.log('\n📝 Creating Tournament 2...');
    const inviteCode2 = Math.random().toString(36).substring(2, 10).toUpperCase();
    const t2Result = await pool.query(
        `INSERT INTO tournaments (name, created_by, invite_code, deck_mode, collection_id, min_player_count, status)
         VALUES ('Weekly Tournament #2', $1, $2, 'organizer', $3, 2, 'in_progress')
         RETURNING id, name`,
        [USER_ID, inviteCode2, collection.id]
    );
    const tournament2 = t2Result.rows[0];
    console.log(`   ✅ Tournament: ${tournament2.name} (id: ${tournament2.id})`);

    // Create snapshot for tournament 2
    const snapshot2 = await snapshotAssignedDecks(tournament2.id, collection.id, null);
    console.log(`   ✅ Snapshot created with ${snapshot2.deckCount} decks`);

    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('   SUMMARY');
    console.log('═'.repeat(70));
    console.log(`   Collection ID: ${collection.id}`);
    console.log(`   - Deck 1: ${deck1.deck_name} (modified between snapshots)`);
    console.log(`   - Deck 2: ${deck2.deck_name}`);
    console.log(`   - Deck 3: ${deck3.deck_name}`);
    console.log(`   - Deck 4: ${deck4.deck_name} (added after first snapshot)`);
    console.log('');
    console.log(`   Tournament 1: ${tournament1.name} → Snapshot has 3 decks`);
    console.log(`   Tournament 2: ${tournament2.name} → Snapshot has 4 decks`);
    console.log('═'.repeat(70));
    console.log('\n✅ Done! Go to Collections to see the history.\n');

    process.exit(0);
}

run().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
