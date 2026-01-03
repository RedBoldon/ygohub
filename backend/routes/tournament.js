import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { createTournamentSchema } from '../validation/tournament.js';
import { createTournament, joinTournament, getTournamentById, assignDeckToPlayer } from '../tournament.js';
import { selectPlayerDeck } from '../snapshot.js';
import { startTournament, advanceRound, getTournamentData, calculateStandings } from '../swiss.js';
import { pool } from '../db.js';

const router = Router();

// ------------------------------------------------------------------
// TOURNAMENT SERIES
// ------------------------------------------------------------------

/**
 * GET /tournaments/series
 * Get all series for the user
 */
router.get('/series', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, created_at
             FROM tournament_series
             WHERE created_by = $1
             ORDER BY name ASC`,
            [req.user.userId]
        );
        res.json({ series: result.rows });
    } catch (err) {
        console.error('Get series error:', err);
        res.status(500).json({ error: 'Failed to get series' });
    }
});

/**
 * POST /tournaments/series
 * Create a new series
 */
router.post('/series', authMiddleware, async (req, res) => {
    const { name } = req.body;

    if (!name || name.trim().length < 2 || name.trim().length > 100) {
        return res.status(400).json({ error: 'Series name must be between 2 and 100 characters' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO tournament_series (name, created_by)
             VALUES ($1, $2)
             RETURNING *`,
            [name.trim(), req.user.userId]
        );
        res.status(201).json({ series: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'A series with this name already exists' });
        }
        console.error('Create series error:', err);
        res.status(500).json({ error: 'Failed to create series' });
    }
});

// ------------------------------------------------------------------
// TOURNAMENTS LIST
// ------------------------------------------------------------------

/**
 * GET /tournaments
 * Get all tournaments where user is creator or participant
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT DISTINCT t.id, t.name, t.status, t.player_count, t.max_player_count,
                    t.location, t.created_at, t.current_round, t.number_of_rounds,
                    ts.name as series_name,
                    CASE WHEN t.created_by = $1 THEN true ELSE false END as is_creator
             FROM tournaments t
             LEFT JOIN tournament_series ts ON t.series_id = ts.id
             LEFT JOIN tournament_participants tp ON t.id = tp.tournament_id
             WHERE t.created_by = $1 OR tp.user_id = $1
             ORDER BY t.created_at DESC`,
            [req.user.userId]
        );
        res.json({ tournaments: result.rows });
    } catch (err) {
        console.error('Get tournaments error:', err);
        res.status(500).json({ error: 'Failed to get tournaments' });
    }
});

/**
 * POST /tournaments
 * Create a new tournament
 */
router.post('/', authMiddleware, async (req, res) => {
    const result = createTournamentSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: result.error.flatten().fieldErrors
        });
    }

    try {
        const tournament = await createTournament(req.user.userId, result.data);
        res.status(201).json({ tournament });
    } catch (err) {
        console.error('Create tournament error:', err);
        res.status(500).json({ error: 'Failed to create tournament' });
    }
});

router.post('/join/:inviteCode', authMiddleware, async (req, res) => {
    try {
        const result = await joinTournament(req.params.inviteCode, req.user.userId);
        res.json({ message: 'Joined tournament', tournamentId: result.tournamentId });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Already joined this tournament' });
        }
        if (err.message === 'Invalid invite code') {
            return res.status(404).json({ error: err.message });
        }
        if (err.message === 'Tournament has already started' || err.message === 'Tournament is full') {
            return res.status(400).json({ error: err.message });
        }
        console.error('Join tournament error:', err);
        res.status(500).json({ error: 'Failed to join tournament' });
    }
});

router.get('/:id', optionalAuthMiddleware, async (req, res) => {
    const tournamentId = parseInt(req.params.id);

    if (isNaN(tournamentId)) {
        return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    try {
        const result = await getTournamentById(tournamentId, req.user?.userId);

        if (!result) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        res.json(result);
    } catch (err) {
        console.error('Get tournament error:', err);
        res.status(500).json({ error: 'Failed to get tournament' });
    }
});

// Turnier starten (erste Runde generieren)
router.post('/:id/start', authMiddleware, async (req, res) => {
    const tournamentId = parseInt(req.params.id);

    if (isNaN(tournamentId)) {
        return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    try {
        // Prüfen ob User der Creator ist
        const tournament = await pool.query(
            'SELECT created_by FROM tournaments WHERE id = $1',
            [tournamentId]
        );

        if (tournament.rows.length === 0) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        if (tournament.rows[0].created_by !== req.user.userId) {
            return res.status(403).json({ error: 'Only the creator can start the tournament' });
        }

        const result = await startTournament(tournamentId);
        res.json({ message: 'Tournament started', round: 1, pairings: result.pairings });
    } catch (err) {
        if (err.message === 'Tournament is not open' ||
            err.message === 'Not enough players') {
            return res.status(400).json({ error: err.message });
        }
        console.error('Start tournament error:', err);
        res.status(500).json({ error: 'Failed to start tournament' });
    }
});

// Nächste Runde starten
router.post('/:id/advance', authMiddleware, async (req, res) => {
    const tournamentId = parseInt(req.params.id);

    if (isNaN(tournamentId)) {
        return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    try {
        const tournament = await pool.query(
            'SELECT created_by FROM tournaments WHERE id = $1',
            [tournamentId]
        );

        if (tournament.rows.length === 0) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        if (tournament.rows[0].created_by !== req.user.userId) {
            return res.status(403).json({ error: 'Only the creator can advance rounds' });
        }

        const result = await advanceRound(tournamentId);

        if (result.completed) {
            return res.json({ message: 'Tournament completed', completed: true });
        }

        res.json({
            message: 'Round advanced',
            round: result.roundNumber,
            pairings: result.pairings
        });
    } catch (err) {
        if (err.message === 'Tournament is not in progress' ||
            err.message === 'Not all matches are completed') {
            return res.status(400).json({ error: err.message });
        }
        console.error('Advance round error:', err);
        res.status(500).json({ error: 'Failed to advance round' });
    }
});

// Standings abrufen
router.get('/:id/standings', optionalAuthMiddleware, async (req, res) => {
    const tournamentId = parseInt(req.params.id);

    if (isNaN(tournamentId)) {
        return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    try {
        const data = await getTournamentData(tournamentId);

        if (!data) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        const standings = calculateStandings(data.participants, data.matches);

        res.json({
            tournament: data.tournament,
            standings: standings.map((s, index) => ({
                rank: index + 1,
                username: s.username,
                tag: s.tag,
                matchWins: s.matchWins,
                matchLosses: s.matchLosses,
                omw: Math.round(s.omw * 100) / 100,
                gw: Math.round(s.gw * 100) / 100
            }))
        });
    } catch (err) {
        console.error('Get standings error:', err);
        res.status(500).json({ error: 'Failed to get standings' });
    }
});

// Match-Ergebnis eintragen
router.post('/matches/:matchId/result', authMiddleware, async (req, res) => {
    const matchId = parseInt(req.params.matchId);
    const { team1Score, team2Score } = req.body;

    if (isNaN(matchId)) {
        return res.status(400).json({ error: 'Invalid match ID' });
    }

    if (typeof team1Score !== 'number' || typeof team2Score !== 'number') {
        return res.status(400).json({ error: 'Scores must be numbers' });
    }

    if (team1Score === team2Score) {
        return res.status(400).json({ error: 'Match cannot end in a draw' });
    }

    try {
        // Match und Turnier-Creator prüfen
        const matchResult = await pool.query(
            `SELECT m.id, m.status, m.is_bye, t.created_by 
             FROM matches m
             JOIN tournaments t ON m.tournament_id = t.id
             WHERE m.id = $1`,
            [matchId]
        );

        if (matchResult.rows.length === 0) {
            return res.status(404).json({ error: 'Match not found' });
        }

        const match = matchResult.rows[0];

        if (match.created_by !== req.user.userId) {
            return res.status(403).json({ error: 'Only the tournament creator can report results' });
        }

        if (match.status === 'completed') {
            return res.status(400).json({ error: 'Match already completed' });
        }

        if (match.is_bye) {
            return res.status(400).json({ error: 'Cannot report result for a bye' });
        }

        const winnerTeamId = team1Score > team2Score ? 1 : 2;

        // Match updaten
        await pool.query(
            `UPDATE matches 
             SET team_1_score = $1, team_2_score = $2, winner_team_id = $3, 
                 status = 'completed', completed_at = NOW()
             WHERE id = $4`,
            [team1Score, team2Score, winnerTeamId, matchId]
        );

        // Spieler-Scores updaten
        await pool.query(
            `UPDATE match_participants SET score = $1 WHERE match_id = $2 AND team_id = 1`,
            [team1Score, matchId]
        );
        await pool.query(
            `UPDATE match_participants SET score = $1 WHERE match_id = $2 AND team_id = 2`,
            [team2Score, matchId]
        );

        res.json({ message: 'Result recorded', winnerTeamId });
    } catch (err) {
        console.error('Report result error:', err);
        res.status(500).json({ error: 'Failed to report result' });
    }
});

// ------------------------------------------------------------------
// DECK ASSIGNMENT
// ------------------------------------------------------------------

/**
 * POST /tournaments/:id/assign-deck
 * Assign a deck to a player (organizer mode only)
 */
router.post('/:id/assign-deck', authMiddleware, async (req, res) => {
    const tournamentId = parseInt(req.params.id);
    const { playerId, deckId } = req.body;

    if (isNaN(tournamentId)) {
        return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    if (!playerId) {
        return res.status(400).json({ error: 'Player ID is required' });
    }

    try {
        const result = await assignDeckToPlayer(tournamentId, req.user.userId, playerId, deckId);
        res.json({ message: 'Deck assigned', participant: result });
    } catch (err) {
        if (err.message === 'Tournament not found') {
            return res.status(404).json({ error: err.message });
        }
        if (err.message === 'Only the creator can assign decks' ||
            err.message === 'Deck assignment is only available in organizer mode' ||
            err.message === 'Deck not found in tournament collection' ||
            err.message === 'Player not found in tournament') {
            return res.status(400).json({ error: err.message });
        }
        console.error('Assign deck error:', err);
        res.status(500).json({ error: 'Failed to assign deck' });
    }
});

// ------------------------------------------------------------------
// PLAYER DECK SELECTION (Player Mode)
// ------------------------------------------------------------------

/**
 * GET /tournaments/:id/my-decks
 * Get player's available decks for selection (Player Mode)
 */
router.get('/:id/my-decks', authMiddleware, async (req, res) => {
    const tournamentId = parseInt(req.params.id);

    if (isNaN(tournamentId)) {
        return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    try {
        // Verify tournament exists and is player mode
        const tournament = await pool.query(
            `SELECT deck_mode, status FROM tournaments WHERE id = $1`,
            [tournamentId]
        );

        if (tournament.rows.length === 0) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        if (tournament.rows[0].deck_mode !== 'player') {
            return res.status(400).json({ error: 'This tournament uses organizer-provided decks' });
        }

        // Get player's decks from their collections
        const decks = await pool.query(
            `SELECT cd.id, cd.deck_name, cd.archetype, cd.description, dc.name as collection_name,
                    (SELECT COUNT(*) FROM collection_deck_cards cdc WHERE cdc.deck_id = cd.id) as card_count
             FROM collection_decks cd
             JOIN deck_collections dc ON cd.collection_id = dc.id
             WHERE dc.user_id = $1
             ORDER BY dc.name, cd.deck_name`,
            [req.user.userId]
        );

        // Check if player already selected a deck
        const selected = await pool.query(
            `SELECT tp.assigned_deck_id as deck_id, cd.deck_name
             FROM tournament_participants tp
             LEFT JOIN collection_decks cd ON tp.assigned_deck_id = cd.id
             WHERE tp.tournament_id = $1 AND tp.user_id = $2`,
            [tournamentId, req.user.userId]
        );

        const selectedDeck = selected.rows[0]?.deck_id 
            ? { deck_id: selected.rows[0].deck_id, deck_name: selected.rows[0].deck_name }
            : null;

        res.json({
            decks: decks.rows,
            selectedDeck,
            canChange: tournament.rows[0].status === 'open'
        });
    } catch (err) {
        console.error('Get my decks error:', err);
        res.status(500).json({ error: 'Failed to get decks' });
    }
});

/**
 * POST /tournaments/:id/select-deck
 * Player selects their deck for the tournament (Player Mode)
 */
router.post('/:id/select-deck', authMiddleware, async (req, res) => {
    const tournamentId = parseInt(req.params.id);
    const { deckId } = req.body;

    if (isNaN(tournamentId)) {
        return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    if (!deckId) {
        return res.status(400).json({ error: 'Deck ID is required' });
    }

    try {
        // Verify tournament
        const tournament = await pool.query(
            `SELECT deck_mode, status FROM tournaments WHERE id = $1`,
            [tournamentId]
        );

        if (tournament.rows.length === 0) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        const t = tournament.rows[0];

        if (t.deck_mode !== 'player') {
            return res.status(400).json({ error: 'This tournament uses organizer-provided decks' });
        }

        if (t.status !== 'open') {
            return res.status(400).json({ error: 'Cannot change deck after tournament started' });
        }

        // Select deck (stores reference, snapshot created at tournament start)
        const result = await selectPlayerDeck(tournamentId, req.user.userId, deckId);

        res.json({ 
            message: 'Deck selected', 
            deckId: result.deckId,
            deckName: result.deckName
        });
    } catch (err) {
        if (err.message === 'Deck not found' || 
            err.message === 'Deck does not belong to user' ||
            err.message === 'Not a participant in this tournament') {
            return res.status(400).json({ error: err.message });
        }
        console.error('Select deck error:', err);
        res.status(500).json({ error: 'Failed to select deck' });
    }
});

export default router;
