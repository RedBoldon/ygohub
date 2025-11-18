import { pool } from './db.js';

// ============================================
// EXISTING TABLES
// ============================================

const createUsersTable = async () => {
    try {
        const queryText = `
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    tag TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    UNIQUE (username, tag),
    CHECK (role IN ('user', 'admin')),
    CHECK (LENGTH(password_hash) > 0)
);`;
        await pool.query(queryText);
        console.log('✓ Users table created successfully.');
    } catch (error) {
        console.error('✗ Error creating users table:', error);
        throw error;
    }
};

const createOrganizerTable = async () => {
    try {
        const queryText = `CREATE TABLE IF NOT EXISTS organizers (
            id SERIAL PRIMARY KEY,            
            type TEXT NOT NULL,               
            user_id INT REFERENCES users(id), 
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            CHECK (type IN ('user', 'organization')),
            CHECK (LENGTH(name) >= 2 AND LENGTH(name) <= 200),
            CHECK (
                (type = 'user' AND user_id IS NOT NULL) OR 
                (type = 'organization')
            )
        );`;
        await pool.query(queryText);
        console.log('✓ Organizers table created successfully.');
    } catch (error) {
        console.error('✗ Error creating organizers table:', error);
        throw error;
    }
};

const createUserOrganizationTable = async () => {
    try {
        const queryText = `CREATE TABLE IF NOT EXISTS user_organizations (
            user_id INT NOT NULL REFERENCES users(id),
            organization_id INT NOT NULL REFERENCES organizers(id),
            role TEXT DEFAULT 'member',
            joined_at TIMESTAMP DEFAULT NOW(),
            PRIMARY KEY (user_id, organization_id),
            CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
            CHECK (joined_at <= NOW())
        );`;
        await pool.query(queryText);
        console.log('✓ User Organizations table created successfully.');
    } catch (error) {
        console.error('✗ Error creating user organizations table:', error);
        throw error;
    }
};

const createTournamentSeriesTable = async () => {
    try {
        const queryText = `CREATE TABLE IF NOT EXISTS tournament_series (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            organizer_id INT NOT NULL REFERENCES organizers(id),
            country_codes TEXT[] NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            last_tournament_at TIMESTAMP,
            CHECK (ARRAY_LENGTH(country_codes, 1) > 0),
            CHECK (last_tournament_at IS NULL OR last_tournament_at >= created_at),
            CHECK (
                country_codes <@ ARRAY[
                    'US', 'CA', 'MX',
                    'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'PT', 'SE', 'NO', 'DK', 'FI', 'IE', 'PL', 'CZ', 'GR',
                    'JP', 'KR', 'CN', 'TW', 'HK', 'SG', 'MY', 'TH', 'PH', 'ID', 'VN', 'IN',
                    'AU', 'NZ',
                    'BR', 'AR', 'CL', 'CO', 'PE',
                    'ZA', 'EG',
                    'RU', 'TR', 'IL', 'AE', 'SA'
                ]::TEXT[]
            )
        );`;
        await pool.query(queryText);
        console.log('✓ Tournament Series table created successfully.');
    } catch (error) {
        console.error('✗ Error creating tournament series table:', error);
        throw error;
    }
};

const createTournamentFormatsTable = async () => {
    try {
        const queryText = `
CREATE TABLE IF NOT EXISTS tournament_formats (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    has_topcut BOOLEAN DEFAULT FALSE,
    deck_source TEXT DEFAULT 'player_owned',
    description TEXT,
    CHECK (LENGTH(name) >= 2 AND LENGTH(name) <= 100),
    CHECK (deck_source IN ('player_owned', 'organizer_provided', 'hybrid'))
);`;
        await pool.query(queryText);
        console.log('✓ Tournament Formats table created successfully.');
    } catch (error) {
        console.error('✗ Error creating tournament formats table:', error);
        throw error;
    }
};

const createTournamentsTable = async () => {
    try {
        const queryText = `
CREATE TABLE IF NOT EXISTS tournaments (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    min_player_count INT DEFAULT 2,
    max_player_count INT,
    player_count INT DEFAULT 0,
    format_id INT REFERENCES tournament_formats(id),
    series_id INT REFERENCES tournament_series(id),
    location TEXT,
    starting_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    CHECK (max_player_count >= min_player_count),
    CHECK (min_player_count > 0),
    CHECK (max_player_count > 0),
    CHECK (player_count >= 0),
    CHECK (max_player_count IS NULL OR player_count <= max_player_count),
    CHECK (starting_time IS NULL OR starting_time > created_at)
);`;
        await pool.query(queryText);
        console.log('✓ Tournaments table created successfully.');
    } catch (error) {
        console.error('✗ Error creating tournaments table:', error);
        throw error;
    }
};

const createMatchesTable = async () => {
    try {
        const queryText = `
CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    tournament_id INT NOT NULL REFERENCES tournaments(id),
    match_type TEXT NOT NULL,
    team_1_score INT DEFAULT 0,
    team_2_score INT DEFAULT 0,
    winner_team_id INT,
    status TEXT DEFAULT 'pending',
    completed_at TIMESTAMP,
    CHECK (team_1_score >= 0),
    CHECK (team_2_score >= 0),
    CHECK (winner_team_id IN (1, 2) OR winner_team_id IS NULL),
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    CHECK (
        (status = 'completed' AND completed_at IS NOT NULL) OR 
        (status != 'completed' AND completed_at IS NULL)
    )
);`;
        await pool.query(queryText);
        console.log('✓ Matches table created successfully.');
    } catch (error) {
        console.error('✗ Error creating matches table:', error);
        throw error;
    }
};

const createMatchParticipantsTable = async () => {
    try {
        const queryText = `
CREATE TABLE IF NOT EXISTS match_participants (
    match_id INT NOT NULL REFERENCES matches(id),
    player_id INT NOT NULL REFERENCES users(id),
    team_id INT NOT NULL,
    sub_match_id INT,
    score INT DEFAULT 0,
    completed_at TIMESTAMP,
    PRIMARY KEY (match_id, player_id),
    CHECK (team_id IN (1, 2)),
    CHECK (score >= 0)
);`;
        await pool.query(queryText);
        console.log('✓ Match Participants table created successfully.');
    } catch (error) {
        console.error('✗ Error creating match participants table:', error);
        throw error;
    }
};

const createAuditLogsTable = async () => {
    try {
        const queryText = `
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id INT NOT NULL,
    action TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    performed_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    CHECK (entity_type IN ('tournament', 'match', 'user', 'organizer', 'series', 'format', 'collection', 'deck')),
    CHECK (action IN ('create', 'update', 'delete', 'restore')),
    CHECK (entity_id > 0)
);`;
        await pool.query(queryText);
        console.log('✓ Audit Logs table created successfully.');
    } catch (error) {
        console.error('✗ Error creating audit logs table:', error);
        throw error;
    }
};

// ============================================
// CARD DATABASE TABLES
// ============================================

const createCardsTable = async () => {
    try {
        const queryText = `
CREATE TABLE IF NOT EXISTS cards (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    humanReadableCardType TEXT NOT NULL,
    frameType TEXT NOT NULL,
    description TEXT NOT NULL,
    race TEXT NOT NULL,
    archetype TEXT,
    atk INT,
    def INT,
    level INT,
    attribute TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    CHECK (frameType IN ('spell','effect','normal','link','trap','fusion','effect_pendulum',
           'xyz','synchro','ritual','skill','token','fusion_pendulum',
           'normal_pendulum','synchro_pendulum','xyz_pendulum','ritual_pendulum'))
);

-- Create indexes for common searches
CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);
CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(type);
CREATE INDEX IF NOT EXISTS idx_cards_frametype ON cards(frameType);
CREATE INDEX IF NOT EXISTS idx_cards_archetype ON cards(archetype);
CREATE INDEX IF NOT EXISTS idx_cards_race ON cards(race);
CREATE INDEX IF NOT EXISTS idx_cards_attribute ON cards(attribute);
CREATE INDEX IF NOT EXISTS idx_cards_level ON cards(level);
`;
        await pool.query(queryText);
        console.log('✓ Cards table created successfully.');
    } catch (error) {
        console.error('✗ Error creating cards table:', error);
        throw error;
    }
};

// ============================================
// USER DECK COLLECTION TABLES
// ============================================

const createDeckCollectionsTable = async () => {
    try {
        const queryText = `
CREATE TABLE IF NOT EXISTS deck_collections (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CHECK (LENGTH(name) >= 2 AND LENGTH(name) <= 200)
);`;
        await pool.query(queryText);
        console.log('✓ Deck Collections table created successfully.');
    } catch (error) {
        console.error('✗ Error creating deck collections table:', error);
        throw error;
    }
};

const createCollectionDecksTable = async () => {
    try {
        const queryText = `
CREATE TABLE IF NOT EXISTS collection_decks (
    id SERIAL PRIMARY KEY,
    collection_id INT NOT NULL REFERENCES deck_collections(id) ON DELETE CASCADE,
    deck_name TEXT NOT NULL,
    archetype TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CHECK (LENGTH(deck_name) >= 2 AND LENGTH(deck_name) <= 200)
);`;
        await pool.query(queryText);
        console.log('✓ Collection Decks table created successfully.');
    } catch (error) {
        console.error('✗ Error creating collection decks table:', error);
        throw error;
    }
};

const createCollectionDeckCardsTable = async () => {
    try {
        const queryText = `
CREATE TABLE IF NOT EXISTS collection_deck_cards (
    deck_id INT NOT NULL REFERENCES collection_decks(id) ON DELETE CASCADE,
    card_id BIGINT NOT NULL REFERENCES cards(id),
    quantity INT NOT NULL DEFAULT 1,
    deck_section TEXT NOT NULL,
    PRIMARY KEY (deck_id, card_id, deck_section),
    CHECK (quantity > 0 AND quantity <= 3),
    CHECK (deck_section IN ('main', 'extra', 'side'))
);`;
        await pool.query(queryText);
        console.log('✓ Collection Deck Cards table created successfully.');
    } catch (error) {
        console.error('✗ Error creating collection deck cards table:', error);
        throw error;
    }
};

// ============================================
// COLLECTION SNAPSHOT TABLES (SERIES & TOURNAMENTS)
// ============================================

const createCollectionSnapshotsTable = async () => {
    try {
        const queryText = `
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
);`;
        await pool.query(queryText);
        console.log('✓ Collection Snapshots table created successfully.');
    } catch (error) {
        console.error('✗ Error creating collection snapshots table:', error);
        throw error;
    }
};

const createSnapshotDecksTable = async () => {
    try {
        const queryText = `
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
);`;
        await pool.query(queryText);
        console.log('✓ Snapshot Decks table created successfully.');
    } catch (error) {
        console.error('✗ Error creating snapshot decks table:', error);
        throw error;
    }
};

const createSnapshotDeckCardsTable = async () => {
    try {
        const queryText = `
CREATE TABLE IF NOT EXISTS snapshot_deck_cards (
    deck_id INT NOT NULL REFERENCES snapshot_decks(id) ON DELETE CASCADE,
    card_id BIGINT NOT NULL REFERENCES cards(id),
    quantity INT NOT NULL DEFAULT 1,
    deck_section TEXT NOT NULL,
    PRIMARY KEY (deck_id, card_id, deck_section),
    CHECK (quantity > 0 AND quantity <= 3),
    CHECK (deck_section IN ('main', 'extra', 'side'))
);`;
        await pool.query(queryText);
        console.log('✓ Snapshot Deck Cards table created successfully.');
    } catch (error) {
        console.error('✗ Error creating snapshot deck cards table:', error);
        throw error;
    }
};

// ============================================
// PLAYER DECK SELECTION TABLE
// ============================================

const createPlayerTournamentDecksTable = async () => {
    try {
        const queryText = `
CREATE TABLE IF NOT EXISTS player_tournament_decks (
    id SERIAL PRIMARY KEY,
    tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snapshot_deck_id INT NOT NULL REFERENCES snapshot_decks(id),
    selected_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (tournament_id, user_id)
);`;
        await pool.query(queryText);
        console.log('✓ Player Tournament Decks table created successfully.');
    } catch (error) {
        console.error('✗ Error creating player tournament decks table:', error);
        throw error;
    }
};

// ============================================
// INDEXES
// ============================================

const createIndexes = async () => {
    try {
        // Existing indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_match_participants_player_id ON match_participants(player_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_match_participants_match_id ON match_participants(match_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_tournament_series_organizer_id ON tournament_series(organizer_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_tournaments_series_id ON tournaments(series_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_tournaments_format_id ON tournaments(format_id);`);
        
        // New deck collection indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_deck_collections_user_id ON deck_collections(user_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_collection_decks_collection_id ON collection_decks(collection_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_collection_deck_cards_deck_id ON collection_deck_cards(deck_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_collection_deck_cards_card_id ON collection_deck_cards(card_id);`);
        
        // Snapshot indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_collection_snapshots_source_collection ON collection_snapshots(source_collection_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_collection_snapshots_parent ON collection_snapshots(parent_snapshot_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_collection_snapshots_series ON collection_snapshots(series_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_collection_snapshots_tournament ON collection_snapshots(tournament_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_snapshot_decks_snapshot_id ON snapshot_decks(snapshot_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_snapshot_decks_source_deck ON snapshot_decks(source_deck_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_snapshot_deck_cards_deck_id ON snapshot_deck_cards(deck_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_player_tournament_decks_tournament ON player_tournament_decks(tournament_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_player_tournament_decks_user ON player_tournament_decks(user_id);`);
        
        console.log('✓ All indexes created successfully.');
    } catch (error) {
        console.error('✗ Error creating indexes:', error);
        throw error;
    }
};

// ============================================
// DROP TABLES
// ============================================

const dropAllTables = async () => {
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
            DROP TABLE IF EXISTS match_participants CASCADE;
            DROP TABLE IF EXISTS matches CASCADE;
            DROP TABLE IF EXISTS tournaments CASCADE;
            DROP TABLE IF EXISTS tournament_series CASCADE;
            DROP TABLE IF EXISTS tournament_formats CASCADE;
            DROP TABLE IF EXISTS user_organizations CASCADE;
            DROP TABLE IF EXISTS organizers CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
            DROP TABLE IF EXISTS audit_logs CASCADE;
        `);
        console.log('✓ Dropped all tables successfully.');
    } catch (error) {
        console.error('✗ Error dropping tables:', error);
        throw error;
    }
};

// ============================================
// MAIN SETUP FUNCTION
// ============================================

const createAllTables = async () => {
    try {
        console.log('\n========================================');
        console.log('Starting Database Setup');
        console.log('========================================\n');
        
        await dropAllTables();
        
        console.log('\nCreating Core Tables...');
        await createUsersTable();
        await createOrganizerTable();
        await createUserOrganizationTable();
        await createTournamentSeriesTable();
        await createTournamentFormatsTable();
        await createTournamentsTable();
        await createMatchesTable();
        await createMatchParticipantsTable();
        await createAuditLogsTable();
        
        console.log('\nCreating Card & Deck Tables...');
        await createCardsTable();
        await createDeckCollectionsTable();
        await createCollectionDecksTable();
        await createCollectionDeckCardsTable();
        
        console.log('\nCreating Snapshot Tables...');
        await createCollectionSnapshotsTable();
        await createSnapshotDecksTable();
        await createSnapshotDeckCardsTable();
        await createPlayerTournamentDecksTable();
        
        console.log('\nCreating Indexes...');
        await createIndexes();
        
        console.log('\n========================================');
        console.log('✓ Database Setup Complete!');
        console.log('========================================\n');
    } catch (error) {
        console.error('\n========================================');
        console.error('✗ Error in Database Setup');
        console.error('========================================\n');
        console.error(error);
        throw error;
    } /*finally {
        await pool.end();
    }*/
};

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    createAllTables()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

export { createAllTables, dropAllTables };
