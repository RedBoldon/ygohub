# Deck Collection System - Testing Guide

## Overview

This testing suite validates the deck collection snapshot system for tournament management. The system allows users to create deck collections, which can then be snapshotted for tournament series and individual tournaments, with full lineage tracking.

## Files

- **setup.js** - Database schema setup with all tables
- **test-deck-collections.js** - Comprehensive test suite

## Database Schema

### Core Tables

#### User Collections (Living, Editable)
- `deck_collections` - User's collection of decks
- `collection_decks` - Individual decks within collections
- `collection_deck_cards` - Cards within decks

#### Snapshots (Immutable after creation)
- `collection_snapshots` - Snapshots for series and tournaments
- `snapshot_decks` - Decks within snapshots
- `snapshot_deck_cards` - Cards within snapshot decks

#### Player Selection
- `player_tournament_decks` - Tracks which deck each player selected

## Key Features Tested

### 1. Basic Collection Management
- ✓ Create user collections
- ✓ Add decks to collections
- ✓ Add cards to decks
- ✓ Edit collections without affecting snapshots

### 2. Series Snapshots
- ✓ Create series snapshot from user collection
- ✓ Independent editing of series snapshot
- ✓ Version tracking starts at v1

### 3. Tournament Snapshots
- ✓ Create tournament snapshot from series
- ✓ Create tournament snapshot from previous tournament
- ✓ Create tournament snapshot from user collection
- ✓ Automatic version incrementing

### 4. Lineage Tracking
- ✓ Detect when same collection is reused (continues lineage)
- ✓ Detect when different collection is used (breaks lineage)
- ✓ Track version numbers across entire series
- ✓ Maintain parent-child relationships

### 5. Player Deck Selection
- ✓ Players select from tournament deck pool
- ✓ Track selection counts
- ✓ Enforce selection limits (if set)

### 6. Deck Evolution
- ✓ Track changes across tournament history
- ✓ Compare snapshots to see evolution
- ✓ User edits don't affect past snapshots

## Running the Tests

### Prerequisites

1. PostgreSQL database running
2. Database connection configured in `db.js`
3. Node.js with ES modules support

### Setup Database

```bash
node setup.js
```

This will:
- Drop all existing tables
- Create all required tables
- Set up indexes
- Create foreign key relationships

### Run Tests

```bash
node test-deck-collections.js
```

The test suite will:
1. Set up the database schema
2. Run all test scenarios
3. Display results for each test
4. Show summary with pass/fail counts

## Test Scenarios

### Basic Collection Creation Tests
- Create user collection
- Create deck in collection
- Add cards to deck

### Series Snapshot Tests
- Create series snapshot from user collection
- Edit series snapshot without affecting user collection

### Tournament Snapshot Tests
- Create tournament snapshot from series snapshot
- Create multiple tournaments with incrementing versions

### Lineage Tracking Tests
- Track lineage when reusing same collection
- Break lineage with different collection

### Player Deck Selection Tests
- Player selects deck from tournament pool
- Track deck selection count

### Deck Evolution Tests
- Track deck changes across tournaments

### Complex Scenario Tests
- Full tournament series lifecycle with 4 tournaments

## Expected Output

```
========================================
DECK COLLECTION SYSTEM TEST SUITE
========================================

Setting up database...

✓ Users table created successfully.
✓ Organizers table created successfully.
...

--- Basic Collection Creation Tests ---

✓ Create user collection
✓ Create deck in collection
✓ Add cards to deck

--- Series Snapshot Tests ---

✓ Create series snapshot from user collection
✓ Edit series snapshot without affecting user collection

...

========================================
TEST SUMMARY
========================================
Total Tests: 13
✓ Passed: 13
✗ Failed: 0
========================================
```

## Understanding the Lineage System

### Scenario 1: Same Collection Evolution

```
User Collection (id: 100) "Meta Gauntlet 2025"
    ↓
Series Snapshot (v1, source: 100)
    ↓
Tournament 1 Snapshot (v2, source: 100)
    ↓
Tournament 2 from USER COLLECTION (id: 100)
    → System detects: id 100 = id 100
    → Creates v3 (continues lineage!)
    ↓
Tournament 3 from previous tournament
    → Creates v4 (continues lineage!)
```

### Scenario 2: Breaking Lineage

```
User Collection A (id: 100)
    ↓
Series Snapshot (v1, source: 100)
    ↓
Tournament 1 (v2, source: 100)
    ↓
Tournament 2 from USER COLLECTION B (id: 200)
    → System detects: id 200 ≠ id 100
    → Creates v1 (NEW lineage!)
```

## Useful Queries

### View Collection Lineage

```sql
SELECT 
    cs.id,
    cs.snapshot_type,
    cs.version_number,
    COALESCE(t.name, ts.name) as used_in,
    cs.created_at,
    COUNT(DISTINCT sd.id) as deck_count
FROM collection_snapshots cs
LEFT JOIN tournaments t ON cs.tournament_id = t.id
LEFT JOIN tournament_series ts ON cs.series_id = ts.id
LEFT JOIN snapshot_decks sd ON sd.snapshot_id = cs.id
WHERE cs.source_collection_id = ?
GROUP BY cs.id, t.id, ts.id
ORDER BY cs.version_number;
```

### Compare Decks Between Snapshots

```sql
SELECT 
    COALESCE(old.card_id, new.card_id) as card_id,
    c.name,
    old.quantity as old_quantity,
    new.quantity as new_quantity,
    CASE 
        WHEN old.quantity IS NULL THEN 'ADDED'
        WHEN new.quantity IS NULL THEN 'REMOVED'
        WHEN old.quantity != new.quantity THEN 'CHANGED'
    END as change_type
FROM snapshot_deck_cards old
FULL OUTER JOIN snapshot_deck_cards new 
    ON old.card_id = new.card_id 
    AND old.deck_section = new.deck_section
JOIN cards c ON c.card_id = COALESCE(old.card_id, new.card_id)
WHERE old.deck_id = ? AND new.deck_id = ?
    AND (old.quantity IS NULL OR new.quantity IS NULL OR old.quantity != new.quantity);
```

### Most Popular Deck in Tournament

```sql
SELECT 
    sd.deck_name,
    sd.archetype,
    sd.times_selected,
    sd.max_selections,
    ROUND(100.0 * sd.times_selected / t.player_count, 2) as usage_percentage
FROM snapshot_decks sd
JOIN collection_snapshots cs ON sd.snapshot_id = cs.id
JOIN tournaments t ON cs.tournament_id = t.id
WHERE t.id = ?
ORDER BY sd.times_selected DESC;
```

## Troubleshooting

### Tests Fail on Database Connection
- Check `db.js` configuration
- Ensure PostgreSQL is running
- Verify database exists and user has permissions

### Foreign Key Violations
- Ensure tables are created in correct order (setup.js handles this)
- Check that parent records exist before creating child records

### Snapshot Not Creating
- Verify source collection exists
- Check that all foreign key references are valid
- Ensure snapshot_type is either 'series' or 'tournament'

## Next Steps

After tests pass, you can:
1. Implement API endpoints for collection management
2. Add authentication and authorization
3. Build frontend UI for collection management
4. Add deck import/export functionality
5. Implement deck comparison tools
6. Add analytics and statistics

## Contributing

When adding new features:
1. Add corresponding table/column to setup.js
2. Write tests in test-deck-collections.js
3. Verify all tests still pass
4. Document new functionality in this README
