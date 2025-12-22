import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { createTournamentSchema } from '../validation/tournament.js';
import { createTournament, joinTournament, getTournamentById } from '../tournament.js';
import { startTournament, advanceRound, getTournamentData, calculateStandings } from '../swiss.js';

const router = Router();

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
            return res.json({ message: 'Tournament completed' });
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


export default router;

