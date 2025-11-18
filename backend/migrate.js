import { pool } from './db.js';

/**
 * Migration Script: Add Deck Collection System to Existing Database
 * 
 * This script adds the deck collection tables to your existing YGOHub database
 * without dropping your existing tournament, user, and organizer data.
 * 
 * Run this if you already have a populated database and want to add the
 * deck collection functionality.
 */

async function addDeckCollectionTables() {
    console.log('\n========================================');
    console.log('MIGRATION: Adding Deck Collection System');
    console.log('========================================\n');

    try {
        console.log('Step 1: Creating cards table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cards (
                id SERIAL PRIMARY KEY,
                card_id TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                card_type TEXT NOT NULL,
                race TEXT,
                attribute TEXT,
                level INT,
                atk INT,
                def INT,
                description TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                CHECK (card_type IN ('Monster', 'Spell', 'Trap'))
            );
        `);
        console.log('✓ Cards table created');

        console.log('\nStep 2: Creating user collection tables...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS deck_collections (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                CHECK (LENGTH(name) >= 2 AND LENGTH(name) <= 200)
            );
        `);
        console.log('✓ deck_collections table created');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS collection_decks (
                id SERIAL PRIMARY KEY,
                collection_id INT NOT NULL REFERENCES deck_collections(id) ON DELETE CASCADE,
                deck_name TEXT NOT NULL,
                archetype TEXT,
                description TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                CHECK (LENGTH(deck_name) >= 2 AND LENGTH(deck_name) <= 200)
            );
        `);
        console.log('✓ collection_decks table created');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS collection_deck_cards (
                deck_id INT NOT NULL REFERENCES collection_decks(id) ON DELETE CASCADE,
                card_id TEXT NOT NULL REFERENCES cards(card_id),
                quantity INT NOT NULL DEFAULT 1,
                deck_section TEXT NOT NULL,
                PRIMARY KEY (deck_id, card_id, deck_section),
                CHECK (quantity > 0 AND quantity <= 3),
                CHECK (deck_section IN ('main', 'extra', 'side'))
            );
        `);
        console.log('✓ collection_deck_cards table created');

        console.log('\nStep 3: Creating snapshot tables...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS collection_snapshots (
                id SERIAL PRIMARY KEY,
                source_collection_id INT REFERENCES deck_collections(id),
                parent_snapshot_id INT REFERENCES collection_snapshots(id),
                snapshot_type TEXT NOT NULL,
                series_id INT REFERENCES tournament_series(id),
                tournament_id INT REFERENCES tournaments(id),
                collection_name TEXT NOT NULL,
                description TEXT,
                version_number INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT NOW(),
                CHECK (snapshot_type IN ('series', 'tournament')),
                CHECK (version_number > 0),
                CHECK (
                    (snapshot_type = 'series' AND series_id IS NOT NULL AND tournament_id IS NULL) OR
                    (snapshot_type = 'tournament' AND tournament_id IS NOT NULL)
                )
            );
        `);
        console.log('✓ collection_snapshots table created');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS snapshot_decks (
                id SERIAL PRIMARY KEY,
                snapshot_id INT NOT NULL REFERENCES collection_snapshots(id) ON DELETE CASCADE,
                source_deck_id INT REFERENCES collection_decks(id),
                parent_deck_id INT REFERENCES snapshot_decks(id),
                deck_name TEXT NOT NULL,
                archetype TEXT,
                description TEXT,
                max_selections INT,
                times_selected INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                CHECK (LENGTH(deck_name) >= 2 AND LENGTH(deck_name) <= 200),
                CHECK (max_selections IS NULL OR max_selections > 0),
                CHECK (times_selected >= 0),
                CHECK (max_selections IS NULL OR times_selected <= max_selections)
            );
        `);
        console.log('✓ snapshot_decks table created');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS snapshot_deck_cards (
                deck_id INT NOT NULL REFERENCES snapshot_decks(id) ON DELETE CASCADE,
                card_id TEXT NOT NULL REFERENCES cards(card_id),
                quantity INT NOT NULL DEFAULT 1,
                deck_section TEXT NOT NULL,
                PRIMARY KEY (deck_id, card_id, deck_section),
                CHECK (quantity > 0 AND quantity <= 3),
                CHECK (deck_section IN ('main', 'extra', 'side'))
            );
        `);
        console.log('✓ snapshot_deck_cards table created');

        console.log('\nStep 4: Creating player tournament decks table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS player_tournament_decks (
                id SERIAL PRIMARY KEY,
                tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                snapshot_deck_id INT NOT NULL REFERENCES snapshot_decks(id),
                selected_at TIMESTAMP DEFAULT NOW(),
                UNIQUE (tournament_id, user_id)
            );
        `);
        console.log('✓ player_tournament_decks table created');

        console.log('\nStep 5: Updating tournament_formats table...');
        // Check if deck_source column exists
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tournament_formats' 
            AND column_name = 'deck_source';
        `);

        if (columnCheck.rows.length === 0) {
            await pool.query(`
                ALTER TABLE tournament_formats 
                ADD COLUMN deck_source TEXT DEFAULT 'player_owned',
                ADD CONSTRAINT check_deck_source CHECK (deck_source IN ('player_owned', 'organizer_provided', 'hybrid'));
            `);
            console.log('✓ Added deck_source column to tournament_formats');
        } else {
            console.log('✓ deck_source column already exists');
        }

        console.log('\nStep 6: Updating audit_logs table...');
        // Update audit_logs to include new entity types
        const constraintCheck = await pool.query(`
            SELECT constraint_name 
            FROM information_schema.constraint_column_usage 
            WHERE table_name = 'audit_logs' 
            AND constraint_name LIKE '%entity_type%';
        `);

        if (constraintCheck.rows.length > 0) {
            await pool.query(`
                ALTER TABLE audit_logs 
                DROP CONSTRAINT IF EXISTS audit_logs_entity_type_check;
            `);
        }

        await pool.query(`
            ALTER TABLE audit_logs 
            ADD CONSTRAINT audit_logs_entity_type_check 
            CHECK (entity_type IN ('tournament', 'match', 'user', 'organizer', 'series', 'format', 'collection', 'deck'));
        `);
        console.log('✓ Updated audit_logs constraints');

        console.log('\nStep 7: Creating indexes...');
        const indexes = [
            { name: 'idx_deck_collections_user_id', table: 'deck_collections', column: 'user_id' },
            { name: 'idx_collection_decks_collection_id', table: 'collection_decks', column: 'collection_id' },
            { name: 'idx_collection_deck_cards_deck_id', table: 'collection_deck_cards', column: 'deck_id' },
            { name: 'idx_collection_deck_cards_card_id', table: 'collection_deck_cards', column: 'card_id' },
            { name: 'idx_collection_snapshots_source_collection', table: 'collection_snapshots', column: 'source_collection_id' },
            { name: 'idx_collection_snapshots_parent', table: 'collection_snapshots', column: 'parent_snapshot_id' },
            { name: 'idx_collection_snapshots_series', table: 'collection_snapshots', column: 'series_id' },
            { name: 'idx_collection_snapshots_tournament', table: 'collection_snapshots', column: 'tournament_id' },
            { name: 'idx_snapshot_decks_snapshot_id', table: 'snapshot_decks', column: 'snapshot_id' },
            { name: 'idx_snapshot_decks_source_deck', table: 'snapshot_decks', column: 'source_deck_id' },
            { name: 'idx_snapshot_deck_cards_deck_id', table: 'snapshot_deck_cards', column: 'deck_id' },
            { name: 'idx_player_tournament_decks_tournament', table: 'player_tournament_decks', column: 'tournament_id' },
            { name: 'idx_player_tournament_decks_user', table: 'player_tournament_decks', column: 'user_id' }
        ];

        for (const index of indexes) {
            await pool.query(`
                CREATE INDEX IF NOT EXISTS ${index.name} 
                ON ${index.table}(${index.column});
            `);
        }
        console.log('✓ All indexes created');

        console.log('\n========================================');
        console.log('✓ Migration Complete!');
        console.log('========================================\n');
        console.log('New tables added:');
        console.log('  - cards');
        console.log('  - deck_collections');
        console.log('  - collection_decks');
        console.log('  - collection_deck_cards');
        console.log('  - collection_snapshots');
        console.log('  - snapshot_decks');
        console.log('  - snapshot_deck_cards');
        console.log('  - player_tournament_decks');
        console.log('\nExisting data preserved!');
        console.log('You can now use the deck collection system.\n');

    } catch (error) {
        console.error('\n========================================');
        console.error('✗ Migration Failed');
        console.error('========================================\n');
        console.error('Error:', error.message);
        console.error('\nYour existing data has not been modified.');
        throw error;
    }
}

async function verifyMigration() {
    console.log('\n========================================');
    console.log('Verifying Migration...');
    console.log('========================================\n');

    const tables = [
        'cards',
        'deck_collections',
        'collection_decks',
        'collection_deck_cards',
        'collection_snapshots',
        'snapshot_decks',
        'snapshot_deck_cards',
        'player_tournament_decks'
    ];

    for (const table of tables) {
        const result = await pool.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_name = $1;
        `, [table]);

        if (result.rows[0].count === '1') {
            console.log(`✓ ${table} exists`);
        } else {
            console.log(`✗ ${table} MISSING`);
        }
    }

    console.log('\n========================================');
    console.log('Verification Complete');
    console.log('========================================\n');
}

async function rollbackMigration() {
    console.log('\n========================================');
    console.log('ROLLBACK: Removing Deck Collection System');
    console.log('========================================\n');
    console.log('⚠️  This will remove all deck collection data!');
    console.log('Your tournaments, users, and matches will not be affected.\n');

    try {
        await pool.query(`
            DROP TABLE IF EXISTS player_tournament_decks CASCADE;
            DROP TABLE IF EXISTS snapshot_deck_cards CASCADE;
            DROP TABLE IF EXISTS snapshot_decks CASCADE;
            DROP TABLE IF EXISTS collection_snapshots CASCADE;
            DROP TABLE IF EXISTS collection_deck_cards CASCADE;
            DROP TABLE IF EXISTS collection_decks CASCADE;
            DROP TABLE IF EXISTS deck_collections CASCADE;
            DROP TABLE IF EXISTS cards CASCADE;
        `);

        // Remove deck_source column from tournament_formats
        await pool.query(`
            ALTER TABLE tournament_formats 
            DROP COLUMN IF EXISTS deck_source;
        `);

        console.log('\n✓ Deck collection tables removed');
        console.log('✓ Rollback complete\n');

    } catch (error) {
        console.error('✗ Rollback failed:', error.message);
        throw error;
    }
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];

async function main() {
    try {
        if (command === 'migrate') {
            await addDeckCollectionTables();
            await verifyMigration();
        } else if (command === 'verify') {
            await verifyMigration();
        } else if (command === 'rollback') {
            await rollbackMigration();
        } else {
            console.log('\nUsage:');
            console.log('  node migrate.js migrate   - Add deck collection tables');
            console.log('  node migrate.js verify    - Verify migration');
            console.log('  node migrate.js rollback  - Remove deck collection tables\n');
        }
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
