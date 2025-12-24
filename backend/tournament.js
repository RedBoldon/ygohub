import { pool } from './db.js';
import crypto from 'crypto';

function generateInviteCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 character code
}

export async function createTournament(userId, data) {
    const inviteCode = generateInviteCode();

    const result = await pool.query(
        `INSERT INTO tournaments 
         (name, min_player_count, max_player_count, format_id, series_id, location, starting_time, created_by, invite_code, number_of_rounds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
            data.name,
            data.minPlayerCount || 2,
            data.maxPlayerCount || null,
            data.formatId || null,
            data.seriesId || null,
            data.location || null,
            data.startingTime || null,
            userId,
            inviteCode,
            data.numberOfRounds || null
        ]
    );

    const row = result.rows[0];
    
    return {
        id: row.id,
        name: row.name,
        min_player_count: row.min_player_count,
        max_player_count: row.max_player_count,
        player_count: row.player_count,
        location: row.location,
        starting_time: row.starting_time,
        created_at: row.created_at,
        invite_code: row.invite_code,
        status: row.status,
        number_of_rounds: row.number_of_rounds
    };
}

export async function joinTournament(inviteCode, userId) {
    // 1. Find tournament by invite code
    const tournamentResult = await pool.query(
        `SELECT id, max_player_count, player_count, status 
         FROM tournaments 
         WHERE invite_code = $1`,
        [inviteCode]
    );

    const tournament = tournamentResult.rows[0];

    if (!tournament) {
        throw new Error('Invalid invite code');
    }

    // 2. Check if tournament already started
    if (tournament.status !== 'open') {
        throw new Error('Tournament has already started');
    }

    // 3. Check if tournament is full
    if (tournament.max_player_count && tournament.player_count >= tournament.max_player_count) {
        throw new Error('Tournament is full');
    }

    // 4. Add participant and increment player count
    await pool.query(
        `INSERT INTO tournament_participants (tournament_id, user_id)
         VALUES ($1, $2)`,
        [tournament.id, userId]
    );

    await pool.query(
        `UPDATE tournaments 
         SET player_count = player_count + 1 
         WHERE id = $1`,
        [tournament.id]
    );

    return { tournamentId: tournament.id };
}

export async function getTournamentById(tournamentId, requestingUserId = null) {
    // Get tournament with format name
    const tournamentResult = await pool.query(
        `SELECT t.*, tf.name as format_name
         FROM tournaments t
         LEFT JOIN tournament_formats tf ON t.format_id = tf.id
         WHERE t.id = $1`,
        [tournamentId]
    );

    const tournament = tournamentResult.rows[0];
    if (!tournament) return null;

    // Get participants with usernames
    const participantsResult = await pool.query(
        `SELECT u.id as user_id, u.username, u.tag, tp.joined_at
         FROM tournament_participants tp
         JOIN users u ON tp.user_id = u.id
         WHERE tp.tournament_id = $1
         ORDER BY tp.joined_at`,
        [tournamentId]
    );

    // Get rounds with matches
    const roundsResult = await pool.query(
        `SELECT id, round_number, status, started_at, completed_at
         FROM tournament_rounds
         WHERE tournament_id = $1
         ORDER BY round_number`,
        [tournamentId]
    );

    const rounds = [];
    for (const round of roundsResult.rows) {
        const matchesResult = await pool.query(
            `SELECT m.id, m.team_1_score, m.team_2_score, m.winner_team_id, m.status, m.is_bye
             FROM matches m
             WHERE m.round_id = $1
             ORDER BY m.id`,
            [round.id]
        );

        const matches = [];
        for (const match of matchesResult.rows) {
            const participantsRes = await pool.query(
                `SELECT mp.team_id, mp.player_id, u.username, u.tag
                 FROM match_participants mp
                 JOIN users u ON mp.player_id = u.id
                 WHERE mp.match_id = $1`,
                [match.id]
            );

            const team1 = participantsRes.rows.filter(p => p.team_id === 1);
            const team2 = participantsRes.rows.filter(p => p.team_id === 2);

            matches.push({
                id: match.id,
                team_1_score: match.team_1_score,
                team_2_score: match.team_2_score,
                winner_team_id: match.winner_team_id,
                status: match.status,
                is_bye: match.is_bye,
                team1,
                team2
            });
        }

        rounds.push({
            id: round.id,
            round_number: round.round_number,
            status: round.status,
            started_at: round.started_at,
            completed_at: round.completed_at,
            matches
        });
    }

    const isCreator = requestingUserId != null && requestingUserId === tournament.created_by;
    const isParticipant = participantsResult.rows.some(p => p.user_id === requestingUserId);

    return {
        tournament: {
            id: tournament.id,
            name: tournament.name,
            min_player_count: tournament.min_player_count,
            max_player_count: tournament.max_player_count,
            player_count: tournament.player_count,
            format: tournament.format_name,
            location: tournament.location,
            starting_time: tournament.starting_time,
            created_at: tournament.created_at,
            status: tournament.status,
            current_round: tournament.current_round,
            number_of_rounds: tournament.number_of_rounds,
            invite_code: isCreator ? tournament.invite_code : undefined
        },
        participants: participantsResult.rows,
        rounds,
        isCreator,
        isParticipant
    };
}
