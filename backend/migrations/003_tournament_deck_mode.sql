-- Migration: Add deck_mode and collection_id to tournaments
-- Run this SQL in your PostgreSQL database

-- Add deck_mode column (player = own decks, organizer = assigned decks)
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS deck_mode TEXT DEFAULT 'player' 
CHECK (deck_mode IN ('player', 'organizer'));

-- Add collection_id for organizer mode
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS collection_id INTEGER REFERENCES deck_collections(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tournaments_collection ON tournaments(collection_id);
