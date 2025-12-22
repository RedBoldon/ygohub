import { pool } from './db.js';

/**
 * Berechnet die Anzahl Runden für ein Swiss-Turnier
 * @param {number} playerCount
 * @returns {number}
 */
export function calculateRoundCount(playerCount) {
    if (playerCount < 2) return 0;
    return Math.ceil(Math.log2(playerCount));
}

/**
 * Holt alle Daten die für Standings und Pairings benötigt werden
 * in nur 2 Queries
 */
export async function getTournamentData(tournamentId) {
    // Query 1: Turnier + Teilnehmer
    const tournamentResult = await pool.query(
        `SELECT t.id, t.number_of_rounds, t.current_round, t.status,
                COUNT(tp.user_id) as player_count
         FROM tournaments t
                  LEFT JOIN tournament_participants tp ON t.id = tp.tournament_id
         WHERE t.id = $1
         GROUP BY t.id`,
        [tournamentId]
    );

    if (tournamentResult.rows.length === 0) return null;

    const tournament = tournamentResult.rows[0];

    // Rundenanzahl: explizit gesetzt oder automatisch berechnen
    const totalRounds = tournament.number_of_rounds ??
        calculateRoundCount(parseInt(tournament.player_count));

    // Query 2: Alle Teilnehmer
    const participantsResult = await pool.query(
        `SELECT tp.user_id, u.username, u.tag
         FROM tournament_participants tp
         JOIN users u ON tp.user_id = u.id
         WHERE tp.tournament_id = $1`,
        [tournamentId]
    );

    // Query 3: Alle abgeschlossenen Matches mit Teilnehmern
    const matchesResult = await pool.query(
        `SELECT
             m.id as match_id,
             m.round_id,
             m.winner_team_id,
             m.is_bye,
             m.team_1_score,
             m.team_2_score,
             mp.player_id,
             mp.team_id,
             mp.score as games_won
         FROM matches m
                  JOIN match_participants mp ON m.id = mp.match_id
         WHERE m.tournament_id = $1 AND m.status = 'completed'`,
        [tournamentId]
    );

    return {
        tournament: {
            id: tournament.id,
            status: tournament.status,
            currentRound: tournament.current_round,
            totalRounds,
            playerCount: parseInt(tournament.player_count)
        },
        participants: participantsResult.rows,
        matches: matchesResult.rows
    };
}

/**
 * Berechnet die Standings für alle Spieler
 */
export function calculateStandings(participants, matches) {
    // Initialisiere Spieler-Stats
    const playerStats = new Map();

    for (const p of participants) {
        playerStats.set(p.user_id, {
            userId: p.user_id,
            username: p.username,
            tag: p.tag,
            matchWins: 0,
            matchLosses: 0,
            gameWins: 0,
            gameLosses: 0,
            opponents: []
        });
    }

    // Gruppiere Match-Teilnehmer nach Match
    const matchGroups = new Map();
    for (const row of matches) {
        if (!matchGroups.has(row.match_id)) {
            matchGroups.set(row.match_id, {
                winner_team_id: row.winner_team_id,
                is_bye: row.is_bye,
                players: []
            });
        }
        matchGroups.get(row.match_id).players.push(row);
    }

    // Verarbeite jedes Match
    for (const [matchId, match] of matchGroups) {
        if (match.is_bye) {
            // Bye: Spieler bekommt Win, keine Gegner
            const player = match.players[0];
            const stats = playerStats.get(player.player_id);
            if (stats) {
                stats.matchWins += 1;
                stats.gameWins += 2;  // Bye zählt als 2-0
            }
            continue;
        }

        // Normales Match: 2 Spieler
        const team1Player = match.players.find(p => p.team_id === 1);
        const team2Player = match.players.find(p => p.team_id === 2);

        if (!team1Player || !team2Player) continue;

        const stats1 = playerStats.get(team1Player.player_id);
        const stats2 = playerStats.get(team2Player.player_id);

        if (!stats1 || !stats2) continue;

        // Gegner tracken
        stats1.opponents.push(team2Player.player_id);
        stats2.opponents.push(team1Player.player_id);

        // Game Wins/Losses
        stats1.gameWins += team1Player.games_won || 0;
        stats1.gameLosses += team2Player.games_won || 0;
        stats2.gameWins += team2Player.games_won || 0;
        stats2.gameLosses += team1Player.games_won || 0;

        // Match Win/Loss
        if (match.winner_team_id === 1) {
            stats1.matchWins += 1;
            stats2.matchLosses += 1;
        } else if (match.winner_team_id === 2) {
            stats2.matchWins += 1;
            stats1.matchLosses += 1;
        }
    }

    // Berechne Tiebreakers
    const standings = [];
    for (const [userId, stats] of playerStats) {
        // Opponent Match Win % (minimum 33%)
        let omw = 0.33;
        if (stats.opponents.length > 0) {
            const oppWinRates = stats.opponents.map(oppId => {
                const opp = playerStats.get(oppId);
                if (!opp) return 0.33;
                const total = opp.matchWins + opp.matchLosses;
                if (total === 0) return 0.33;
                return Math.max(0.33, opp.matchWins / total);
            });
            omw = oppWinRates.reduce((a, b) => a + b, 0) / oppWinRates.length;
        }

        // Game Win %
        const totalGames = stats.gameWins + stats.gameLosses;
        const gw = totalGames > 0 ? stats.gameWins / totalGames : 0;

        // Opponent's Opponent Match Win % (minimum 33%)
        let oomw = 0.33;
        if (stats.opponents.length > 0) {
            const oppOmws = stats.opponents.map(oppId => {
                const opp = playerStats.get(oppId);
                if (!opp || opp.opponents.length === 0) return 0.33;

                // Berechne OMW des Gegners
                const oppOppWinRates = opp.opponents.map(oppOppId => {
                    const oppOpp = playerStats.get(oppOppId);
                    if (!oppOpp) return 0.33;
                    const total = oppOpp.matchWins + oppOpp.matchLosses;
                    if (total === 0) return 0.33;
                    return Math.max(0.33, oppOpp.matchWins / total);
                });
                return oppOppWinRates.reduce((a, b) => a + b, 0) / oppOppWinRates.length;
            });
            oomw = oppOmws.reduce((a, b) => a + b, 0) / oppOmws.length;
        }

        standings.push({
            userId,
            username: stats.username,
            tag: stats.tag,
            matchWins: stats.matchWins,
            matchLosses: stats.matchLosses,
            gameWins: stats.gameWins,
            gameLosses: stats.gameLosses,
            omw,
            gw,
            oomw,
            opponents: stats.opponents
        });
    }

// Sortieren: Wins DESC, OMW DESC, OOMW DESC
    standings.sort((a, b) => {
        if (b.matchWins !== a.matchWins) return b.matchWins - a.matchWins;
        if (b.omw !== a.omw) return b.omw - a.omw;
        return b.oomw - a.oomw;
    });

    return standings;
}

/**
 * Generiert Pairings für die nächste Runde
 */
export function generatePairings(standings) {
    const pairings = [];
    const unpaired = [...standings];

    while (unpaired.length > 1) {
        const player1 = unpaired.shift();

        // Finde besten legalen Gegner (noch nicht gespielt)
        let paired = false;
        for (let i = 0; i < unpaired.length; i++) {
            const player2 = unpaired[i];

            // Check ob schon gespielt
            if (!player1.opponents.includes(player2.userId)) {
                pairings.push({
                    player1: player1.userId,
                    player2: player2.userId,
                    isBye: false
                });
                unpaired.splice(i, 1);
                paired = true;
                break;
            }
        }

        // Falls kein legaler Gegner: paare mit nächstem (Rematch als Fallback)
        if (!paired && unpaired.length > 0) {
            const player2 = unpaired.shift();
            pairings.push({
                player1: player1.userId,
                player2: player2.userId,
                isBye: false
            });
        }
    }

    // Übrig gebliebener Spieler bekommt Bye
    if (unpaired.length === 1) {
        pairings.push({
            player1: unpaired[0].userId,
            player2: null,
            isBye: true
        });
    }

    return pairings;
}

export async function startTournament(tournamentId) {
    const data = await getTournamentData(tournamentId);

    if (!data) throw new Error('Tournament not found');
    if (data.tournament.status !== 'open') throw new Error('Tournament is not open');
    if (data.tournament.playerCount < 2) throw new Error('Not enough players');

    // Turnier starten
    await pool.query(
        `UPDATE tournaments 
         SET status = 'in_progress', current_round = 1 
         WHERE id = $1`,
        [tournamentId]
    );

    // Erste Runde erstellen
    const roundResult = await pool.query(
        `INSERT INTO tournament_rounds (tournament_id, round_number, status, started_at)
         VALUES ($1, 1, 'in_progress', NOW())
         RETURNING id`,
        [tournamentId]
    );
    const roundId = roundResult.rows[0].id;

    // Für Runde 1: Zufällige Pairings
    const shuffled = [...data.participants].sort(() => Math.random() - 0.5);
    const standings = shuffled.map(p => ({
        userId: p.user_id,
        opponents: []
    }));

    const pairings = generatePairings(standings);
    await createMatches(tournamentId, roundId, pairings);

    return { roundId, pairings };
}

/**
 * Erstellt Matches für eine Runde
 */
async function createMatches(tournamentId, roundId, pairings) {
    for (const pairing of pairings) {
        // Match erstellen
        const matchResult = await pool.query(
            `INSERT INTO matches (tournament_id, round_id, match_type, is_bye, status)
             VALUES ($1, $2, 'swiss', $3, 'pending')
             RETURNING id`,
            [tournamentId, roundId, pairing.isBye]
        );
        const matchId = matchResult.rows[0].id;

        // Spieler 1 hinzufügen
        await pool.query(
            `INSERT INTO match_participants (match_id, player_id, team_id)
             VALUES ($1, $2, 1)`,
            [matchId, pairing.player1]
        );

        // Spieler 2 hinzufügen (falls kein Bye)
        if (!pairing.isBye) {
            await pool.query(
                `INSERT INTO match_participants (match_id, player_id, team_id)
                 VALUES ($1, $2, 2)`,
                [matchId, pairing.player2]
            );
        } else {
            // Bye: Automatisch abschliessen
            await pool.query(
                `UPDATE matches 
                 SET status = 'completed', winner_team_id = 1, completed_at = NOW()
                 WHERE id = $1`,
                [matchId]
            );
        }
    }
}

/**
 * Schliesst eine Runde ab und startet die nächste
 */
export async function advanceRound(tournamentId) {
    let data = await getTournamentData(tournamentId);

    if (!data) throw new Error('Tournament not found');
    if (data.tournament.status !== 'in_progress') throw new Error('Tournament is not in progress');

    // Prüfen ob alle Matches der aktuellen Runde abgeschlossen sind
    const pendingMatches = await pool.query(
        `SELECT m.id FROM matches m
                              JOIN tournament_rounds tr ON m.round_id = tr.id
         WHERE tr.tournament_id = $1
           AND tr.round_number = $2
           AND m.status != 'completed'`,
        [tournamentId, data.tournament.currentRound]
    );

    if (pendingMatches.rows.length > 0) {
        throw new Error('Not all matches are completed');
    }

    // Aktuelle Runde abschliessen
    await pool.query(
        `UPDATE tournament_rounds
         SET status = 'completed', completed_at = NOW()
         WHERE tournament_id = $1 AND round_number = $2`,
        [tournamentId, data.tournament.currentRound]
    );

    // Prüfen ob Turnier fertig
    if (data.tournament.currentRound >= data.tournament.totalRounds) {
        await pool.query(
            `UPDATE tournaments SET status = 'completed' WHERE id = $1`,
            [tournamentId]
        );
        return { completed: true };
    }

    // Nächste Runde
    const nextRound = data.tournament.currentRound + 1;

    await pool.query(
        `UPDATE tournaments SET current_round = $1 WHERE id = $2`,
        [nextRound, tournamentId]
    );

    const roundResult = await pool.query(
        `INSERT INTO tournament_rounds (tournament_id, round_number, status, started_at)
         VALUES ($1, $2, 'in_progress', NOW())
         RETURNING id`,
        [tournamentId, nextRound]
    );
    const roundId = roundResult.rows[0].id;

    // WICHTIG: Daten NEU holen nach Abschluss der Runde
    data = await getTournamentData(tournamentId);

    const standings = calculateStandings(data.participants, data.matches);
    const pairings = generatePairings(standings);
    await createMatches(tournamentId, roundId, pairings);

    return { roundId, roundNumber: nextRound, pairings };
}