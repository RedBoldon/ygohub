import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import { api } from '../api/client';
import { 
  ArrowLeft, 
  Plus, 
  Minus,
  Trash2, 
  BookOpen, 
  Search,
  X,
  ChevronDown,
  ChevronUp,
  History,
  Trophy,
  PlusCircle,
  MinusCircle,
  ArrowUpDown
} from 'lucide-react';
import Modal from '../components/Modal';
import './DeckDetail.css';

export default function DeckDetail() {
  const { id } = useParams();
  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  
  // Card search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedSection, setSelectedSection] = useState('main');

  // History modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyDeckName, setHistoryDeckName] = useState('');

  const toast = useToast();

  useEffect(() => {
    loadDeck();
  }, [id]);

  const loadDeck = async () => {
    try {
      const data = await api.collections.getDeck(id);
      setDeck(data.deck);
      
      // Load stats
      const statsData = await api.collections.getDeckStats(id);
      setStats(statsData.stats);
    } catch (err) {
      toast.error('Failed to load deck');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const data = await api.collections.getDeckHistory(id);
      setHistory(data.history || []);
      setHistoryDeckName(data.deckName || deck?.deck_name || 'Deck');
    } catch (err) {
      toast.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const searchCards = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const data = await api.cards.search({ name: searchQuery, limit: 20 });
      setSearchResults(data.cards || []);
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchCards();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchCards]);

  const addCardToDeck = async (card) => {
    // Check if card already in deck (any section)
    const existingCard = deck.cards?.find(c => c.id === card.id);
    const currentQty = existingCard ? 
      deck.cards.filter(c => c.id === card.id).reduce((sum, c) => sum + c.quantity, 0) : 0;

    if (currentQty >= 3) {
      toast.error('Maximum 3 copies per card');
      return;
    }

    // Determine section based on card type
    let section = selectedSection;
    const extraTypes = ['fusion', 'synchro', 'xyz', 'link'];
    if (extraTypes.some(t => card.frametype?.includes(t))) {
      section = 'extra';
    }

    try {
      await api.collections.addCard(id, card.id, 1, section);
      toast.success(`Added ${card.name}`);
      loadDeck();
    } catch (err) {
      toast.error(err.message || 'Failed to add card');
    }
  };

  const updateCardQuantity = async (card, delta) => {
    const newQty = card.quantity + delta;
    
    if (newQty <= 0) {
      await removeCard(card);
      return;
    }

    if (newQty > 3) {
      toast.error('Maximum 3 copies per card');
      return;
    }

    // Check total copies across sections
    const totalOther = deck.cards
      .filter(c => c.id === card.id && c.deck_section !== card.deck_section)
      .reduce((sum, c) => sum + c.quantity, 0);

    if (totalOther + newQty > 3) {
      toast.error('Maximum 3 copies per card total');
      return;
    }

    try {
      await api.collections.updateCard(id, card.id, newQty, card.deck_section);
      loadDeck();
    } catch (err) {
      toast.error(err.message || 'Failed to update card');
    }
  };

  const removeCard = async (card) => {
    try {
      await api.collections.removeCard(id, card.id, card.deck_section);
      toast.success(`Removed ${card.name}`);
      loadDeck();
    } catch (err) {
      toast.error(err.message || 'Failed to remove card');
    }
  };

  const moveCard = async (card, newSection) => {
    if (card.deck_section === newSection) return;

    try {
      // Remove from old section
      await api.collections.removeCard(id, card.id, card.deck_section);
      // Add to new section
      await api.collections.addCard(id, card.id, card.quantity, newSection);
      loadDeck();
    } catch (err) {
      toast.error(err.message || 'Failed to move card');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="container">
        <div className="empty-state">
          <BookOpen size={64} />
          <h3>Deck Not Found</h3>
          <Link to="/collections" className="btn btn-primary mt-3">
            Back to Collections
          </Link>
        </div>
      </div>
    );
  }

  const mainDeck = deck.cards?.filter(c => c.deck_section === 'main') || [];
  const extraDeck = deck.cards?.filter(c => c.deck_section === 'extra') || [];
  const sideDeck = deck.cards?.filter(c => c.deck_section === 'side') || [];

  const mainCount = mainDeck.reduce((sum, c) => sum + c.quantity, 0);
  const extraCount = extraDeck.reduce((sum, c) => sum + c.quantity, 0);
  const sideCount = sideDeck.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <div className="container deck-builder">
      <div className="page-header">
        <Link to={`/collections/${deck.collection_id}`} className="back-link">
          <ArrowLeft size={18} />
          Back to Collection
        </Link>
        <div className="deck-header">
          <div>
            <h1 className="page-title">{deck.deck_name}</h1>
            {deck.archetype && (
              <span className="deck-archetype-badge">{deck.archetype}</span>
            )}
          </div>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={loadHistory}>
              <History size={18} />
              Check History
            </button>
            <button className="btn btn-primary" onClick={() => setSearchOpen(true)}>
              <Plus size={18} />
              Add Cards
            </button>
          </div>
        </div>
      </div>

      {/* Deck Stats */}
      {stats && (
        <div className="deck-stats-bar">
          <div className="stat-item">
            <span className="stat-label">Main</span>
            <span className={`stat-value ${mainCount < 40 || mainCount > 60 ? 'invalid' : ''}`}>
              {mainCount}/40-60
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Extra</span>
            <span className={`stat-value ${extraCount > 15 ? 'invalid' : ''}`}>
              {extraCount}/15
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Side</span>
            <span className={`stat-value ${sideCount > 15 ? 'invalid' : ''}`}>
              {sideCount}/15
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total</span>
            <span className="stat-value">{mainCount + extraCount + sideCount}</span>
          </div>
        </div>
      )}

      <div className="deck-sections">
        {/* Main Deck */}
        <DeckSection 
          title="Main Deck" 
          cards={mainDeck}
          count={mainCount}
          maxCount="40-60"
          onQuantityChange={updateCardQuantity}
          onRemove={removeCard}
          onMove={moveCard}
          section="main"
        />

        {/* Extra Deck */}
        <DeckSection 
          title="Extra Deck" 
          cards={extraDeck}
          count={extraCount}
          maxCount={15}
          onQuantityChange={updateCardQuantity}
          onRemove={removeCard}
          onMove={moveCard}
          section="extra"
        />

        {/* Side Deck */}
        <DeckSection 
          title="Side Deck" 
          cards={sideDeck}
          count={sideCount}
          maxCount={15}
          onQuantityChange={updateCardQuantity}
          onRemove={removeCard}
          onMove={moveCard}
          section="side"
        />
      </div>

      {/* Card Search Modal */}
      <Modal
        isOpen={searchOpen}
        onClose={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); }}
        title="Add Cards"
      >
        <div className="card-search">
          <div className="search-header">
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="input search-input"
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button 
                  className="search-clear"
                  onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="section-select">
              <label>Add to:</label>
              <select 
                className="input"
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
              >
                <option value="main">Main Deck</option>
                <option value="extra">Extra Deck</option>
                <option value="side">Side Deck</option>
              </select>
            </div>
          </div>

          <div className="search-results">
            {searching ? (
              <div className="loading-container">
                <div className="spinner"></div>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map(card => (
                <SearchResultCard 
                  key={card.id}
                  card={card}
                  deckCards={deck.cards}
                  onAdd={() => addCardToDeck(card)}
                />
              ))
            ) : searchQuery ? (
              <p className="no-results">No cards found</p>
            ) : (
              <p className="search-hint">Type to search the card database</p>
            )}
          </div>
        </div>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`History: ${historyDeckName}`}
      >
        {historyLoading ? (
          <div className="loading-container">
            <div className="spinner"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state-small">
            <History size={48} />
            <h4>No Tournament History</h4>
            <p>This deck hasn't been used in any tournaments yet.</p>
          </div>
        ) : (
          <div className="history-list">
            {history.map((entry, index) => (
              <div key={entry.snapshotDeckId} className="history-entry">
                <div className="history-header">
                  <div className="history-tournament">
                    <Trophy size={16} />
                    <Link to={`/tournaments/${entry.tournament.id}`} className="history-tournament-name">
                      {entry.tournament.name}
                    </Link>
                    <span className={`badge badge-sm badge-${getStatusColor(entry.tournament.status)}`}>
                      {entry.tournament.status}
                    </span>
                  </div>
                  <div className="history-meta">
                    <span className="history-card-count">{entry.cardCount} cards</span>
                    <span className="history-date">{new Date(entry.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {entry.changes ? (
                  <div className="history-changes">
                    {entry.changes.added.length > 0 && (
                      <div className="history-change added">
                        <PlusCircle size={14} />
                        <div className="change-list">
                          {entry.changes.added.map((c, i) => (
                            <span key={i} className="change-item">
                              +{c.quantity} {c.name} <small>({c.section})</small>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {entry.changes.removed.length > 0 && (
                      <div className="history-change removed">
                        <MinusCircle size={14} />
                        <div className="change-list">
                          {entry.changes.removed.map((c, i) => (
                            <span key={i} className="change-item">
                              -{c.quantity} {c.name} <small>({c.section})</small>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {entry.changes.changed.length > 0 && (
                      <div className="history-change modified">
                        <ArrowUpDown size={14} />
                        <div className="change-list">
                          {entry.changes.changed.map((c, i) => (
                            <span key={i} className="change-item">
                              {c.name}: {c.from} → {c.to} <small>({c.section})</small>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {entry.changes.added.length === 0 && entry.changes.removed.length === 0 && entry.changes.changed.length === 0 && (
                      <div className="history-no-changes">No changes from previous snapshot</div>
                    )}
                  </div>
                ) : (
                  <div className="history-initial">Initial snapshot</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function DeckSection({ title, cards, count, maxCount, onQuantityChange, onRemove, onMove, section }) {
  const [collapsed, setCollapsed] = useState(false);

  // Group cards by type for display
  const monsters = cards.filter(c => !['spell', 'trap'].includes(c.frametype));
  const spells = cards.filter(c => c.frametype === 'spell');
  const traps = cards.filter(c => c.frametype === 'trap');

  return (
    <section className="deck-section">
      <div className="section-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="section-title-row">
          <h2 className="section-title">{title}</h2>
          <span className="section-count">{count}/{maxCount}</span>
        </div>
        {collapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
      </div>
      
      {!collapsed && (
        <div className="section-content">
          {cards.length === 0 ? (
            <p className="section-empty">No cards</p>
          ) : (
            <>
              {monsters.length > 0 && (
                <div className="card-group">
                  <h4 className="group-title">Monsters ({monsters.reduce((s, c) => s + c.quantity, 0)})</h4>
                  <div className="cards-list">
                    {monsters.map((card, i) => (
                      <DeckCard 
                        key={`${card.id}-${card.deck_section}-${i}`}
                        card={card}
                        onQuantityChange={onQuantityChange}
                        onRemove={onRemove}
                        onMove={onMove}
                        currentSection={section}
                      />
                    ))}
                  </div>
                </div>
              )}
              {spells.length > 0 && (
                <div className="card-group">
                  <h4 className="group-title">Spells ({spells.reduce((s, c) => s + c.quantity, 0)})</h4>
                  <div className="cards-list">
                    {spells.map((card, i) => (
                      <DeckCard 
                        key={`${card.id}-${card.deck_section}-${i}`}
                        card={card}
                        onQuantityChange={onQuantityChange}
                        onRemove={onRemove}
                        onMove={onMove}
                        currentSection={section}
                      />
                    ))}
                  </div>
                </div>
              )}
              {traps.length > 0 && (
                <div className="card-group">
                  <h4 className="group-title">Traps ({traps.reduce((s, c) => s + c.quantity, 0)})</h4>
                  <div className="cards-list">
                    {traps.map((card, i) => (
                      <DeckCard 
                        key={`${card.id}-${card.deck_section}-${i}`}
                        card={card}
                        onQuantityChange={onQuantityChange}
                        onRemove={onRemove}
                        onMove={onMove}
                        currentSection={section}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function DeckCard({ card, onQuantityChange, onRemove, onMove, currentSection }) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div className={`deck-card-item deck-card-${card.frametype}`}>
      <div className="card-main" onClick={() => setShowActions(!showActions)}>
        <div className="card-info">
          <span className="card-name">{card.name}</span>
          <span className="card-type-small">{card.humanreadablecardtype}</span>
        </div>
        <div className="card-quantity">
          <button 
            className="qty-btn"
            onClick={(e) => { e.stopPropagation(); onQuantityChange(card, -1); }}
          >
            <Minus size={14} />
          </button>
          <span className="qty-value">×{card.quantity}</span>
          <button 
            className="qty-btn"
            onClick={(e) => { e.stopPropagation(); onQuantityChange(card, 1); }}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      
      {showActions && (
        <div className="card-actions">
          {currentSection !== 'main' && (
            <button className="action-btn" onClick={() => onMove(card, 'main')}>
              → Main
            </button>
          )}
          {currentSection !== 'extra' && card.frametype && 
           ['fusion', 'synchro', 'xyz', 'link'].some(t => card.frametype.includes(t)) && (
            <button className="action-btn" onClick={() => onMove(card, 'extra')}>
              → Extra
            </button>
          )}
          {currentSection !== 'side' && (
            <button className="action-btn" onClick={() => onMove(card, 'side')}>
              → Side
            </button>
          )}
          <button className="action-btn danger" onClick={() => onRemove(card)}>
            <Trash2 size={14} /> Remove
          </button>
        </div>
      )}
    </div>
  );
}

function SearchResultCard({ card, deckCards, onAdd }) {
  const currentInDeck = deckCards?.filter(c => c.id === card.id).reduce((sum, c) => sum + c.quantity, 0) || 0;
  const canAdd = currentInDeck < 3;

  return (
    <div className={`search-result-card search-card-${card.frametype}`}>
      <div className="result-info">
        <span className="result-name">{card.name}</span>
        <span className="result-type">{card.humanreadablecardtype}</span>
        {(card.atk !== null || card.def !== null) && (
          <span className="result-stats">
            {card.atk !== null && `ATK/${card.atk}`}
            {card.def !== null && ` DEF/${card.def}`}
          </span>
        )}
      </div>
      <div className="result-actions">
        {currentInDeck > 0 && (
          <span className="in-deck-badge">×{currentInDeck}</span>
        )}
        <button 
          className="btn btn-sm btn-primary"
          onClick={onAdd}
          disabled={!canAdd}
        >
          {canAdd ? <Plus size={16} /> : 'Max'}
        </button>
      </div>
    </div>
  );
}

function getStatusColor(status) {
  return { open: 'green', in_progress: 'blue', completed: 'gold', cancelled: 'red' }[status] || 'gold';
}
