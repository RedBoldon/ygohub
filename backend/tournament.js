import { pool } from './db.js';
import crypto from 'crypto';

function generateInviteCode() {
    return crypto.randomBytes(6).toString('hex'); // 12 character code
}

export async function createTournament(userId, data) {
    const inviteCode = generateInviteCode();

    const result = await pool.query(
        `INSERT INTO tournaments 
     (name, min_player_count, max_player_count, format_id, series_id, location, starting_time, created_by, invite_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
        [
            data.name,
            data.minPlayerCount,
            data.maxPlayerCount,
            data.formatId,
            data.seriesId || null,
            data.location || null,
            data.startingTime,
            userId,
            inviteCode
        ]
    );

    return result.rows[0];
}

export async function joinTournament(inviteCode, userId) {
    // 1. Find tournament by invite code
    const tournamentResult = await pool.query(
        `SELECT id, max_player_count, player_count, starting_time 
     FROM tournaments 
     WHERE invite_code = $1`,
        [inviteCode]
    );

    const tournament = tournamentResult.rows[0];

    if (!tournament) {
        throw new Error('Invalid invite code');
    }

    // 2. Check if tournament already started
    if (new Date(tournament.starting_time) < new Date()) {
        throw new Error('Tournament has already started');
    }

    // 3. Check if tournament is full
    if (tournament.player_count >= tournament.max_player_count) {
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
        `SELECT u.id, u.username, u.tag, tp.joined_at
         FROM tournament_participants tp
         JOIN users u ON tp.user_id = u.id
         WHERE tp.tournament_id = $1
         ORDER BY tp.joined_at`,
        [tournamentId]
    );

    const isCreator = requestingUserId != null && requestingUserId === tournament.created_by;

    console.log('tournament row:', tournament);
    console.log('invite_code:', tournament.invite_code);
    console.log('isCreator:', isCreator);


    return {
        tournament: {
            id: tournament.id,
            name: tournament.name,
            minPlayerCount: tournament.min_player_count,
            maxPlayerCount: tournament.max_player_count,
            playerCount: tournament.player_count,
            format: tournament.format_name,
            location: tournament.location,
            startingTime: tournament.starting_time,
            createdAt: tournament.created_at,
            // Only include invite_code for creator
            ...(isCreator && { inviteCode: tournament.invite_code })
        },
        participants: participantsResult.rows,
        permissions: {
            isCreator,
            canEdit: isCreator,
            canViewInviteCode: isCreator
        }
    };
}