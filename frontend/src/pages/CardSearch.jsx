import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import './CardSearch.css';

// Note: This is a placeholder - your backend needs a /cards endpoint
// For now this shows the UI structure

export default function CardSearch() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    attribute: '',
    archetype: '',
    frameType: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const FRAME_TYPES = [
    'spell', 'effect', 'normal', 'link', 'trap', 'fusion',
    'xyz', 'synchro', 'ritual'
  ];

  const ATTRIBUTES = ['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND', 'DIVINE'];

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() && !Object.values(filters).some(v => v)) return;

    setLoading(true);
    setSearched(true);

    try {
      // TODO: Implement card search API endpoint
      // const params = { name: query, ...filters };
      // const data = await api.cards.search(params);
      // setResults(data.cards || []);
      
      // Placeholder message
      setResults([]);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      attribute: '',
      archetype: '',
      frameType: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Card Database</h1>
        <p className="page-subtitle">Search over 13,000 Yu-Gi-Oh! cards</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="search-form card">
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
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="filters-panel">
            <div className="filters-grid">
              <div className="input-group">
                <label>Frame Type</label>
                <select
                  className="input"
                  value={filters.frameType}
                  onChange={(e) => setFilters(f => ({ ...f, frameType: e.target.value }))}
                >
                  <option value="">All Types</option>
                  {FRAME_TYPES.map(ft => (
                    <option key={ft} value={ft}>{ft}</option>
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
                <label>Card Type</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Dragon"
                  value={filters.type}
                  onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
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
      </form>

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
            <p className="search-note">
              Note: The card search API endpoint needs to be implemented in your backend.
            </p>
          </div>
        ) : (
          <div className="results-grid">
            {results.map(card => (
              <div key={card.id} className={`result-card result-card-${card.frametype}`}>
                <h3 className="result-name">{card.name}</h3>
                <div className="result-type">{card.humanreadablecardtype}</div>
                <p className="result-desc">{card.description}</p>
                {(card.atk !== null || card.def !== null) && (
                  <div className="result-stats">
                    {card.atk !== null && <span>ATK/{card.atk}</span>}
                    {card.def !== null && <span>DEF/{card.def}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="search-prompt">
          <Search size={64} className="prompt-icon" />
          <h3>Search the Card Database</h3>
          <p>Enter a card name or use filters to find cards.</p>
        </div>
      )}
    </div>
  );
}
