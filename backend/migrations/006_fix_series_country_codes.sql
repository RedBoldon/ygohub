-- Migration: Make country_codes nullable and remove restrictive constraints
-- This allows series to be created without specifying regions

-- Drop the existing check constraints on country_codes
ALTER TABLE tournament_series
DROP CONSTRAINT IF EXISTS tournament_series_country_codes_check;

ALTER TABLE tournament_series
DROP CONSTRAINT IF EXISTS tournament_series_country_codes_check1;

-- Make country_codes nullable
ALTER TABLE tournament_series
ALTER COLUMN country_codes DROP NOT NULL;

-- Add a softer constraint: if country_codes is provided, it must be valid
-- (empty array is now allowed, or null)
ALTER TABLE tournament_series
ADD CONSTRAINT tournament_series_country_codes_valid 
CHECK (
    country_codes IS NULL 
    OR array_length(country_codes, 1) IS NULL 
    OR country_codes <@ ARRAY[
        'US', 'CA', 'MX', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'PT', 
        'SE', 'NO', 'DK', 'FI', 'IE', 'PL', 'CZ', 'GR', 'JP', 'KR', 'CN', 'TW', 'HK', 
        'SG', 'MY', 'TH', 'PH', 'ID', 'VN', 'IN', 'AU', 'NZ', 'BR', 'AR', 'CL', 'CO', 
        'PE', 'ZA', 'EG', 'RU', 'TR', 'IL', 'AE', 'SA'
    ]::text[]
);
