-- Migration: Add primary key to collection_deck_cards for proper upsert support
-- Run this SQL in your PostgreSQL database

-- First, add a unique constraint if it doesn't exist
-- This allows ON CONFLICT to work properly

-- Check for duplicates first:
-- SELECT deck_id, card_id, deck_section, COUNT(*) 
-- FROM collection_deck_cards 
-- GROUP BY deck_id, card_id, deck_section 
-- HAVING COUNT(*) > 1;

-- If you have duplicates, clean them up first:
-- DELETE FROM collection_deck_cards a USING collection_deck_cards b
-- WHERE a.ctid < b.ctid
--   AND a.deck_id = b.deck_id
--   AND a.card_id = b.card_id
--   AND a.deck_section = b.deck_section;

-- Then add the constraint:
ALTER TABLE collection_deck_cards
DROP CONSTRAINT IF EXISTS collection_deck_cards_pkey;

ALTER TABLE collection_deck_cards
ADD PRIMARY KEY (deck_id, card_id, deck_section);

-- Verify:
-- \d collection_deck_cards
