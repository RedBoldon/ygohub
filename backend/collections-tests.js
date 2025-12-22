// collections-tests.js — FULL 13-TEST LEGENDARY SUITE
import { pool } from './db.js';
import { createAllTables } from './setup.js';
import {
    createCollection,
    addDeckToCollection,
    addCardToDeck,
    createSeriesSnapshot,
    createTournamentSnapshot,
    selectDeckForTournament,
    getTournamentSnapshot
} from './collection.js';

// ============================================
// TEST RUNNER
// ============================================
class TestRunner {
    constructor() { this.passed = 0; this.failed = 0; }
    async test(name, fn) {
        try {
            await fn();
            this.passed++;
            console.log(`✓ Passed: ${this.passed.toString().padStart(2)} ${name}`);
        } catch (e) {
            this.failed++;
            console.log(`✗ Failed: ${this.passed + this.failed.toString().padStart(2)} ${name}`);
            console.error(`  ${e.message}\n`);
        }
    }
    summary() {
        console.log('\n========================================');
        console.log('       FINAL TEST SUMMARY');
        console.log('========================================');
        console.log(`Total Tests : ${this.passed + this.failed}`);
        console.log(`✓ Passed    : ${this.passed}`);
        console.log(`✗ Failed    : ${this.failed}`);
        if (this.failed === 0) {
            console.log('\n🎉🎉 ALL 13 TESTS PASSED — LINEAGE IS PERFECT 🎉🎉\n');
        }
        console.log('========================================\n');
    }
}

// ============================================
// SHARED HELPERS
// ============================================
async function createTestUser(base = 'user') {
    const username = `${base}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const res = await pool.query(
        `INSERT INTO users (username, tag, password_hash, email, role)
         VALUES ($1, '0000', 'hash', $2, 'user') RETURNING *`,
        [username, `${username}@test.com`]
    );
    return res.rows[0];
}
async function createTestOrganizer(userId) {
    const res = await pool.query(
        `INSERT INTO organizers (type, user_id, name) VALUES ('user', $1, 'Org') RETURNING *`,
        [userId]
    );
    return res.rows[0];
}
async function createTestSeries(organizerId) {
    const res = await pool.query(
        `INSERT INTO tournament_series (name, organizer_id, country_codes)
         VALUES ('Series', $1, ARRAY['US']) RETURNING *`,
        [organizerId]
    );
    return res.rows[0];
}
async function createTestFormat() {
    const name = `Fmt_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
    const res = await pool.query(
        `INSERT INTO tournament_formats (name, deck_source) VALUES ($1, 'organizer_provided') RETURNING *`,
        [name]
    );
    return res.rows[0];
}
async function createTestTournament(seriesId, formatId) {
    const res = await pool.query(
        `INSERT INTO tournaments (name, format_id, series_id, min_player_count, max_player_count)
         VALUES ('Tourn', $1, $2, 4, 64) RETURNING *`,
        [formatId, seriesId]
    );
    return res.rows[0];
}
async function ensureDummyCards() {
    const cards = [
        ['400001', 'Test Dragon'],
        ['400002', 'Test Spell'],
        ['400003', 'Test Trap'],
        ['400004', 'New Hotness'],
    ];
    for (const [id, name] of cards) {
        await pool.query(`
            INSERT INTO cards (id, name, type, humanReadableCardType, frameType, description, race)
            VALUES ($1, $2, 'Effect Monster', 'Effect Monster', 'effect', 'test', 'Dragon')
            ON CONFLICT (id) DO NOTHING
        `, [id, name]);
    }
}

// ============================================
// THE LEGENDARY 13 TESTS
// ============================================
async function runAllTests() {
    const r = new TestRunner();
    console.log('\nSetting up database...\n');
    await createAllTables();
    await ensureDummyCards();

    await r.test('01 │ Basic collection + deck + cards', async () => {
        const u = await createTestUser('t01');
        const c = await createCollection(u.id, 'Basic Coll');
        const d = await addDeckToCollection(c.id, 'Snake-Eye', 'Snake-Eye');
        await addCardToDeck(d.id, '400001', 3, 'main');
        await addCardToDeck(d.id, '400002', 2, 'main');
    });

    await r.test('02 │ Series snapshot → version 1', async () => {
        const u = await createTestUser('t02');
        const o = await createTestOrganizer(u.id);
        const s = await createTestSeries(o.id);
        const c = await createCollection(u.id, 'Meta');
        const snap = await createSeriesSnapshot(s.id, c.id);
        if (snap.version_number !== 1) throw Error('v1 broken');
    });

    await r.test('03 │ Tournament from series → version 2', async () => {
        const u = await createTestUser('t03');
        const o = await createTestOrganizer(u.id);
        const s = await createTestSeries(o.id);
        const f = await createTestFormat();
        const c = await createCollection(u.id, 'Meta');
        const ss = await createSeriesSnapshot(s.id, c.id);
        const t = await createTestTournament(s.id, f.id);
        const ts = await createTournamentSnapshot(t.id, {sourceType:'series_snapshot', sourceId:ss.id, seriesId:s.id});
        if (ts.version_number !== 2) throw Error('v2 broken');
    });

    await r.test('04 │ Direct from user collection after series → still v2 (new lineage)', async () => {
        const u = await createTestUser('t04');
        const o = await createTestOrganizer(u.id);
        const s = await createTestSeries(o.id);
        const f = await createTestFormat();
        const c = await createCollection(u.id, 'Different');
        await createSeriesSnapshot(s.id, c.id); // v1
        const t = await createTestTournament(s.id, f.id);
        const ts = await createTournamentSnapshot(t.id, {sourceType:'user_collection', sourceId:c.id, seriesId:s.id});
        if (ts.version_number !== 2) throw Error('should continue');
    });

    await r.test('05 │ Lineage continues when reusing SAME user collection', async () => {
        const u = await createTestUser('t05');
        const o = await createTestOrganizer(u.id);
        const s = await createTestSeries(o.id);
        const f = await createTestFormat();
        const c = await createCollection(u.id, 'Evolving');

        const ss = await createSeriesSnapshot(s.id, c.id); // v1
        const t1 = await createTestTournament(s.id, f.id);
        await createTournamentSnapshot(t1.id, {sourceType:'series_snapshot', sourceId:ss.id, seriesId:s.id}); // v2
        const t2 = await createTestTournament(s.id, f.id);
        const ts2 = await createTournamentSnapshot(t2.id, {sourceType:'user_collection', sourceId:c.id, seriesId:s.id});
        if (ts2.version_number !== 3) throw Error('MAGIC FAILED');
    });

    await r.test('06 │ Player selects deck → times_selected = 1', async () => {
        const ou = await createTestUser('org6');
        const pu = await createTestUser('ply6');
        const o = await createTestOrganizer(ou.id);
        const s = await createTestSeries(o.id);
        const f = await createTestFormat();
        const c = await createCollection(ou.id, 'Pool');
        const d = await addDeckToCollection(c.id, 'Branded', 'Branded');
        await addCardToDeck(d.id, '400001', 1, 'main');

        const ss = await createSeriesSnapshot(s.id, c.id);
        const t = await createTestTournament(s.id, f.id);
        await createTournamentSnapshot(t.id, {sourceType:'series_snapshot', sourceId:ss.id, seriesId:s.id});

        const snap = await getTournamentSnapshot(t.id);
        await selectDeckForTournament(t.id, pu.id, snap.decks[0].id);
        const updated = await getTournamentSnapshot(t.id);
        if (updated.decks[0].times_selected !== 1) throw Error('counter fail');
    });

    await r.test('07 │ Selection limit works (max_selections = 2)', async () => {
        const ou = await createTestUser('org7');
        const [p1,p2,p3] = await Promise.all([1,2,3].map(i=>createTestUser(`p7${i}`)));
        const o = await createTestOrganizer(ou.id);
        const s = await createTestSeries(o.id);
        const f = await createTestFormat();
        const c = await createCollection(ou.id, 'Limited');
        const d = await addDeckToCollection(c.id, 'Limit Deck', 'Test');

        const ss = await createSeriesSnapshot(s.id, c.id);
        const t = await createTestTournament(s.id, f.id);
        await createTournamentSnapshot(t.id, {sourceType:'series_snapshot', sourceId:ss.id, seriesId:s.id});

        // set limit to 2
        const snap = await getTournamentSnapshot(t.id);
        const deckId = snap.decks[0].id;
        await pool.query(`UPDATE snapshot_decks SET max_selections = 2 WHERE id = $1`, [deckId]);

        await selectDeckForTournament(t.id, p1.id, deckId);
        await selectDeckForTournament(t.id, p2.id, deckId);
        await selectDeckForTournament(t.id, p3.id, deckId).catch(() => {}); // should fail

        const final = await getTournamentSnapshot(t.id);
        if (final.decks[0].times_selected !== 2) throw Error('limit broken');
    });

    await r.test('08 │ Deck evolution — card added after snapshot', async () => {
        const u = await createTestUser('evo');
        const o = await createTestOrganizer(u.id);
        const s = await createTestSeries(o.id);
        const f = await createTestFormat();
        const c = await createCollection(u.id, 'Evo Coll');
        const d = await addDeckToCollection(c.id, 'Evolving', 'Test');
        await addCardToDeck(d.id, '400001', 3, 'main');

        const ss = await createSeriesSnapshot(s.id, c.id); // snapshot without new card
        await addCardToDeck(d.id, '400004', 1, 'main'); // add new hotness

        const t = await createTestTournament(s.id, f.id);
        const ts = await createTournamentSnapshot(t.id, {sourceType:'user_collection', sourceId:c.id, seriesId:s.id});

        const cards = await pool.query(`
            SELECT card_id, quantity FROM snapshot_deck_cards sdc
                                              JOIN snapshot_decks sd ON sdc.deck_id = sd.id
            WHERE sd.snapshot_id = $1
        `, [ts.id]);

        const hasNew = cards.rows.some(r => r.card_id === '400004');
        if (!hasNew) throw Error('evolution not captured');
    });

    await r.test('09 │ Past snapshots unchanged after edit', async () => {
        const u = await createTestUser('past');
        const o = await createTestOrganizer(u.id);
        const s = await createTestSeries(o.id);
        const f = await createTestFormat();
        const c = await createCollection(u.id, 'Immutable');
        const d = await addDeckToCollection(c.id, 'Old', 'Old');
        await addCardToDeck(d.id, '400001', 3, 'main');

        const ss = await createSeriesSnapshot(s.id, c.id);
        await pool.query(`DELETE FROM collection_deck_cards WHERE deck_id = $1`, [d.id]); // nuke cards

        const oldSnapCards = await pool.query(`
            SELECT COUNT(*) n FROM snapshot_deck_cards sdc
                                       JOIN snapshot_decks sd ON sdc.deck_id = sd.id
            WHERE sd.snapshot_id = $1
        `, [ss.id]);

        if (Number(oldSnapCards.rows[0].n) !== 1) throw Error('past snapshot mutated!');
    });

    await r.test('10 │ Multiple decks in one collection', async () => {
        const u = await createTestUser('multi');
        const c = await createCollection(u.id, 'Many');
        await addDeckToCollection(c.id, 'Deck A', 'A');
        await addDeckToCollection(c.id, 'Deck B', 'B');
        const o = await createTestOrganizer(u.id);
        const s = await createTestSeries(o.id);
        const snap = await createSeriesSnapshot(s.id, c.id);
        const count = await pool.query(`SELECT COUNT(*) n FROM snapshot_decks WHERE snapshot_id = $1`, [snap.id]);
        if (Number(count.rows[0].n) !== 2) throw Error('multi-deck fail');
    });

    await r.test('11 │ Snapshot from previous tournament continues lineage', async () => {
        const u = await createTestUser('prev');
        const o = await createTestOrganizer(u.id);
        const s = await createTestSeries(o.id);
        const f = await createTestFormat();
        const c = await createCollection(u.id, 'Chain');

        const ss = await createSeriesSnapshot(s.id, c.id); // v1
        const t1 = await createTestTournament(s.id, f.id);
        const ts1 = await createTournamentSnapshot(t1.id, {sourceType:'series_snapshot', sourceId:ss.id, seriesId:s.id}); // v2

        const t2 = await createTestTournament(s.id, f.id);
        const ts2 = await createTournamentSnapshot(t2.id, {sourceType:'previous_tournament', sourceId:ts1.id, seriesId:s.id});
        if (ts2.version_number !== 3) throw Error('previous_tournament broken');
    });

    await r.test('12 │ Different source collection → new lineage v1', async () => {
        const u = await createTestUser('fork');
        const o = await createTestOrganizer(u.id);
        const s = await createTestSeries(o.id);
        const f = await createTestFormat();

        const c1 = await createCollection(u.id, 'Original');
        await createSeriesSnapshot(s.id, c1.id); // v1 of c1

        const c2 = await createCollection(u.id, 'Forked');
        const t = await createTestTournament(s.id, f.id);
        const ts = await createTournamentSnapshot(t.id, {sourceType:'user_collection', sourceId:c2.id, seriesId:s.id});
        if (ts.version_number !== 1) throw Error('fork should start v1');
    });

    await r.test('13 │ Full complex series with mixed sources → correct versions', async () => {
        const u = await createTestUser('complex');
        const o = await createTestOrganizer(u.id);
        const s = await createTestSeries(o.id);
        const f = await createTestFormat();
        const c = await createCollection(u.id, 'Complex');

        // v1 series
        const ss = await createSeriesSnapshot(s.id, c.id);

        // v2 from series
        const t1 = await createTestTournament(s.id, f.id);
        await createTournamentSnapshot(t1.id, {sourceType:'series_snapshot', sourceId:ss.id, seriesId:s.id});

        // v3 from user collection (same!)
        const t2 = await createTestTournament(s.id, f.id);
        await createTournamentSnapshot(t2.id, {sourceType:'user_collection', sourceId:c.id, seriesId:s.id});

        // v4 from previous tournament
        const t3 = await createTestTournament(s.id, f.id);
        const ts3 = await createTournamentSnapshot(t3.id, {sourceType:'previous_tournament', sourceId: (await getTournamentSnapshot(t2.id)).snapshot.id, seriesId:s.id});

        if (ts3.version_number !== 4) throw Error('complex flow broken');
    });

    r.summary();
    await pool.end();
}

runAllTests().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});