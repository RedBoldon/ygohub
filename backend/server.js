// server.js
import express from 'express';
import { pool } from './db.js';
import {
    createCollection, addDeckToCollection, addCardToDeck,
    createSeriesSnapshot, createTournamentSnapshot, selectDeckForTournament,
    getTournamentSnapshot
} from './deck-collection-helpers.js';

const app = express();
app.use(express.json());

// Fake auth middleware – replace with real JWT later
const auth = (req, res, next) => {
    req.user = { id: 1 }; // hardcoded for now
    next();
};

// Collections
app.post('/api/collections', auth, async (req, res) => {
    const col = await createCollection(req.user.id, req.body.name, req.body.description || '');
    res.json(col);
});

app.post('/api/collections/:id/decks', auth, async (req, res) => {
    const deck = await addDeckToCollection(req.params.id, req.body.name, req.body.archetype);
    res.json(deck);
});

// Series
app.post('/api/series/:id/snapshot', auth, async (req, res) => {
    const snap = await createSeriesSnapshot(req.params.id, req.body.collectionId);
    res.json(snap);
});

// Tournaments
app.post('/api/tournaments/:id/snapshot', auth, async (req, res) => {
    const snap = await createTournamentSnapshot(req.params.id, req.body);
    res.json(snap);
});

app.get('/api/tournaments/:id/decks', async (req, res) => {
    const data = await getTournamentSnapshot(req.params.id);
    res.json(data);
});

app.post('/api/tournaments/:id/select-deck', auth, async (req, res) => {
    const selection = await selectDeckForTournament(req.params.id, req.user.id, req.body.snapshotDeckId);
    res.json(selection);
});

app.listen(3000, () => {
    console.log('YGOHub Deck Collection API running on http://localhost:3000');
});