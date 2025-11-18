import { pool } from './db.js';

const seedUsers = async () => {
    try {
        await pool.query(`TRUNCATE TABLE users RESTART IDENTITY CASCADE;`);
        await pool.query(`
            INSERT INTO users (username, tag, email, password_hash, role)
            VALUES
                ('Alice', '001', 'alice@example.com', 'hashed_pw_1', 'user'),
                ('Bob', '002', 'bob@example.com', 'hashed_pw_2', 'user'),
                ('Charlie', '003', 'charlie@example.com', 'hashed_pw_3', 'admin'),
                ('Dave', '004', 'dave@example.com', 'hashed_pw_4', 'user'),
                ('Eve', '005', 'eve@example.com', 'hashed_pw_5', 'user'),
                ('Frank', '006', 'frank@example.com', 'hashed_pw_6', 'user');
        `);
        console.log('Users seeded successfully.');
    } catch (error) {
        console.error('Error seeding users:', error);
    }
};

const seedOrganizers = async () => {
    try {
        await pool.query(`
            INSERT INTO organizers (type, user_id, name)
            VALUES
                ('user', 1, 'Alice'),
                ('organization', NULL, 'Swiss Tournament Club');
        `);
        console.log('Organizers seeded successfully.');
    } catch (error) {
        console.error('Error seeding organizers:', error);
    }
};

const seedTournamentFormats = async () => {
    try {
        await pool.query(`
            INSERT INTO tournament_formats (name, has_topcut, description)
            VALUES
                ('Swiss', TRUE, 'Swiss rounds with top cut'),
                ('Single Elimination', FALSE, 'Classic single elimination format');
        `);
        console.log('Tournament formats seeded successfully.');
    } catch (error) {
        console.error('Error seeding tournament formats:', error);
    }
};

const seedTournamentSeries = async () => {
    try {
        await pool.query(`
            INSERT INTO tournament_series (name, organizer_id, country_codes)
            VALUES
                ('Weekly Cup', 2, '{"CH"}'),
                ('Monthly Open', 2, '{"CH"}');
        `);
        console.log('Tournament series seeded successfully.');
    } catch (error) {
        console.error('Error seeding tournament series:', error);
    }
};

const seedTournaments = async () => {
    try {
        await pool.query(`
            INSERT INTO tournaments (name, series_id, format_id, min_player_count, max_player_count, player_count, location, starting_time)
            VALUES
                ('Weekly Cup #1', 1, 1, 2, NULL, 0, 'Zurich', '2025-11-25 18:00:00'),
                ('Monthly Open #1', 2, 2, 2, 64, 5, 'Bern', '2025-11-26 18:00:00');
        `);
        console.log('Tournaments seeded successfully.');
    } catch (error) {
        console.error('Error seeding tournaments:', error);
    }
};

const seedMatches = async () => {
    try {
        await pool.query(`
            INSERT INTO matches (
                tournament_id,
                match_type,
                team_1_score,
                team_2_score,
                winner_team_id,
                status,
                completed_at
            )
            VALUES
                (1, 'swiss', 2, 1, NULL, 'completed', '2025-11-25 19:00:00'),
                (1, 'swiss', 0, 2, NULL, 'completed', '2025-11-25 19:15:00'),
                (2, 'elimination', 1, 1, NULL, 'pending', NULL),
                (1, '2v2', 3, 2, NULL, 'completed', '2025-11-25 20:00:00'),
                (1, '3x1v1', 2, 1, NULL, 'completed', '2025-11-25 21:00:00'),
                (1, '2x1v1', NULL, NULL, NULL, 'pending', NULL),
                (1, '2x1v1', NULL, NULL, NULL, 'pending', NULL);
        `);
        console.log('Matches seeded successfully.');
    } catch (error) {
        console.error('Error seeding matches:', error);
    }
};

const seedMatchParticipants = async () => {
    try {
        await pool.query(`
            INSERT INTO match_participants (
                match_id,
                player_id,
                team_id,
                sub_match_id,
                score,
                completed_at
            )
            VALUES
                (1, 1, 1, NULL, 2, '2025-11-25 19:00:00'),
                (1, 2, 2, NULL, 1, '2025-11-25 19:00:00'),
                (2, 2, 1, NULL, 0, '2025-11-25 19:15:00'),
                (2, 3, 2, NULL, 2, '2025-11-25 19:15:00'),
                (3, 1, 1, NULL, NULL, NULL),
                (3, 3, 2, NULL, NULL, NULL),

                -- 2v2 match participants (match_id 4)
                (4, 1, 1, NULL, 3, '2025-11-25 20:00:00'),
                (4, 2, 1, NULL, 3, '2025-11-25 20:00:00'),
                (4, 3, 2, NULL, 2, '2025-11-25 20:00:00'),
                (4, 4, 2, NULL, 2, '2025-11-25 20:00:00'),

                -- 3x1v1 match participants (match_id 5)
                (5, 1, 1, 1, 1, '2025-11-25 21:00:00'),
                (5, 4, 2, 1, 0, '2025-11-25 21:00:00'),
                (5, 2, 1, 2, 1, '2025-11-25 21:00:00'),
                (5, 5, 2, 2, 0, '2025-11-25 21:00:00'),
                (5, 3, 1, 3, 0, '2025-11-25 21:00:00'),
                (5, 6, 2, 3, 1, '2025-11-25 21:00:00'),

                -- 2x1v1 match participants for first 1v1 (match_id 6)
                (6, 1, 1, NULL, NULL, NULL),
                (6, 3, 2, NULL, NULL, NULL),

                -- 2x1v1 match participants for second 1v1 (match_id 7)
                (7, 2, 1, NULL, NULL, NULL),
                (7, 4, 2, NULL, NULL, NULL);
        `);
        console.log('Match participants seeded successfully.');
    } catch (error) {
        console.error('Error seeding match participants:', error);
    }
};

const seedAll = async () => {
    await seedUsers();
    await seedOrganizers();
    await seedTournamentFormats();
    await seedTournamentSeries();
    await seedTournaments();
    await seedMatches();
    await seedMatchParticipants();
    await pool.end();
    console.log('Seeding complete and database connection closed.');
};

seedAll();