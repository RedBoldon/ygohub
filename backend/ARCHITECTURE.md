# Deck Collection System Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER PROFILE LEVEL                            │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Deck Collection: "Meta Gauntlet 2025"                        │  │
│  │  User ID: 1                                                    │  │
│  │  Status: LIVING (always editable)                             │  │
│  │                                                                 │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │  │
│  │  │  Branded       │  │  Snake-Eye     │  │  Kashtira      │ │  │
│  │  │  Despia        │  │                │  │                │ │  │
│  │  │                │  │                │  │                │ │  │
│  │  │  40 main       │  │  40 main       │  │  40 main       │ │  │
│  │  │  15 extra      │  │  15 extra      │  │  15 extra      │ │  │
│  │  │  15 side       │  │  15 side       │  │  15 side       │ │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ Create Series
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      TOURNAMENT SERIES LEVEL                         │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Series: "Monthly Regional Series"                            │  │
│  │  Collection Snapshot v1 (snapshot of "Meta Gauntlet 2025")   │  │
│  │  Status: EDITABLE (within series context)                     │  │
│  │                                                                 │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │  │
│  │  │  Branded       │  │  Snake-Eye     │  │  Kashtira      │ │  │
│  │  │  Despia        │  │                │  │                │ │  │
│  │  │  [SNAPSHOT]    │  │  [SNAPSHOT]    │  │  [SNAPSHOT]    │ │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
└───────┬───────────────────────┬───────────────────────┬──────────────┘
        │                       │                       │
        │ Create Tournament #1  │ Create Tournament #2  │ Create Tournament #3
        ▼                       ▼                       ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│    TOURNAMENT #1      │ │    TOURNAMENT #2      │ │    TOURNAMENT #3      │
│                       │ │                       │ │                       │
│  Collection v2        │ │  Collection v3        │ │  Collection v4        │
│  (from series v1)     │ │  (from user - same!)  │ │  (from tournament #2) │
│  Status: EDITABLE     │ │  Status: EDITABLE     │ │  Status: EDITABLE     │
│                       │ │                       │ │                       │
│  ┌─────────────────┐ │ │  ┌─────────────────┐ │ │  ┌─────────────────┐ │
│  │ Branded Despia  │ │ │  │ Branded Despia  │ │ │  │ Branded Despia  │ │
│  │                 │ │ │  │                 │ │ │  │                 │ │
│  │ Selected by:    │ │ │  │ Selected by:    │ │ │  │ Selected by:    │ │
│  │ - Player A      │ │ │  │ - Player D      │ │ │  │ - Player G      │ │
│  │ - Player B      │ │ │  │ - Player E      │ │ │  │ - Player H      │ │
│  └─────────────────┘ │ │  └─────────────────┘ │ │  └─────────────────┘ │
│                       │ │                       │ │                       │
│  ┌─────────────────┐ │ │  ┌─────────────────┐ │ │  ┌─────────────────┐ │
│  │ Snake-Eye       │ │ │  │ Snake-Eye       │ │ │  │ Snake-Eye       │ │
│  │                 │ │ │  │                 │ │ │  │ (MODIFIED!)     │ │
│  │ Selected by:    │ │ │  │ Selected by:    │ │ │  │ Selected by:    │ │
│  │ - Player C      │ │ │  │ - Player F      │ │ │  │ - Player I      │ │
│  └─────────────────┘ │ │  └─────────────────┘ │ │  └─────────────────┘ │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
```

## Lineage Tracking Example

### Same Source Collection (Continues Lineage)

```
Collection ID: 100
Name: "Meta Gauntlet 2025"
Created: 2025-01-15
    │
    ├─► Series Snapshot (ID: 1, v1, source: 100)
    │   Created: 2025-02-01
    │   
    ├─► Tournament #1 (ID: 2, v2, source: 100, parent: 1)
    │   Created: 2025-02-15
    │   Source: Series Snapshot
    │   
    ├─► Tournament #2 (ID: 3, v3, source: 100, parent: 1)
    │   Created: 2025-03-15
    │   Source: User Collection (ID 100 matches!)
    │   ✓ System detects same source → continues lineage
    │   
    └─► Tournament #3 (ID: 4, v4, source: 100, parent: 3)
        Created: 2025-04-15
        Source: Previous Tournament
        ✓ Still same source → continues lineage
```

### Different Source Collection (Breaks Lineage)

```
Collection A (ID: 100)          Collection B (ID: 200)
    │                                   │
    ├─► Series (v1, source: 100)       │
    │                                   │
    ├─► Tournament #1                  │
    │   (v2, source: 100)              │
    │                                   │
    └─► Tournament #2 ◄─────────────────┘
        (v1, source: 200)
        ✗ Different source → NEW lineage starts!
```

## Data Independence Flow

```
USER EDITS COLLECTION
        │
        ▼
    ┌───────┐
    │  NEW  │ ← Does NOT affect snapshots
    │ CARDS │
    └───────┘
        │
        ▼
    No change to:
    ├─ Series Snapshot
    ├─ Tournament #1 Snapshot  
    ├─ Tournament #2 Snapshot
    └─ Tournament #3 Snapshot

ADMIN EDITS SERIES SNAPSHOT
        │
        ▼
    ┌───────┐
    │MODIFY │ ← Does NOT affect user collection
    │ DECK  │    or future tournament snapshots
    └───────┘
        │
        ▼
    No change to:
    ├─ User Collection
    ├─ Tournament #1 (already created)
    └─ Tournament #2 (already created)

ADMIN EDITS TOURNAMENT SNAPSHOT
        │
        ▼
    ┌───────┐
    │MODIFY │ ← Does NOT affect anything else
    │ DECK  │
    └───────┘
        │
        ▼
    No change to:
    ├─ User Collection
    ├─ Series Snapshot
    └─ Other Tournament Snapshots
```

## Database Relationships

```
users
  └─── deck_collections
         └─── collection_decks
                └─── collection_deck_cards
                       └─── cards

tournament_series
  └─── collection_snapshots (type: 'series')
         └─── snapshot_decks
                └─── snapshot_deck_cards
                       └─── cards

tournaments
  └─── collection_snapshots (type: 'tournament')
         └─── snapshot_decks
                └─── snapshot_deck_cards
                       └─── cards

player_tournament_decks
  ├─── tournaments
  ├─── users
  └─── snapshot_decks
```

## Admin Decision Tree for Tournament Creation

```
                    Creating Tournament in Series
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Choose Deck Source:   │
                    └───────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
        ┌──────────────┐ ┌──────────────┐ ┌─────────────┐
        │ Series       │ │ Previous     │ │ User        │
        │ Collection   │ │ Tournament   │ │ Collection  │
        └──────────────┘ └──────────────┘ └─────────────┘
                │               │               │
                ▼               ▼               ▼
        ┌──────────────┐ ┌──────────────┐ ┌─────────────┐
        │ Copy from    │ │ Copy from    │ │ Same ID as  │
        │ Series v1    │ │ Latest v(N)  │ │ series?     │
        │              │ │              │ │             │
        │ → Create vN+1│ │ → Create vN+1│ │ YES │ NO   │
        └──────────────┘ └──────────────┘ └─────┴──────┘
                                                │   │
                                                │   └─► New Lineage (v1)
                                                │
                                                └─► Continue Lineage (vN+1)
```

## Player Registration Flow

```
Player Opens Tournament Registration
        │
        ▼
┌─────────────────────────────┐
│  View Available Decks       │
│  from Tournament Snapshot   │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Player Sees:               │
│  ┌─────────────────────┐   │
│  │ Branded Despia      │   │
│  │ Selected: 2/4       │   │
│  │ [View Decklist]     │   │
│  └─────────────────────┘   │
│  ┌─────────────────────┐   │
│  │ Snake-Eye          │   │
│  │ Selected: 5/∞      │   │
│  │ [View Decklist]     │   │
│  └─────────────────────┘   │
└─────────────────────────────┘
        │
        ▼
Player Selects Deck
        │
        ▼
┌─────────────────────────────┐
│  CREATE RECORD:             │
│  player_tournament_decks    │
│  ├─ tournament_id           │
│  ├─ user_id                 │
│  └─ snapshot_deck_id        │
└─────────────────────────────┘
        │
        ▼
Increment times_selected counter
```

## Version Evolution Example

```
Timeline of "Meta Gauntlet 2025" Collection:

Jan 15  │ User creates collection
        │ └─ v0 (user collection, not versioned)
        │
Feb 1   │ Series created
        │ └─ v1 (series snapshot)
        │     Decks: Branded, Snake-Eye, Kashtira
        │
Feb 15  │ Tournament #1 created from series
        │ └─ v2 (tournament snapshot)
        │     Decks: Branded, Snake-Eye, Kashtira
        │
Feb 20  │ User adds Purrely to original collection
        │ └─ v0 (user collection updated)
        │     ✓ Series v1 unchanged
        │     ✓ Tournament #1 v2 unchanged
        │
Mar 15  │ Tournament #2 from user collection
        │ └─ v3 (tournament snapshot)
        │     System: "Same source ID! Continue lineage."
        │     Decks: Branded, Snake-Eye, Kashtira, Purrely
        │
Apr 1   │ Admin tweaks Tournament #2 collection
        │ └─ v3 (still v3, just edited)
        │     Removed: Kashtira
        │     ✓ User collection unchanged
        │     ✓ Series v1 unchanged
        │     ✓ Tournament #1 v2 unchanged
        │
Apr 15  │ Tournament #3 from Tournament #2
        │ └─ v4 (tournament snapshot)
        │     Decks: Branded, Snake-Eye, Purrely
        │     (Kashtira still removed from v3)
```

## Summary

### Key Principles

1. **User collections are always editable**
   - Live, working versions
   - Changes don't affect any snapshots

2. **Snapshots are independent**
   - Created at moment of series/tournament creation
   - Can be edited without affecting source
   - Can be edited without affecting other snapshots

3. **Lineage tracking is automatic**
   - Same source_collection_id = continues lineage
   - Different source_collection_id = new lineage
   - Version numbers increment automatically

4. **Full traceability**
   - Can trace any snapshot back to original collection
   - Can see evolution across entire series
   - Can compare any two snapshots

5. **Player selection is simple**
   - Players choose from tournament snapshot
   - No copying or creating new versions
   - Just a reference to the snapshot deck
