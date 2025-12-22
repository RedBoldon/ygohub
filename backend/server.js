// server.js
import 'dotenv/config';
import express from 'express';
import authRoutes from './routes/auth.js';
import tournamentRoutes from './routes/tournament.js';
import customCardsRoutes from './routes/customCards.js';
import customCollectionsRoutes from './routes/customCollections.js';

const app = express();
app.use(express.json());

app.use('/api', authRoutes);

app.use('/api/tournaments', tournamentRoutes);

app.use('/api/custom-cards', customCardsRoutes);

app.use('/api/custom-collections', customCollectionsRoutes);

app.listen(3000, () => {
    console.log('YGOHub Deck Collection API running on http://localhost:3000');
});
