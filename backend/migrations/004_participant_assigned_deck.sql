-- Migration: Add assigned_deck_id to tournament_participants
-- Run this SQL in your PostgreSQL database

ALTER TABLE tournament_participants
ADD COLUMN IF NOT EXISTS assigned_deck_id INTEGER REFERENCES collection_decks(id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_tournament_participants_deck ON tournament_participants(assigned_deck_id);
