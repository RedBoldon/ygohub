import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Trophy, Layers, Sparkles, Shield, Users, Zap } from 'lucide-react';
import './Home.css';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-glow hero-glow-1"></div>
          <div className="hero-glow hero-glow-2"></div>
        </div>
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              Master Your
              <span className="hero-highlight"> Dueling Destiny</span>
            </h1>
            <p className="hero-subtitle">
              The ultimate Yu-Gi-Oh! tournament management platform. 
              Create tournaments, manage custom cards, and track your journey to becoming the King of Games.
            </p>
            <div className="hero-actions">
              {user ? (
                <Link to="/dashboard" className="btn btn-primary btn-lg">
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary btn-lg">
                    Start Your Journey
                  </Link>
                  <Link to="/login" className="btn btn-secondary btn-lg">
                    Login
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="container">
          <h2 className="section-title">Powerful Features</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <Trophy size={32} />
              </div>
              <h3 className="feature-title">Swiss Tournaments</h3>
              <p className="feature-desc">
                Run professional Swiss-system tournaments with automatic pairings, 
                OMW/OOMW tiebreakers, and real-time standings.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Layers size={32} />
              </div>
              <h3 className="feature-title">Deck Collections</h3>
              <p className="feature-desc">
                Organize your decks in collections with full version history. 
                Create snapshots for tournament use and track deck evolution.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Sparkles size={32} />
              </div>
              <h3 className="feature-title">Custom Cards</h3>
              <p className="feature-desc">
                Design and manage custom cards for alternative formats. 
                Full support for custom archetypes and tournament integration.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Shield size={32} />
              </div>
              <h3 className="feature-title">Secure & Reliable</h3>
              <p className="feature-desc">
                Built with modern security practices including JWT authentication, 
                refresh token rotation, and encrypted passwords.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Users size={32} />
              </div>
              <h3 className="feature-title">Easy Invites</h3>
              <p className="feature-desc">
                Share tournament invite codes with friends. 
                Join tournaments instantly without complex registration.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Zap size={32} />
              </div>
              <h3 className="feature-title">13,000+ Cards</h3>
              <p className="feature-desc">
                Complete Yu-Gi-Oh! card database with powerful search. 
                Find cards by name, type, archetype, and more.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Duel?</h2>
            <p className="cta-text">
              Join YGOHub today and take your tournament experience to the next level.
            </p>
            {!user && (
              <Link to="/register" className="btn btn-primary btn-lg">
                Create Free Account
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
