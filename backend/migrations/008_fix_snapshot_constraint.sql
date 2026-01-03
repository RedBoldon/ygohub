-- Migration: Fix collection_snapshots constraint for player mode
-- Player mode creates a snapshot without source_collection_id

-- Drop the existing constraint
ALTER TABLE collection_snapshots
DROP CONSTRAINT IF EXISTS collection_snapshots_check;

-- Add updated constraint that allows null source_collection_id for player decks
ALTER TABLE collection_snapshots
ADD CONSTRAINT collection_snapshots_check CHECK (
    (snapshot_type = 'series' AND series_id IS NOT NULL AND tournament_id IS NULL)
    OR 
    (snapshot_type = 'tournament' AND tournament_id IS NOT NULL)
);
