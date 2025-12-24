import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Trophy, Layers, Sparkles, Plus, Users, Search } from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="container">
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="dashboard-welcome">
            <h1>Welcome back, <span className="highlight">{user?.username}</span></h1>
            <p className="dashboard-subtitle">Ready for your next duel?</p>
          </div>
          <div className="dashboard-user-info">
            <span className="user-tag">
              {user?.username}#{String(user?.tag).padStart(4, '0')}
            </span>
          </div>
        </header>

        <div className="dashboard-grid">
          {/* Quick Actions */}
          <section className="dashboard-section">
            <h2 className="section-heading">Quick Actions</h2>
            <div className="action-cards">
              <Link to="/tournaments/create" className="action-card action-card-gold">
                <div className="action-icon">
                  <Plus size={24} />
                </div>
                <div className="action-content">
                  <h3>Create Tournament</h3>
                  <p>Start a new Swiss tournament</p>
                </div>
              </Link>

              <Link to="/tournaments/join" className="action-card action-card-purple">
                <div className="action-icon">
                  <Users size={24} />
                </div>
                <div className="action-content">
                  <h3>Join Tournament</h3>
                  <p>Enter with an invite code</p>
                </div>
              </Link>

              <Link to="/collections" className="action-card action-card-blue">
                <div className="action-icon">
                  <Layers size={24} />
                </div>
                <div className="action-content">
                  <h3>My Collections</h3>
                  <p>Manage your deck collections</p>
                </div>
              </Link>

              <Link to="/custom-cards" className="action-card action-card-green">
                <div className="action-icon">
                  <Sparkles size={24} />
                </div>
                <div className="action-content">
                  <h3>Custom Cards</h3>
                  <p>Create and manage custom cards</p>
                </div>
              </Link>
            </div>
          </section>

          {/* Navigation Cards */}
          <section className="dashboard-section">
            <h2 className="section-heading">Explore</h2>
            <div className="nav-cards">
              <Link to="/tournaments" className="nav-card">
                <Trophy size={32} className="nav-icon" />
                <h3>Tournaments</h3>
                <p>View and manage your tournaments</p>
              </Link>

              <Link to="/cards" className="nav-card">
                <Search size={32} className="nav-icon" />
                <h3>Card Database</h3>
                <p>Search 13,000+ Yu-Gi-Oh! cards</p>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
