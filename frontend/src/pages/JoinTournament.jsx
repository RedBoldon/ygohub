import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import { api } from '../api/client';
import { Ticket, ArrowRight } from 'lucide-react';
import './JoinTournament.css';

export default function JoinTournament() {
  const { inviteCode: urlCode } = useParams();
  const [inviteCode, setInviteCode] = useState(urlCode || '');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();

  // Auto-join if code in URL
  useEffect(() => {
    if (urlCode) {
      handleJoin();
    }
  }, [urlCode]);

  const handleJoin = async (e) => {
    if (e) e.preventDefault();
    
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code');
      return;
    }

    setLoading(true);

    try {
      const result = await api.tournaments.join(inviteCode.trim());
      toast.success('Successfully joined the tournament!');
      navigate(`/tournaments/${result.tournamentId}`);
    } catch (err) {
      toast.error(err.message || 'Failed to join tournament');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="join-tournament">
        <div className="page-header">
          <h1 className="page-title">Join Tournament</h1>
          <p className="page-subtitle">Enter the invite code to join</p>
        </div>

        <form onSubmit={handleJoin} className="join-form card">
          <div className="input-group">
            <label htmlFor="inviteCode">Invite Code</label>
            <div className="input-with-icon">
              <Ticket size={18} className="input-icon" />
              <input
                type="text"
                id="inviteCode"
                className="input invite-input"
                placeholder="ABC123"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                maxLength={20}
                autoFocus
              />
            </div>
            <span className="input-hint">Get this code from the tournament organizer</span>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? 'Joining...' : (
              <>
                Join Tournament
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
