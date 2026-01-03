-- Migration: Add created_by column to tournament_series for simpler user binding
-- Run this SQL in your PostgreSQL database

-- Add created_by column if it doesn't exist
ALTER TABLE tournament_series
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tournament_series_created_by ON tournament_series(created_by);

-- Optional: If you want to migrate existing series from organizer to user
-- UPDATE tournament_series ts
-- SET created_by = o.user_id
-- FROM organizers o
-- WHERE ts.organizer_id = o.id AND o.user_id IS NOT NULL;
