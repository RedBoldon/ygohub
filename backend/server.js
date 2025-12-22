// server.js
import 'dotenv/config';
import express from 'express';
import  authRoutes from './routes/auth.js';
import tournamentRoutes from './routes/tournament.js';

const app = express();
app.use(express.json());

app.use('/api', authRoutes);

app.use('/api/tournaments', tournamentRoutes);

app.listen(3000, () => {
    console.log('YGOHub Deck Collection API running on http://localhost:3000');
});