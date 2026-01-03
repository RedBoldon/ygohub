-- Migration: Fix tournament_series name constraint
-- The name column already has NOT NULL, we just need to ensure it works

-- Verify current state and add length constraint if missing
ALTER TABLE tournament_series
DROP CONSTRAINT IF EXISTS tournament_series_name_check;

ALTER TABLE tournament_series
ADD CONSTRAINT tournament_series_name_check 
CHECK (length(name) >= 2 AND length(name) <= 200);
