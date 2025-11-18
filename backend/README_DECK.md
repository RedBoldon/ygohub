# YGOHub Deck Collection System

## 🎯 Quick Navigation

**New to the system?** Start here:
1. 📖 Read [SUMMARY.md](./SUMMARY.md) - Complete overview
2. 🚀 Read [QUICKSTART.md](./QUICKSTART.md) - Get up and running
3. 🏗️ Read [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand the design

**Ready to implement?**
1. 💾 Run `node setup.js` or `node migrate.js migrate`
2. ✅ Run `node test-deck-collections.js`
3. 🔧 Import from `deck-collection-helpers.js`

**Need help?**
- 📚 [TEST_README.md](./TEST_README.md) - Testing guide
- 🐛 Check troubleshooting sections in docs
- 💡 Review test files for examples

## 📁 File Structure

### Core Implementation
```
setup.js                      - Database schema (fresh install)
migrate.js                    - Add to existing database
deck-collection-helpers.js    - Production-ready functions
test-deck-collections.js      - Comprehensive test suite
```

### Documentation
```
SUMMARY.md         - Complete overview (start here!)
QUICKSTART.md      - Getting started guide
ARCHITECTURE.md    - Visual diagrams and flows
TEST_README.md     - Testing documentation
README_DECK.md     - This file
```

### Existing Files (Your Project)
```
db.js              - Database connection
server.js          - Your API server
package.json       - Dependencies
```

## ⚡ Quick Commands

```bash
# Fresh installation
node setup.js

# Add to existing database
node migrate.js migrate

# Verify migration
node migrate.js verify

# Run tests
node test-deck-collections.js

# Rollback (if needed)
node migrate.js rollback
```

## 🎨 System Overview

### What You Can Build

**User Features:**
- Create and manage deck collections
- Build decks with card management
- See collection usage history
- Track deck evolution across tournaments

**Organizer Features:**
- Create tournament series with deck pools
- Choose decks from collections
- Track versions across tournaments
- Edit snapshots independently
- Analyze deck popularity

**Player Features:**
- Browse available decks
- See selection statistics
- Register with chosen deck
- View full decklists

### Database Schema

**8 New Tables:**
- `cards` - Card database
- `deck_collections` - User collections
- `collection_decks` - Decks in collections
- `collection_deck_cards` - Cards in decks
- `collection_snapshots` - Series/tournament snapshots
- `snapshot_decks` - Decks in snapshots
- `snapshot_deck_cards` - Cards in snapshots
- `player_tournament_decks` - Player selections

**Enhanced Tables:**
- `tournament_formats` - Added `deck_source` column
- `audit_logs` - Added collection/deck entity types

## 🔥 Key Features

### 1. Smart Lineage Tracking
```javascript
// System automatically detects same collection
const snap1 = createTournamentSnapshot(t1, { 
    sourceType: 'series_snapshot' 
}); // v2

const snap2 = createTournamentSnapshot(t2, { 
    sourceType: 'user_collection',
    sourceId: sameCollectionId  // Same as series!
}); // v3 - automatically continues!
```

### 2. Complete Independence
```
User edits collection → Snapshots unchanged
Edit series snapshot → Tournaments unchanged
Edit tournament → Everything else unchanged
```

### 3. Full Traceability
```javascript
// See complete history
const lineage = await getCollectionLineage(seriesId, collectionId);
// v1, v2, v3, v4... across all tournaments

// Compare any two versions
const diff = await compareDeckSnapshots(deck1, deck2);
// Shows added/removed/changed cards
```

## 📊 Example Use Case

### Monthly Tournament Series

```javascript
// Month 1: Create series with collection
const collection = await createCollection(userId, "Meta 2025");
await addDeckToCollection(collection.id, "Branded Despia", "Branded");
await addDeckToCollection(collection.id, "Snake-Eye", "Snake-Eye");

const series = await createSeries("Monthly Regionals");
const seriesSnap = await createSeriesSnapshot(series.id, collection.id);
// v1 created

// Week 1: First tournament
const t1 = await createTournament("Regional #1", formatId, series.id);
const t1Snap = await createTournamentSnapshot(t1.id, {
    sourceType: 'series_snapshot',
    sourceId: seriesSnap.id
});
// v2 created

// Week 2: Tournament from previous
const t2Snap = await createTournamentSnapshot(t2.id, {
    sourceType: 'previous_tournament',
    sourceId: t1Snap.id
});
// v3 created

// Month 2: Update collection (add new deck)
await addDeckToCollection(collection.id, "Purrely", "Purrely");

// Week 5: Use updated collection
const t5Snap = await createTournamentSnapshot(t5.id, {
    sourceType: 'user_collection',
    sourceId: collection.id  // Same ID!
});
// v6 created - lineage continues!
// Now has all 3 decks including new Purrely
```

## 🎯 Testing

### Run All Tests
```bash
node test-deck-collections.js
```

### Expected Output
```
✓ Create user collection
✓ Create deck in collection
✓ Add cards to deck
✓ Create series snapshot from user collection
✓ Create tournament snapshot from series snapshot
✓ Track lineage when reusing same collection
✓ Break lineage with different collection
✓ Player selects deck from tournament pool
✓ Track deck changes across tournaments
... 13 tests total

✓ Passed: 13
✗ Failed: 0
```

## 🔧 Helper Functions

```javascript
import {
    // Collections
    createCollection,
    getUserCollections,
    updateCollection,
    
    // Decks
    addDeckToCollection,
    getCollectionDecks,
    getDeckWithCards,
    addCardToDeck,
    
    // Snapshots
    createSeriesSnapshot,
    createTournamentSnapshot,
    getTournamentSnapshot,
    getCollectionLineage,
    compareDeckSnapshots,
    
    // Player Selection
    selectDeckForTournament,
    getPlayerTournamentDeck,
    getDeckSelectionStats
} from './deck-collection-helpers.js';
```

## 🚦 Getting Started Checklist

- [ ] Read SUMMARY.md
- [ ] Read QUICKSTART.md
- [ ] Run setup.js or migrate.js
- [ ] Run tests
- [ ] Try creating a test collection
- [ ] Review helper functions
- [ ] Plan your API endpoints
- [ ] Start building frontend

## 📈 Next Steps

### Phase 1: Backend (This Week)
1. Create API endpoints using helpers
2. Add authentication/authorization
3. Test with Postman/curl
4. Add validation

### Phase 2: Frontend (Next Week)
1. Collection management UI
2. Deck builder interface
3. Tournament creation flow
4. Player registration page

### Phase 3: Advanced Features
1. Card database integration (YGOProDeck API)
2. Deck import/export (YDK format)
3. Win rate tracking
4. Analytics dashboard
5. Meta game visualization

## 🎓 Learn By Example

Check these files for practical examples:

1. **test-deck-collections.js**
   - See every function in action
   - Real-world test scenarios
   - Edge cases covered

2. **deck-collection-helpers.js**
   - Production-ready implementations
   - Error handling
   - Best practices

3. **QUICKSTART.md**
   - Step-by-step guides
   - Common use cases
   - Integration examples

## 🐛 Common Issues

### "Tables already exist"
Use `migrate.js` instead of `setup.js`

### "Tests failing"
Check database connection in `db.js`

### "Lineage not working"
Verify collection IDs match exactly

### "Can't edit collection"
Collections are always editable - check permissions

## 💡 Pro Tips

1. **Collections**: Name them clearly with dates/versions
2. **Snapshots**: Don't edit after tournament starts
3. **Lineage**: Use same collection ID to continue versions
4. **Testing**: Run tests after any schema changes
5. **Migration**: Always backup before migrating

## 🎉 What's Included

✅ Complete database schema
✅ Migration for existing databases
✅ Comprehensive test suite (13+ tests)
✅ Production-ready helper functions
✅ Full documentation (4 guides)
✅ Visual architecture diagrams
✅ Real-world examples
✅ Analytics capabilities
✅ Rollback support
✅ Best practices guide

## 📞 Quick Reference

```bash
# Setup
node setup.js                    # Fresh database
node migrate.js migrate          # Existing database

# Verify
node migrate.js verify          # Check migration
node test-deck-collections.js   # Run tests

# Rollback
node migrate.js rollback        # Remove all deck tables
```

```javascript
// Basic Flow
const collection = await createCollection(userId, name);
const deck = await addDeckToCollection(collectionId, deckName, archetype);
await addCardToDeck(deckId, cardId, quantity, section);

const seriesSnap = await createSeriesSnapshot(seriesId, collectionId);
const tournSnap = await createTournamentSnapshot(tournamentId, {
    sourceType: 'series_snapshot',
    sourceId: seriesSnap.id
});

await selectDeckForTournament(tournamentId, userId, deckId);
```

## 🏆 Success Metrics

After implementation, you'll have:
- ✅ Users creating deck collections
- ✅ Tournaments using consistent deck pools
- ✅ Full version history across series
- ✅ Players selecting from available decks
- ✅ Analytics on deck popularity
- ✅ Ability to compare deck evolution

## 📖 Documentation Map

```
SUMMARY.md          → Complete overview, start here
    ↓
QUICKSTART.md       → Hands-on getting started
    ↓
ARCHITECTURE.md     → Deep dive into design
    ↓
TEST_README.md      → Testing details
    ↓
deck-collection-helpers.js → Implementation reference
```

## 🚀 Ready to Start?

1. Open **SUMMARY.md** for complete overview
2. Follow **QUICKSTART.md** to get running
3. Review **ARCHITECTURE.md** to understand design
4. Import helper functions and start building!

---

**Built for YGOHub Tournament Management Platform**

*A complete deck collection system with smart lineage tracking and full independence at every level.*
