# Card Database Import Guide

## Overview

The card database system imports all Yu-Gi-Oh! cards from `cards.json` into PostgreSQL for fast querying and deck building.

## Card Data Structure

### Fields Imported

```javascript
{
  id: 34541863,                              // Card ID (primary key)
  name: '"A" Cell Breeding Device',          // Card name
  type: 'Spell Card',                        // Type
  humanReadableCardType: 'Continuous Spell', // Readable type
  frameType: 'spell',                        // Frame type
  desc: 'Card effect description...',        // Description
  race: 'Continuous',                        // Race/subtype
  archetype: 'Alien',                        // Archetype (nullable)
  
  // Monster-only fields (nullable)
  atk: 2500,
  def: 2000,
  level: 7,
  attribute: 'EARTH'
}
```

### Fields NOT Imported

- `ygoprodeck_url` - External URL
- `card_sets` - Print history
- `card_images` - Image URLs (will be handled locally)
- `card_prices` - Price data

## Quick Start

### 1. Run Database Setup

```bash
# Fresh database
node setup.js

# OR existing database
node migrate.js migrate
```

### 2. Import Cards

```bash
node import-cards.js
```

Expected output:
```
========================================
Yu-Gi-Oh! Card Database Import
========================================

Step 1: Reading cards.json...
✓ Found 13,000+ cards in file

Step 2: Clearing existing cards...
✓ Existing cards cleared

Step 3: Processing cards...
Statistics:
  Total Cards: 13,456
  Monsters: 8,234
  Spells: 2,987
  Traps: 2,235
  With Archetype: 7,890

Step 4: Inserting cards into database...
  Progress: 13456/13456 (100.0%)
✓ All cards imported successfully

Step 5: Verifying import...
✓ Database contains 13456 cards

Sample cards:
  - "A" Cell Breeding Device (Continuous Spell, Alien)
  - 3-Hump Lacooda (Effect Monster, Beast)
  ...

========================================
✓ Card Import Complete!
========================================
```

## Using the Card Database

### Search Cards

```javascript
import { searchCards } from './import-cards.js';

// Search by name
const results = await searchCards('Dark Magician', 10);
console.log(results);
// [
//   { id: 46986414, name: 'Dark Magician', type: 'Normal Monster', ... },
//   { id: 38033121, name: 'Dark Magician Girl', type: 'Effect Monster', ... },
//   ...
// ]
```

### Get Card by ID

```javascript
import { getCardById } from './import-cards.js';

const card = await getCardById(46986414);
console.log(card);
// {
//   id: 46986414,
//   name: 'Dark Magician',
//   type: 'Normal Monster',
//   humanReadableCardType: 'Normal Monster',
//   frameType: 'normal',
//   desc: 'The ultimate wizard...',
//   race: 'Spellcaster',
//   archetype: 'Dark Magician',
//   atk: 2500,
//   def: 2100,
//   level: 7,
//   attribute: 'DARK'
// }
```

### Get Cards by Archetype

```javascript
import { getCardsByArchetype } from './import-cards.js';

const branded = await getCardsByArchetype('Branded', 50);
console.log(branded.length); // All Branded cards
```

### Get Database Statistics

```javascript
import { getCardStats } from './import-cards.js';

const stats = await getCardStats();
console.log(stats);
// {
//   total_cards: '13456',
//   monsters: '8234',
//   spells: '2987',
//   traps: '2235',
//   effect_monsters: '6789',
//   fusion_monsters: '567',
//   synchro_monsters: '432',
//   xyz_monsters: '234',
//   link_monsters: '212',
//   unique_archetypes: '456'
// }
```

## Database Queries

### Search by Name (Case-Insensitive)

```sql
SELECT * FROM cards 
WHERE name ILIKE '%blue-eyes%'
ORDER BY name;
```

### Find All Monsters of a Level

```sql
SELECT name, atk, def, attribute 
FROM cards 
WHERE level = 4 
AND frameType NOT IN ('spell', 'trap')
ORDER BY atk DESC;
```

### Get All Cards in Archetype

```sql
SELECT name, type, atk, def 
FROM cards 
WHERE archetype = 'Blue-Eyes'
ORDER BY name;
```

### Find High ATK Monsters

```sql
SELECT name, atk, def, level 
FROM cards 
WHERE atk >= 3000 
AND frameType NOT IN ('spell', 'trap')
ORDER BY atk DESC;
```

### Search by Multiple Criteria

```sql
SELECT name, type, atk, def, level, attribute
FROM cards 
WHERE frameType = 'effect'
AND attribute = 'DARK'
AND level = 4
AND atk >= 1800
ORDER BY atk DESC;
```

## Integration with Deck Builder

### Add Card to Deck (Example)

```javascript
import { addCardToDeck } from './deck-collection-helpers.js';

// User searches for card
const results = await searchCards('Ash Blossom');
const ashBlossom = results[0]; // { id: 14558127, name: 'Ash Blossom & Joyous Spring', ... }

// Add to deck
await addCardToDeck(
    deckId,
    ashBlossom.id,  // Use the card's ID
    3,              // Quantity
    'main'          // Section
);
```

### Full Deck Builder Flow

```javascript
// 1. Search cards
const searchResults = await searchCards(searchTerm);

// 2. User selects card
const selectedCard = searchResults[selectedIndex];

// 3. Determine deck section based on card type
let section = 'main';
if (['fusion', 'synchro', 'xyz', 'link'].includes(selectedCard.frameType)) {
    section = 'extra';
}

// 4. Add to deck
await addCardToDeck(deckId, selectedCard.id, quantity, section);

// 5. Get updated deck
const deck = await getDeckWithCards(deckId);
```

## Performance

### Indexes Created

The following indexes are automatically created for fast searches:

```sql
idx_cards_name           -- Fast name searches
idx_cards_type           -- Filter by type
idx_cards_frametype      -- Filter by frame
idx_cards_archetype      -- Archetype searches
idx_cards_race           -- Race/subtype searches
idx_cards_attribute      -- Attribute searches
idx_cards_level          -- Level searches
```

### Batch Import

The import script uses batch inserts (500 cards at a time) for optimal performance:

```javascript
// Imports 13,000+ cards in ~5-10 seconds
```

## Updating Cards

### Re-import (Updates Existing)

```bash
node import-cards.js
```

The script uses `ON CONFLICT` to update existing cards:
- Preserves card ID
- Updates all other fields
- No duplicate entries

### Manual Update

```sql
UPDATE cards 
SET desc = 'Updated description'
WHERE id = 46986414;
```

## API Endpoint Examples

### Search Endpoint

```javascript
app.get('/api/cards/search', async (req, res) => {
    const { q, limit = 20 } = req.query;
    
    try {
        const results = await searchCards(q, parseInt(limit));
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Usage: GET /api/cards/search?q=Dark%20Magician&limit=10
```

### Get Card Details

```javascript
app.get('/api/cards/:id', async (req, res) => {
    try {
        const card = await getCardById(parseInt(req.params.id));
        if (!card) {
            return res.status(404).json({ error: 'Card not found' });
        }
        res.json(card);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Usage: GET /api/cards/46986414
```

### Get Archetype Cards

```javascript
app.get('/api/cards/archetype/:archetype', async (req, res) => {
    const { limit = 50 } = req.query;
    
    try {
        const cards = await getCardsByArchetype(
            req.params.archetype,
            parseInt(limit)
        );
        res.json(cards);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Usage: GET /api/cards/archetype/Branded?limit=30
```

### Advanced Search

```javascript
app.post('/api/cards/advanced-search', async (req, res) => {
    const { 
        name, 
        frameType, 
        attribute, 
        level, 
        minAtk, 
        maxAtk,
        archetype 
    } = req.body;
    
    let query = 'SELECT * FROM cards WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (name) {
        query += ` AND name ILIKE $${paramIndex}`;
        params.push(`%${name}%`);
        paramIndex++;
    }
    
    if (frameType) {
        query += ` AND frameType = $${paramIndex}`;
        params.push(frameType);
        paramIndex++;
    }
    
    if (attribute) {
        query += ` AND attribute = $${paramIndex}`;
        params.push(attribute);
        paramIndex++;
    }
    
    if (level) {
        query += ` AND level = $${paramIndex}`;
        params.push(level);
        paramIndex++;
    }
    
    if (minAtk) {
        query += ` AND atk >= $${paramIndex}`;
        params.push(minAtk);
        paramIndex++;
    }
    
    if (maxAtk) {
        query += ` AND atk <= $${paramIndex}`;
        params.push(maxAtk);
        paramIndex++;
    }
    
    if (archetype) {
        query += ` AND archetype = $${paramIndex}`;
        params.push(archetype);
        paramIndex++;
    }
    
    query += ' ORDER BY name LIMIT 100';
    
    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

## Troubleshooting

### Import Fails

**Problem:** "Cannot read property 'id' of undefined"
**Solution:** Ensure cards.json is in backend folder

**Problem:** "Duplicate key value violates unique constraint"
**Solution:** Clear existing cards first (done automatically)

**Problem:** "Out of memory"
**Solution:** Reduce BATCH_SIZE in import-cards.js

### Search Issues

**Problem:** No results for valid card name
**Solution:** Check for typos, use ILIKE for case-insensitive

**Problem:** Slow searches
**Solution:** Ensure indexes are created (automatic)

## Next Steps

1. ✅ Import cards
2. Build search UI
3. Add autocomplete
4. Implement deck validation
5. Add card images (local storage)

## File Reference

- `cards.json` - Source data (13,000+ cards)
- `import-cards.js` - Import script + helper functions
- `setup.js` - Includes cards table schema
- `deck-collection-helpers.js` - Uses card IDs

## Card ID Format

**Important:** Card IDs are integers (BIGINT), not strings!

```javascript
// ✅ Correct
const cardId = 46986414;
await addCardToDeck(deckId, cardId, 3, 'main');

// ❌ Wrong
const cardId = '46986414'; // String
await addCardToDeck(deckId, cardId, 3, 'main'); // Will fail
```

## Success Checklist

- [ ] cards.json in backend folder
- [ ] Database tables created
- [ ] Import script executed
- [ ] Verify card count (13,000+)
- [ ] Test search functionality
- [ ] Test adding cards to decks
- [ ] API endpoints working
