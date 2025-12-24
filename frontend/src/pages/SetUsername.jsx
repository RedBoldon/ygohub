import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { User, Hash, RefreshCw } from 'lucide-react';
import './Auth.css';

export default function SetUsername() {
  const [username, setUsername] = useState('');
  const [tag, setTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const { setUsername: setUserUsername, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const generateRandomTag = () => {
    const randomTag = Math.floor(Math.random() * 10000);
    setTag(randomTag.toString().padStart(4, '0'));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    const tagNum = parseInt(tag, 10);
    if (isNaN(tagNum) || tagNum < 0 || tagNum > 9999) {
      setErrors({ tag: 'Tag must be between 0000 and 9999' });
      return;
    }

    setLoading(true);

    try {
      await setUserUsername(username, tagNum);
      toast.success('Username set successfully!');
      navigate('/dashboard');
    } catch (err) {
      if (err.details) {
        setErrors(err.details);
      } else if (err.message.includes('already taken')) {
        toast.error('This username and tag combination is already taken');
      } else {
        toast.error(err.message || 'Failed to set username');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Choose Your Identity</h1>
            <p className="auth-subtitle">
              Pick a username and tag to be recognized in tournaments
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-group">
              <label htmlFor="username">Username</label>
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  id="username"
                  className={`input ${errors.username ? 'input-error' : ''}`}
                  placeholder="YugiMaster"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  minLength={2}
                  maxLength={50}
                  required
                />
              </div>
              {errors.username && <span className="error-text">{errors.username}</span>}
              <span className="input-hint">2-50 characters</span>
            </div>

            <div className="input-group">
              <label htmlFor="tag">Tag</label>
              <div className="input-with-icon">
                <Hash size={18} className="input-icon" />
                <input
                  type="text"
                  id="tag"
                  className={`input ${errors.tag ? 'input-error' : ''}`}
                  placeholder="0001"
                  value={tag}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setTag(val);
                  }}
                  maxLength={4}
                  required
                />
                <button
                  type="button"
                  className="input-action"
                  onClick={generateRandomTag}
                  title="Generate random tag"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
              {errors.tag && <span className="error-text">{errors.tag}</span>}
              <span className="input-hint">4-digit number (0000-9999)</span>
            </div>

            <div className="username-preview">
              <span className="preview-label">Preview:</span>
              <span className="preview-value">
                {username || 'Username'}
                <span className="preview-tag">#{(tag || '0000').padStart(4, '0')}</span>
              </span>
            </div>

            <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
              {loading ? 'Setting Username...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
