// test-swiss.js
import { pool } from './db.js';
import {
    startTournament,
    advanceRound,
    getTournamentData,
    calculateStandings,
    generatePairings
} from './swiss.js';

async function cleanup(tournamentId) {
    // Reihenfolge wichtig: erst Abhängigkeiten, dann Haupttabellen
    await pool.query(`DELETE FROM match_participants WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = $1)`, [tournamentId]);
    await pool.query(`DELETE FROM matches WHERE tournament_id = $1`, [tournamentId]);
    await pool.query(`DELETE FROM tournament_rounds WHERE tournament_id = $1`, [tournamentId]);
    await pool.query(`DELETE FROM tournament_participants WHERE tournament_id = $1`, [tournamentId]);
    await pool.query(`DELETE FROM tournaments WHERE id = $1`, [tournamentId]);
}

async function createTestUsers(count) {
    const users = [];
    for (let i = 0; i < count; i++) {
        const result = await pool.query(
            `INSERT INTO users (username, tag, password_hash, email, status)
             VALUES ($1, $2, 'testhash', $3, 'active')
             RETURNING id, username, tag`,
            [`TestPlayer${i}`, 1000 + i, `testplayer${i}_${Date.now()}@test.com`]
        );
        users.push(result.rows[0]);
    }
    return users;
}

async function cleanupUsers(users) {
    for (const user of users) {
        await pool.query(`DELETE FROM users WHERE id = $1`, [user.id]);
    }
}

async function createTestTournament(creatorId, playerCount) {
    const result = await pool.query(
        `INSERT INTO tournaments (name, min_player_count, max_player_count, created_by, invite_code, status)
         VALUES ($1, 2, $2, $3, $4, 'open')
         RETURNING id`,
        [`Test Tournament ${Date.now()}`, playerCount, creatorId, `test${Date.now()}`]
    );
    return result.rows[0].id;
}

async function addParticipants(tournamentId, users) {
    for (const user of users) {
        await pool.query(
            `INSERT INTO tournament_participants (tournament_id, user_id)
             VALUES ($1, $2)`,
            [tournamentId, user.id]
        );
    }
    await pool.query(
        `UPDATE tournaments SET player_count = $1 WHERE id = $2`,
        [users.length, tournamentId]
    );
}

async function reportAllMatchResults(tournamentId, currentRound) {
    // Hole alle offenen Matches der Runde
    const matches = await pool.query(
        `SELECT m.id, m.is_bye
         FROM matches m
         JOIN tournament_rounds tr ON m.round_id = tr.id
         WHERE m.tournament_id = $1 
         AND tr.round_number = $2
         AND m.status = 'pending'`,
        [tournamentId, currentRound]
    );

    for (const match of matches.rows) {
        if (match.is_bye) continue;

        // Zufälliges Ergebnis: 2-0, 2-1, 0-2, 1-2
        const results = [[2, 0], [2, 1], [0, 2], [1, 2]];
        const [team1Score, team2Score] = results[Math.floor(Math.random() * results.length)];

        const winnerTeamId = team1Score > team2Score ? 1 : 2;

        await pool.query(
            `UPDATE matches 
             SET team_1_score = $1, team_2_score = $2, winner_team_id = $3,
                 status = 'completed', completed_at = NOW()
             WHERE id = $4`,
            [team1Score, team2Score, winnerTeamId, match.id]
        );

        await pool.query(
            `UPDATE match_participants SET score = $1 WHERE match_id = $2 AND team_id = 1`,
            [team1Score, match.id]
        );
        await pool.query(
            `UPDATE match_participants SET score = $1 WHERE match_id = $2 AND team_id = 2`,
            [team2Score, match.id]
        );
    }
}

async function printPairings(tournamentId, roundNumber) {
    const pairings = await pool.query(
        `SELECT m.id, m.is_bye,
                u1.username as player1_name, u1.tag as player1_tag,
                u2.username as player2_name, u2.tag as player2_tag
         FROM matches m
         JOIN tournament_rounds tr ON m.round_id = tr.id
         JOIN match_participants mp1 ON m.id = mp1.match_id AND mp1.team_id = 1
         JOIN users u1 ON mp1.player_id = u1.id
         LEFT JOIN match_participants mp2 ON m.id = mp2.match_id AND mp2.team_id = 2
         LEFT JOIN users u2 ON mp2.player_id = u2.id
         WHERE m.tournament_id = $1 AND tr.round_number = $2`,
        [tournamentId, roundNumber]
    );

    console.log(`\n=== Runde ${roundNumber} Pairings ===`);
    for (const p of pairings.rows) {
        if (p.is_bye) {
            console.log(`  ${p.player1_name}#${p.player1_tag} - BYE`);
        } else {
            console.log(`  ${p.player1_name}#${p.player1_tag} vs ${p.player2_name}#${p.player2_tag}`);
        }
    }
}

async function printStandings(participants, matches) {
    const standings = calculateStandings(participants, matches);

    console.log('\n=== Standings ===');
    console.log('Rank | Player            | W-L   | OMW%  | OOMW%');
    console.log('-----|-------------------|-------|-------|------');

    standings.forEach((s, i) => {
        const name = `${s.username}#${s.tag}`.padEnd(17);
        const record = `${s.matchWins}-${s.matchLosses}`.padEnd(5);
        const omw = (s.omw * 100).toFixed(1).padStart(5);
        const oomw = (s.oomw * 100).toFixed(1).padStart(5);
        console.log(`${String(i + 1).padStart(4)} | ${name} | ${record} | ${omw}% | ${oomw}%`);
    });
}

async function runTest() {
    console.log('🎮 Swiss Tournament Test\n');

    const PLAYER_COUNT = 8;
    let users = [];
    let tournamentId = null;

    try {
        // Setup
        console.log(`Creating ${PLAYER_COUNT} test users...`);
        users = await createTestUsers(PLAYER_COUNT);
        console.log('✓ Users created');

        console.log('Creating tournament...');
        tournamentId = await createTestTournament(users[0].id, PLAYER_COUNT);
        console.log(`✓ Tournament created (ID: ${tournamentId})`);

        console.log('Adding participants...');
        await addParticipants(tournamentId, users);
        console.log('✓ Participants added');

        // Turnier starten
        console.log('\nStarting tournament...');
        const startResult = await startTournament(tournamentId);
        console.log('✓ Tournament started');

        // Daten holen
        let data = await getTournamentData(tournamentId);
        console.log(`Total rounds: ${data.tournament.totalRounds}`);

        // Alle Runden durchspielen
        for (let round = 1; round <= data.tournament.totalRounds; round++) {
            await printPairings(tournamentId, round);

            console.log(`\nReporting results for round ${round}...`);
            await reportAllMatchResults(tournamentId, round);
            console.log('✓ Results reported');

            // Aktualisierte Daten holen
            data = await getTournamentData(tournamentId);
            await printStandings(data.participants, data.matches);

            // Nächste Runde (ausser bei letzter)
            if (round < data.tournament.totalRounds) {
                console.log(`\nAdvancing to round ${round + 1}...`);
                await advanceRound(tournamentId);
                console.log('✓ Round advanced');
            }
        }

        // Turnier abschliessen
        console.log('\nCompleting tournament...');
        const finalResult = await advanceRound(tournamentId);
        console.log('✓ Tournament completed:', finalResult);

        // Finale Standings
        data = await getTournamentData(tournamentId);
        console.log('\n🏆 FINAL STANDINGS 🏆');
        await printStandings(data.participants, data.matches);

    } catch (err) {
        console.error('❌ Test failed:', err);
    } finally {
        // Cleanup
        console.log('\nCleaning up...');
        if (tournamentId) await cleanup(tournamentId);
        if (users.length > 0) await cleanupUsers(users);
        console.log('✓ Cleanup complete');

        await pool.end();
    }
}

runTest();