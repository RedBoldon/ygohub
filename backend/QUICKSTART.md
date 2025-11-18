# Quick Start Guide - Deck Collection System

## 📋 Overview

This system allows tournament organizers to create deck collections that can be used across tournament series with full version tracking and lineage management.

## 🚀 Getting Started

### 1. Setup Database

```bash
node setup.js
```

This will create all necessary tables with proper relationships and indexes.

### 2. Run Tests

```bash
node test-deck-collections.js
```

This validates that all functionality works correctly. You should see:
```
✓ Passed: 13
✗ Failed: 0
```

### 3. Import Helper Functions

```javascript
import {
    createCollection,
    addDeckToCollection,
    createSeriesSnapshot,
    createTournamentSnapshot,
    selectDeckForTournament
} from './deck-collection-helpers.js';
```

## 📝 Common Use Cases

### Use Case 1: Create a Collection for Your Tournament Series

```javascript
// 1. Create a collection
const collection = await createCollection(
    userId, 
    "Meta Gauntlet 2025",
    "Competitive decks for regional series"
);

// 2. Add decks to collection
const brandedDeck = await addDeckToCollection(
    collection.id,
    "Branded Despia",
    "Branded"
);

const snakeEyeDeck = await addDeckToCollection(
    collection.id,
    "Snake-Eye",
    "Snake-Eye"
);

// 3. Add cards to decks
await addCardToDeck(brandedDeck.id, "12345", 3, "main"); // Albion x3
await addCardToDeck(brandedDeck.id, "67890", 2, "extra"); // Mirrorjade x2
```

### Use Case 2: Start a Tournament Series

```javascript
// 1. Create tournament series (using your existing code)
const series = await createTournamentSeries({
    name: "Monthly Regional Series",
    organizerId: organizerId,
    countryCodes: ['US', 'CA']
});

// 2. Attach collection to series
const seriesSnapshot = await createSeriesSnapshot(
    series.id,
    collection.id
);

// Now the series has v1 of your collection!
// You can edit seriesSnapshot without affecting the original collection
```

### Use Case 3: Create First Tournament

```javascript
// 1. Create tournament
const tournament1 = await createTournament({
    name: "Regional Championship #1",
    formatId: formatId,
    seriesId: series.id
});

// 2. Create tournament snapshot from series
const t1Snapshot = await createTournamentSnapshot(tournament1.id, {
    sourceType: 'series_snapshot',
    sourceId: seriesSnapshot.id,
    seriesId: series.id
});

// This creates v2 of the collection for tournament #1
```

### Use Case 4: Create Second Tournament (Evolution)

```javascript
// Option A: Continue from series collection
const t2Snapshot = await createTournamentSnapshot(tournament2.id, {
    sourceType: 'series_snapshot',
    sourceId: seriesSnapshot.id,
    seriesId: series.id
});
// Creates v3

// Option B: Continue from previous tournament
const t2Snapshot = await createTournamentSnapshot(tournament2.id, {
    sourceType: 'previous_tournament',
    sourceId: t1Snapshot.id,
    seriesId: series.id
});
// Creates v3 based on tournament #1

// Option C: Use updated user collection (if you added new decks)
const t2Snapshot = await createTournamentSnapshot(tournament2.id, {
    sourceType: 'user_collection',
    sourceId: collection.id,  // Same ID!
    seriesId: series.id
});
// Creates v3 - System detects same source and continues lineage!
```

### Use Case 5: Player Registration

```javascript
// 1. Get available decks for tournament
const snapshot = await getTournamentSnapshot(tournament1.id);
console.log(snapshot.decks);
// [
//   { id: 1, deck_name: "Branded Despia", times_selected: 0 },
//   { id: 2, deck_name: "Snake-Eye", times_selected: 0 }
// ]

// 2. Player selects a deck
await selectDeckForTournament(
    tournament1.id,
    playerId,
    1  // Branded Despia deck ID
);

// 3. Get selection stats
const stats = await getDeckSelectionStats(tournament1.id);
console.log(stats);
// [
//   { deck_name: "Branded Despia", times_selected: 1 },
//   { deck_name: "Snake-Eye", times_selected: 0 }
// ]
```

### Use Case 6: View Collection History

```javascript
// Get full lineage of a collection through the series
const lineage = await getCollectionLineage(series.id, collection.id);
console.log(lineage);
// [
//   { version_number: 1, used_in: "Monthly Regional Series", deck_count: 3 },
//   { version_number: 2, used_in: "Regional #1", deck_count: 3 },
//   { version_number: 3, used_in: "Regional #2", deck_count: 4 },
//   { version_number: 4, used_in: "Regional #3", deck_count: 4 }
// ]
```

### Use Case 7: Compare Deck Versions

```javascript
// Compare a deck between two tournaments
const changes = await compareDeckSnapshots(
    tournament1DeckId,
    tournament2DeckId
);

console.log(changes);
// [
//   { card_name: "Ash Blossom", change_type: "REMOVED", old_quantity: 3 },
//   { card_name: "Effect Veiler", change_type: "ADDED", new_quantity: 3 },
//   { card_name: "Maxx C", change_type: "CHANGED", old_quantity: 2, new_quantity: 3 }
// ]
```

## 🎯 Best Practices

### 1. Collection Organization

✅ **DO:**
- Name collections clearly (e.g., "Meta Gauntlet Q1 2025")
- Add descriptions to help identify purpose
- Keep collections focused (one format, one meta period)

❌ **DON'T:**
- Mix different formats in same collection
- Create duplicate collections unnecessarily
- Delete collections that are in use by series

### 2. Snapshot Management

✅ **DO:**
- Use series snapshots for consistent deck pools
- Create tournament snapshots from previous tournament when you want to keep recent edits
- Use user collection when you've made updates

❌ **DON'T:**
- Edit snapshots after tournament starts (unless fixing errors)
- Create snapshots manually - use the helper functions
- Forget to check version numbers

### 3. Deck Selection Limits

```javascript
// Set a limit when creating snapshot deck
await pool.query(
    `UPDATE snapshot_decks 
     SET max_selections = 3 
     WHERE id = $1`,
    [deckId]
);

// This ensures only 3 players can pick this deck
```

### 4. Tournament Format Configuration

```javascript
// Configure format to use organizer-provided decks
await createTournamentFormat({
    name: "Gauntlet Format",
    deck_source: "organizer_provided",  // vs "player_owned"
    has_topcut: true
});
```

## 🔍 Troubleshooting

### Problem: "Deck is no longer available"
**Cause:** Selection limit reached
**Solution:** Increase max_selections or choose different deck

### Problem: Lineage not continuing (unexpected v1)
**Cause:** Different collection ID used
**Solution:** Verify you're using the same collection ID as the series

### Problem: Snapshot has wrong decks
**Cause:** Wrong source type specified
**Solution:** Check sourceType and sourceId parameters

### Problem: Can't edit original collection
**Cause:** Collection might be locked
**Solution:** Collections are always editable - check permissions

## 📊 Database Queries for Analytics

### Most Popular Decks Across Series
```sql
SELECT 
    sd.deck_name,
    sd.archetype,
    SUM(sd.times_selected) as total_selections,
    COUNT(DISTINCT cs.tournament_id) as used_in_tournaments
FROM snapshot_decks sd
JOIN collection_snapshots cs ON cs.id = sd.snapshot_id
JOIN tournaments t ON t.id = cs.tournament_id
WHERE t.series_id = ?
GROUP BY sd.deck_name, sd.archetype
ORDER BY total_selections DESC;
```

### Collection Usage Statistics
```sql
SELECT 
    dc.name as collection_name,
    COUNT(DISTINCT cs.series_id) as used_in_series,
    COUNT(DISTINCT cs.tournament_id) as used_in_tournaments,
    MAX(cs.version_number) as latest_version
FROM deck_collections dc
JOIN collection_snapshots cs ON cs.source_collection_id = dc.id
WHERE dc.user_id = ?
GROUP BY dc.id;
```

### Tournament Deck Pool Summary
```sql
SELECT 
    t.name as tournament_name,
    cs.version_number,
    COUNT(sd.id) as available_decks,
    SUM(sd.times_selected) as total_selections,
    t.player_count
FROM tournaments t
JOIN collection_snapshots cs ON cs.tournament_id = t.id
JOIN snapshot_decks sd ON sd.snapshot_id = cs.id
WHERE t.id = ?
GROUP BY t.id, cs.id;
```

## 🔗 Integration with Existing Code

### In Your Tournament Routes

```javascript
// POST /api/tournaments/:id/register
app.post('/api/tournaments/:id/register', async (req, res) => {
    const { userId, deckId } = req.body;
    const tournamentId = req.params.id;
    
    try {
        // Select deck from tournament pool
        const selection = await selectDeckForTournament(
            tournamentId,
            userId,
            deckId
        );
        
        res.json({ success: true, selection });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /api/tournaments/:id/decks
app.get('/api/tournaments/:id/decks', async (req, res) => {
    const tournamentId = req.params.id;
    
    const snapshot = await getTournamentSnapshot(tournamentId);
    res.json(snapshot);
});
```

### In Your Series Creation Flow

```javascript
// POST /api/series/:id/collection
app.post('/api/series/:id/collection', async (req, res) => {
    const seriesId = req.params.id;
    const { collectionId } = req.body;
    
    const snapshot = await createSeriesSnapshot(seriesId, collectionId);
    res.json({ success: true, snapshot });
});
```

## 📚 Next Steps

1. **Frontend Development**
   - Build collection management UI
   - Create deck builder interface
   - Add tournament registration with deck selection
   - Implement lineage visualization

2. **Additional Features**
   - Deck import/export (YDK format)
   - Card database integration (YGOProDeck API)
   - Deck validation (format legality)
   - Win rate tracking per deck

3. **Advanced Analytics**
   - Deck evolution visualization
   - Meta game analysis
   - Player deck preferences
   - Performance by archetype

## 🆘 Support

- **Read:** [ARCHITECTURE.md](./ARCHITECTURE.md) for visual diagrams
- **Read:** [TEST_README.md](./TEST_README.md) for testing details
- **Check:** Test suite for examples of every operation
- **Review:** deck-collection-helpers.js for all available functions

## 📄 License

This is part of your YGOHub project.
