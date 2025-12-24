import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  Menu, 
  X, 
  Trophy, 
  Layers, 
  Sparkles, 
  Search, 
  LogOut, 
  User,
  ChevronDown 
} from 'lucide-react';
import { useState } from 'react';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <div className="navbar-logo">
            <svg viewBox="0 0 100 100" width="36" height="36">
              <defs>
                <linearGradient id="navGold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#D4AF37' }} />
                  <stop offset="50%" style={{ stopColor: '#F4E04D' }} />
                  <stop offset="100%" style={{ stopColor: '#D4AF37' }} />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="45" fill="#1a1a2e" stroke="url(#navGold)" strokeWidth="3"/>
              <path d="M50 15 L60 40 L85 40 L65 55 L72 80 L50 65 L28 80 L35 55 L15 40 L40 40 Z" fill="url(#navGold)"/>
            </svg>
          </div>
          <span className="navbar-title">YGOHub</span>
        </Link>

        <button 
          className="navbar-mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className={`navbar-menu ${mobileOpen ? 'open' : ''}`}>
          {user && user.status !== 'no_username' && (
            <div className="navbar-links">
              <Link to="/tournaments" className="navbar-link" onClick={() => setMobileOpen(false)}>
                <Trophy size={18} />
                <span>Tournaments</span>
              </Link>
              <Link to="/collections" className="navbar-link" onClick={() => setMobileOpen(false)}>
                <Layers size={18} />
                <span>Collections</span>
              </Link>
              <Link to="/custom-cards" className="navbar-link" onClick={() => setMobileOpen(false)}>
                <Sparkles size={18} />
                <span>Custom Cards</span>
              </Link>
              <Link to="/cards" className="navbar-link" onClick={() => setMobileOpen(false)}>
                <Search size={18} />
                <span>Card Search</span>
              </Link>
            </div>
          )}

          <div className="navbar-actions">
            {user ? (
              <div className="navbar-user">
                <button 
                  className="navbar-user-button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  <div className="navbar-avatar">
                    <User size={18} />
                  </div>
                  <span className="navbar-username">
                    {user.username || user.email}
                    {user.tag !== undefined && user.tag !== null && (
                      <span className="navbar-tag">#{String(user.tag).padStart(4, '0')}</span>
                    )}
                  </span>
                  <ChevronDown size={16} />
                </button>

                {dropdownOpen && (
                  <div className="navbar-dropdown">
                    <Link 
                      to="/dashboard" 
                      className="navbar-dropdown-item"
                      onClick={() => { setDropdownOpen(false); setMobileOpen(false); }}
                    >
                      <User size={16} />
                      <span>Dashboard</span>
                    </Link>
                    <button 
                      className="navbar-dropdown-item"
                      onClick={() => { handleLogout(); setDropdownOpen(false); setMobileOpen(false); }}
                    >
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="navbar-auth">
                <Link to="/login" className="btn btn-ghost" onClick={() => setMobileOpen(false)}>
                  Login
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm" onClick={() => setMobileOpen(false)}>
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
