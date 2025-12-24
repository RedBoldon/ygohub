import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import { api } from '../api/client';
import { Trophy, Users, MapPin, Calendar, Hash } from 'lucide-react';
import './CreateTournament.css';

export default function CreateTournament() {
  const [formData, setFormData] = useState({
    name: '',
    minPlayerCount: 2,
    maxPlayerCount: '',
    location: '',
    numberOfRounds: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const navigate = useNavigate();
  const toast = useToast();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const data = {
        name: formData.name,
        minPlayerCount: parseInt(formData.minPlayerCount) || 2,
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
