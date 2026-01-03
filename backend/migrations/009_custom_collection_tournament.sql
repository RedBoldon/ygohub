-- Migration: Add custom collection support to tournaments
-- This tracks whether the tournament uses a custom collection (allow_custom_cards)

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS custom_collection_id INTEGER REFERENCES custom_deck_collections(id);

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_tournaments_custom_collection ON tournaments(custom_collection_id);

-- Note: A tournament can have EITHER collection_id OR custom_collection_id, not both
-- We add a check constraint to enforce this
ALTER TABLE tournaments 
ADD CONSTRAINT tournaments_single_collection_check 
CHECK (
    (collection_id IS NULL AND custom_collection_id IS NULL) OR
    (collection_id IS NOT NULL AND custom_collection_id IS NULL) OR
    (collection_id IS NULL AND custom_collection_id IS NOT NULL)
);
