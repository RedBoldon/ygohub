import { pool } from './db.js';

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
        console.log('Tournaments table created successfully.');
    } catch (error) {
        console.error('Error creating tournaments table:', error);
    }
};

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
        console.log('Users table created successfully.');
    } catch (error) {
        console.error('Error creating users table:', error);
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
        console.log('Matches table created successfully.');
    } catch (error) {
        console.error('Error creating matches table:', error);
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
        console.log('match_participants table created successfully.');
    } catch (error) {
        console.error('Error creating match_participants table:', error);
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
        console.log('Organizer table created successfully.');
    } catch (error) {
        console.error('Error creating organizer table:', error);
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
        console.log('User Organization table created successfully.');
    } catch (error) {
        console.error('Error creating user organization table:', error);
    }
}

const createTournamentSeriesTable = async () => {
    try {
        const queryText = `CREATE TABLE IF NOT EXISTS tournament_series
        (
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
        console.log('Tournament Series table created successfully.');
    } catch (error) {
        console.error('Error creating tournament series table:', error);
    }
};

const createTournamentFormatsTable = async () => {
    try {
        const queryText = `
CREATE TABLE IF NOT EXISTS tournament_formats (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    has_topcut BOOLEAN DEFAULT FALSE,
    description TEXT,
    CHECK (LENGTH(name) >= 2 AND LENGTH(name) <= 100)
);`;
        await pool.query(queryText);
        console.log('Tournament Formats table created successfully.');
    } catch (error) {
        console.error('Error creating tournament formats table:', error);
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
    CHECK (entity_type IN ('tournament', 'match', 'user', 'organizer', 'series', 'format')),
    CHECK (action IN ('create', 'update', 'delete', 'restore')),
    CHECK (entity_id > 0)
);`;
        await pool.query(queryText);
        console.log('Audit logs table created successfully.');
    } catch (error) {
        console.error('Error creating audit logs table:', error);
    }
};

const dropAllTables = async () => {
    try{
        await pool.query(`
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
        console.log('Dropped all tables.');
    } catch (error) {
        console.error('Error dropping tables:', error);
    }
};


const createIndexes = async () => {
    try {
        // Index on match_participants.player_id
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_match_participants_player_id ON match_participants(player_id);`);
        // Index on match_participants.match_id
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_match_participants_match_id ON match_participants(match_id);`);
        // Index on matches.tournament_id
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id);`);
        // Index on tournament_series.organizer_id
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_tournament_series_organizer_id ON tournament_series(organizer_id);`);
        // Index on tournaments.series_id
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_tournaments_series_id ON tournaments(series_id);`);
        // Index on tournaments.format_id
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_tournaments_format_id ON tournaments(format_id);`);
        console.log('Indexes created successfully.');
    } catch (error) {
        console.error('Error creating indexes:', error);
    }
};

const createAllTables = async () => {
    try {
        await dropAllTables();
        await createUsersTable();
        await createOrganizerTable();
        await createUserOrganizationTable();
        await createTournamentSeriesTable();
        await createTournamentFormatsTable();
        await createTournamentsTable();
        await createMatchesTable();
        await createMatchParticipantsTable();
        await createAuditLogsTable();
        await createIndexes();
    } catch (error) {
        console.error('Error creating tables:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

createAllTables()
    .then(() => console.log("Tables created successfully."))
    .catch(e => console.log("Error in the creation of Tables", e));
