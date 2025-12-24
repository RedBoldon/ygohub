import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trophy, Calendar, Users, ChevronRight } from 'lucide-react';
import './Tournaments.css';

export default function Tournaments() {
  // TODO: Fetch user's tournaments from API
  const [tournaments] = useState([]);

  return (
    <div className="container">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Tournaments</h1>
          <p className="page-subtitle">Manage and view your tournaments</p>
        </div>
        <div className="flex gap-2">
          <Link to="/tournaments/join" className="btn btn-secondary">
            <Users size={18} />
            Join
          </Link>
          <Link to="/tournaments/create" className="btn btn-primary">
            <Plus size={18} />
            Create
          </Link>
        </div>
      </div>

      {tournaments.length === 0 ? (
        <div className="empty-state">
          <Trophy size={64} />
          <h3>No Tournaments Yet</h3>
          <p>Create your first tournament or join one with an invite code.</p>
          <div className="flex gap-2 justify-center mt-3">
            <Link to="/tournaments/join" className="btn btn-secondary">
              Join Tournament
            </Link>
            <Link to="/tournaments/create" className="btn btn-primary">
              Create Tournament
            </Link>
          </div>
        </div>
      ) : (
        <div className="tournaments-list">
          {tournaments.map(tournament => (
            <Link 
              key={tournament.id} 
              to={`/tournaments/${tournament.id}`}
              className="tournament-card"
            >
              <div className="tournament-info">
                <h3 className="tournament-name">{tournament.name}</h3>
                <div className="tournament-meta">
                  <span className="meta-item">
                    <Users size={14} />
                    {tournament.player_count}/{tournament.max_player_count || '∞'}
                  </span>
                  <span className="meta-item">
                    <Calendar size={14} />
                    {new Date(tournament.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="tournament-status">
                <span className={`badge badge-${getStatusColor(tournament.status)}`}>
                  {tournament.status}
                </span>
                <ChevronRight size={20} className="tournament-arrow" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function getStatusColor(status) {
  switch (status) {
    case 'open': return 'green';
    case 'in_progress': return 'blue';
    case 'completed': return 'gold';
    case 'cancelled': return 'red';
    default: return 'gold';
  }
}
