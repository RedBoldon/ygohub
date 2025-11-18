import { pool } from './db.js';

const testDatabase = async () => {
    try {
        console.log('--- Users ---');
        const users = await pool.query('SELECT * FROM users');
        console.table(users.rows);

        console.log('--- Organizers ---');
        const organizers = await pool.query('SELECT * FROM organizers');
        console.table(organizers.rows);

        console.log('--- Tournament Formats ---');
        const formats = await pool.query('SELECT * FROM tournament_formats');
        console.table(formats.rows);

        console.log('--- Tournament Series ---');
        const series = await pool.query('SELECT * FROM tournament_series');
        console.table(series.rows);

        console.log('--- Tournaments with Series and Organizers ---');
        const tournaments = await pool.query(`
            SELECT t.name AS tournament, s.name AS series, o.name AS organizer
            FROM tournaments t
            JOIN tournament_series s ON t.series_id = s.id
            JOIN organizers o ON s.organizer_id = o.id
        `);
        console.table(tournaments.rows);

        console.log('--- Matches ---');
        const matches = await pool.query(`
            SELECT m.id AS match_id, m.tournament_id, t.name AS tournament_name
            FROM matches m
            LEFT JOIN tournaments t ON m.tournament_id = t.id
        `);
        console.table(matches.rows);

        console.log('--- Match Participants ---');
        const participants = await pool.query(`
            SELECT mp.match_id, mp.sub_match_id, m.match_type, u.username, mp.team_id, mp.score
            FROM match_participants mp
            LEFT JOIN users u ON mp.player_id = u.id
            LEFT JOIN matches m ON mp.match_id = m.id
            ORDER BY mp.match_id, mp.sub_match_id, mp.team_id
        `);
        console.table(participants.rows);

    } catch (error) {
        console.error('Error testing database:', error);
    } finally {
        await pool.end();
        console.log('Database connection closed.');
    }
};

testDatabase();