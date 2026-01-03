// server.js
import 'dotenv/config';
import express from 'express';
import authRoutes from './routes/auth.js';
import tournamentRoutes from './routes/tournament.js';
import customCardsRoutes from './routes/customCards.js';
import customCollectionsRoutes from './routes/customCollections.js';
import collectionsRoutes from './routes/collections.js';
import cardsRoutes from './routes/cards.js';

const app = express();
app.use(express.json());

// Auth routes (register, login, etc.)
app.use('/api', authRoutes);

// Tournament routes
app.use('/api/tournaments', tournamentRoutes);

// Card database search
app.use('/api/cards', cardsRoutes);

// User deck collections (standard cards)
app.use('/api/collections', collectionsRoutes);

// Custom cards CRUD
app.use('/api/custom-cards', customCardsRoutes);

// Custom card collections (for alternative formats)
app.use('/api/custom-collections', customCollectionsRoutes);

app.listen(3000, () => {
    console.log('YGOHub API running on http://localhost:3000');
});
