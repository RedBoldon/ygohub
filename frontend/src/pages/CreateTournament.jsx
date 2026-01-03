import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import { api } from '../api/client';
import { Trophy, Users, MapPin, Hash, Layers, Plus, BookOpen } from 'lucide-react';
import './CreateTournament.css';

export default function CreateTournament() {
  const [formData, setFormData] = useState({
    name: '',
    minPlayerCount: 2,
    maxPlayerCount: '',
    location: '',
    numberOfRounds: '',
    seriesId: '',
    newSeriesName: '',
    deckMode: 'player',
    collectionId: '',
  });
  const [series, setSeries] = useState([]);
  const [collections, setCollections] = useState([]);
  const [showNewSeries, setShowNewSeries] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [seriesData, collectionsData] = await Promise.all([
        api.tournaments.listSeries().catch(err => { console.error('Series error:', err); return { series: [] }; }),
        api.collections.list().catch(err => { console.error('Collections error:', err); return { collections: [] }; })
      ]);
      console.log('Loaded series:', seriesData);
      console.log('Loaded collections:', collectionsData);
      setSeries(seriesData.series || []);
      setCollections(collectionsData.collections || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // If selecting "new" series option
    if (name === 'seriesId' && value === 'new') {
      setShowNewSeries(true);
      setFormData(prev => ({ ...prev, seriesId: '' }));
    } else if (name === 'seriesId') {
      setShowNewSeries(false);
      setFormData(prev => ({ ...prev, newSeriesName: '' }));
    }
    
    // Reset collection if switching to player mode
    if (name === 'deckMode' && value === 'player') {
      setFormData(prev => ({ ...prev, collectionId: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      // Validate organizer mode requires collection
      if (formData.deckMode === 'organizer' && !formData.collectionId) {
        setErrors({ collectionId: ['Collection is required for organizer mode'] });
        setLoading(false);
        return;
      }

      // If creating new series, do that first
      let seriesId = formData.seriesId ? parseInt(formData.seriesId) : null;
      
      if (showNewSeries && formData.newSeriesName.trim()) {
        const seriesResult = await api.tournaments.createSeries(formData.newSeriesName.trim());
        seriesId = seriesResult.series.id;
        toast.success(`Series "${formData.newSeriesName}" created`);
        loadData();
      }

      const data = {
        name: formData.name,
        minPlayerCount: parseInt(formData.minPlayerCount) || 2,
        deckMode: formData.deckMode,
      };

      if (formData.maxPlayerCount) {
        data.maxPlayerCount = parseInt(formData.maxPlayerCount);
      }
      if (formData.location) {
        data.location = formData.location;
      }
      if (formData.numberOfRounds) {
        data.numberOfRounds = parseInt(formData.numberOfRounds);
      }
      if (seriesId) {
        data.seriesId = seriesId;
      }
      if (formData.deckMode === 'organizer' && formData.collectionId) {
        data.collectionId = parseInt(formData.collectionId);
      }

      const result = await api.tournaments.create(data);
      toast.success('Tournament created!');
      navigate(`/tournaments/${result.tournament.id}`);
    } catch (err) {
      if (err.details) {
        setErrors(err.details);
      } else {
        toast.error(err.message || 'Failed to create tournament');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="create-tournament">
        <div className="page-header">
          <h1 className="page-title">Create Tournament</h1>
          <p className="page-subtitle">Set up a new Swiss-system tournament</p>
        </div>

        <form onSubmit={handleSubmit} className="tournament-form card">
          <div className="input-group">
            <label htmlFor="name">Tournament Name *</label>
            <div className="input-with-icon">
              <Trophy size={18} className="input-icon" />
              <input
                type="text"
                id="name"
                name="name"
                className={`input ${errors.name ? 'input-error' : ''}`}
                placeholder="Local Championship"
                value={formData.name}
                onChange={handleChange}
                minLength={2}
                maxLength={200}
                required
              />
            </div>
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          {/* Series Selection */}
          <div className="input-group">
            <label htmlFor="seriesId">Tournament Series (optional)</label>
            <div className="input-with-icon">
              <Layers size={18} className="input-icon" />
              <select
                id="seriesId"
                name="seriesId"
                className="input"
                value={showNewSeries ? 'new' : formData.seriesId}
                onChange={handleChange}
              >
                <option value="">No Series</option>
                {series.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="new">+ Create New Series</option>
              </select>
            </div>
            <span className="input-hint">Group related tournaments together</span>
          </div>

          {/* New Series Name */}
          {showNewSeries && (
            <div className="input-group new-series-input">
              <label htmlFor="newSeriesName">New Series Name *</label>
              <div className="input-with-icon">
                <Plus size={18} className="input-icon" />
                <input
                  type="text"
                  id="newSeriesName"
                  name="newSeriesName"
                  className="input"
                  placeholder="Weekly Locals 2025"
                  value={formData.newSeriesName}
                  onChange={handleChange}
                  minLength={2}
                  maxLength={100}
                  required={showNewSeries}
                />
              </div>
            </div>
          )}

          {/* Deck Mode */}
          <div className="input-group">
            <label>Deck Mode *</label>
            <div className="deck-mode-options">
              <label className={`deck-mode-option ${formData.deckMode === 'player' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="deckMode"
                  value="player"
                  checked={formData.deckMode === 'player'}
                  onChange={handleChange}
                />
                <div className="option-content">
                  <span className="option-title">Player Decks</span>
                  <span className="option-desc">Players bring their own decks</span>
                </div>
              </label>
              <label className={`deck-mode-option ${formData.deckMode === 'organizer' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="deckMode"
                  value="organizer"
                  checked={formData.deckMode === 'organizer'}
                  onChange={handleChange}
                />
                <div className="option-content">
                  <span className="option-title">Organizer Decks</span>
                  <span className="option-desc">You assign decks to players</span>
                </div>
              </label>
            </div>
          </div>

          {/* Collection Selection (only for organizer mode) */}
          {formData.deckMode === 'organizer' && (
            <div className="input-group collection-select">
              <label htmlFor="collectionId">Deck Collection *</label>
              <div className="input-with-icon">
                <BookOpen size={18} className="input-icon" />
                <select
                  id="collectionId"
                  name="collectionId"
                  className={`input ${errors.collectionId ? 'input-error' : ''}`}
                  value={formData.collectionId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a collection...</option>
                  {collections.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.deck_count || 0} decks)
                    </option>
                  ))}
                </select>
              </div>
              {errors.collectionId && <span className="error-text">{errors.collectionId}</span>}
              <span className="input-hint">
                Players will be assigned decks from this collection
              </span>
              {collections.length === 0 && (
                <p className="warning-text">
                  You don't have any collections yet. 
                  <a href="/collections" className="link"> Create one first →</a>
                </p>
              )}
            </div>
          )}

          <div className="form-row">
            <div className="input-group">
              <label htmlFor="minPlayerCount">Min Players</label>
              <div className="input-with-icon">
                <Users size={18} className="input-icon" />
                <input
                  type="number"
                  id="minPlayerCount"
                  name="minPlayerCount"
                  className="input"
                  value={formData.minPlayerCount}
                  onChange={handleChange}
                  min={2}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="maxPlayerCount">Max Players</label>
              <div className="input-with-icon">
                <Users size={18} className="input-icon" />
                <input
                  type="number"
                  id="maxPlayerCount"
                  name="maxPlayerCount"
                  className="input"
                  placeholder="Unlimited"
                  value={formData.maxPlayerCount}
                  onChange={handleChange}
                  min={2}
                />
              </div>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="location">Location</label>
            <div className="input-with-icon">
              <MapPin size={18} className="input-icon" />
              <input
                type="text"
                id="location"
                name="location"
                className="input"
                placeholder="Local Game Store, City"
                value={formData.location}
                onChange={handleChange}
                maxLength={500}
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="numberOfRounds">Number of Rounds</label>
            <div className="input-with-icon">
              <Hash size={18} className="input-icon" />
              <input
                type="number"
                id="numberOfRounds"
                name="numberOfRounds"
                className="input"
                placeholder="Auto (based on players)"
                value={formData.numberOfRounds}
                onChange={handleChange}
                min={1}
              />
            </div>
            <span className="input-hint">Leave empty to auto-calculate based on player count</span>
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => navigate('/tournaments')}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Tournament'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
