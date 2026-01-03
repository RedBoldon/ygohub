import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../hooks/useToast';
import { api } from '../api/client';
import { Search, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';
import './CardSearch.css';

const FRAME_TYPES = [
  { value: 'spell', label: 'Spell' },
  { value: 'trap', label: 'Trap' },
  { value: 'normal', label: 'Normal Monster' },
  { value: 'effect', label: 'Effect Monster' },
  { value: 'ritual', label: 'Ritual Monster' },
  { value: 'fusion', label: 'Fusion Monster' },
  { value: 'synchro', label: 'Synchro Monster' },
  { value: 'xyz', label: 'Xyz Monster' },
  { value: 'link', label: 'Link Monster' },
  { value: 'effect_pendulum', label: 'Pendulum Monster' },
];

const ATTRIBUTES = ['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND', 'DIVINE'];

export default function CardSearch() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    frametype: '',
    attribute: '',
    archetype: '',
    race: '',
    level: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searched, setSearched] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  const toast = useToast();
  const limit = 24;

  const handleSearch = useCallback(async (newPage = 0) => {
    setLoading(true);
    setSearched(true);
    setPage(newPage);

    try {
      const params = {
        name: query,
        ...filters,
        limit,
        offset: newPage * limit,
      };

      const data = await api.cards.search(params);
      setResults(data.cards || []);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error('Search failed');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [query, filters, toast]);

  // Auto-search on query change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query || Object.values(filters).some(v => v)) {
        handleSearch(0);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, filters]);

  const clearFilters = () => {
    setFilters({
      frametype: '',
      attribute: '',
      archetype: '',
      race: '',
      level: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v);
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Card Database</h1>
        <p className="page-subtitle">Search over 13,000 Yu-Gi-Oh! cards</p>
      </div>

      {/* Search Form */}
      <div className="search-form card">
        <div className="search-row">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="input search-input"
              placeholder="Search by card name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery('')}>
                <X size={16} />
              </button>
            )}
          </div>
          <button
            type="button"
            className={`btn btn-secondary filter-toggle ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            Filters
            {hasActiveFilters && <span className="filter-badge"></span>}
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="filters-panel">
            <div className="filters-grid">
              <div className="input-group">
                <label>Card Type</label>
                <select
                  className="input"
                  value={filters.frametype}
                  onChange={(e) => setFilters(f => ({ ...f, frametype: e.target.value }))}
                >
                  <option value="">All Types</option>
                  {FRAME_TYPES.map(ft => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Attribute</label>
                <select
                  className="input"
                  value={filters.attribute}
                  onChange={(e) => setFilters(f => ({ ...f, attribute: e.target.value }))}
                >
                  <option value="">All Attributes</option>
                  {ATTRIBUTES.map(attr => (
                    <option key={attr} value={attr}>{attr}</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Archetype</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Blue-Eyes"
                  value={filters.archetype}
                  onChange={(e) => setFilters(f => ({ ...f, archetype: e.target.value }))}
                />
              </div>

              <div className="input-group">
                <label>Monster Type</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Dragon"
                  value={filters.race}
                  onChange={(e) => setFilters(f => ({ ...f, race: e.target.value }))}
                />
              </div>

              <div className="input-group">
                <label>Level/Rank</label>
                <input
                  type="number"
                  className="input"
                  placeholder="1-12"
                  min="1"
                  max="13"
                  value={filters.level}
                  onChange={(e) => setFilters(f => ({ ...f, level: e.target.value }))}
                />
              </div>
            </div>

            {hasActiveFilters && (
              <button type="button" className="btn btn-ghost clear-filters" onClick={clearFilters}>
                <X size={16} />
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      ) : searched ? (
        results.length === 0 ? (
          <div className="empty-state">
            <Search size={48} />
            <h3>No Cards Found</h3>
            <p>Try adjusting your search or filters.</p>
          </div>
        ) : (
          <>
            <div className="results-header">
              <span className="results-count">{total} cards found</span>
              {totalPages > 1 && (
                <div className="pagination">
                  <button 
                    className="btn btn-ghost btn-sm"
                    disabled={page === 0}
                    onClick={() => handleSearch(page - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="page-info">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button 
                    className="btn btn-ghost btn-sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => handleSearch(page + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="results-grid">
              {results.map(card => (
                <div 
                  key={card.id} 
                  className={`result-card result-card-${card.frametype}`}
                  onClick={() => setSelectedCard(card)}
                >
                  <h3 className="result-name">{card.name}</h3>
                  <div className="result-meta">
                    <span className="result-type">{card.humanreadablecardtype}</span>
                    {card.attribute && <span className="result-attr">{card.attribute}</span>}
                  </div>
                  <p className="result-desc">{card.description}</p>
                  {(card.atk !== null || card.def !== null) && (
                    <div className="result-stats">
                      {card.level !== null && <span>LV{card.level}</span>}
                      {card.atk !== null && <span>ATK/{card.atk}</span>}
                      {card.def !== null && <span>DEF/{card.def}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination-bottom">
                <button 
                  className="btn btn-secondary"
                  disabled={page === 0}
                  onClick={() => handleSearch(page - 1)}
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <span className="page-info">
                  Page {page + 1} of {totalPages}
                </span>
                <button 
                  className="btn btn-secondary"
                  disabled={page >= totalPages - 1}
                  onClick={() => handleSearch(page + 1)}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )
      ) : (
        <div className="search-prompt">
          <Search size={64} className="prompt-icon" />
          <h3>Search the Card Database</h3>
          <p>Enter a card name or use filters to find cards.</p>
        </div>
      )}

      {/* Card Detail Modal */}
      {selectedCard && (
        <div className="modal-overlay" onClick={() => setSelectedCard(null)}>
          <div className={`card-detail-modal card-detail-${selectedCard.frametype}`} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedCard(null)}>
              <X size={20} />
            </button>
            <div className="card-detail-header">
              <h2>{selectedCard.name}</h2>
              {selectedCard.attribute && (
                <span className="detail-attr">{selectedCard.attribute}</span>
              )}
            </div>
            <div className="card-detail-type">
              {selectedCard.humanreadablecardtype}
              {selectedCard.race && ` / ${selectedCard.race}`}
            </div>
            {selectedCard.archetype && (
              <div className="card-detail-archetype">
                Archetype: {selectedCard.archetype}
              </div>
            )}
            <p className="card-detail-desc">{selectedCard.description}</p>
            {(selectedCard.atk !== null || selectedCard.def !== null || selectedCard.level !== null) && (
              <div className="card-detail-stats">
                {selectedCard.level !== null && (
                  <div className="detail-stat">
                    <span className="stat-label">Level</span>
                    <span className="stat-value">{selectedCard.level}</span>
                  </div>
                )}
                {selectedCard.atk !== null && (
                  <div className="detail-stat">
                    <span className="stat-label">ATK</span>
                    <span className="stat-value">{selectedCard.atk}</span>
                  </div>
                )}
                {selectedCard.def !== null && (
                  <div className="detail-stat">
                    <span className="stat-label">DEF</span>
                    <span className="stat-value">{selectedCard.def}</span>
                  </div>
                )}
              </div>
            )}
            <div className="card-detail-id">
              Card ID: {selectedCard.id}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
