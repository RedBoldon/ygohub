-- Migration: Fix tournament_series constraints
-- Allow either created_by OR organizer_id, but not both null

-- First, make organizer_id nullable
ALTER TABLE tournament_series 
ALTER COLUMN organizer_id DROP NOT NULL;

-- Add check constraint: at least one of created_by or organizer_id must be set
ALTER TABLE tournament_series
DROP CONSTRAINT IF EXISTS tournament_series_owner_check;

ALTER TABLE tournament_series
ADD CONSTRAINT tournament_series_owner_check 
CHECK (created_by IS NOT NULL OR organizer_id IS NOT NULL);

-- Create index for created_by lookups
CREATE INDEX IF NOT EXISTS idx_tournament_series_created_by ON tournament_series(created_by);
