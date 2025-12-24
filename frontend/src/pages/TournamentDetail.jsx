import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { api } from '../api/client';
import { 
  Trophy, 
  Users, 
  MapPin, 
  Calendar, 
  Copy, 
  Play, 
  ChevronRight,
  Award,
  Swords
} from 'lucide-react';
import Modal from '../components/Modal';
import './TournamentDetail.css';

export default function TournamentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [tournament, setTournament] = useState(null);
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [resultModal, setResultModal] = useState({ open: false, match: null });
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadTournament();
  }, [id]);

  const loadTournament = async () => {
    try {
      const data = await api.tournaments.get(id);
      setTournament(data);

      if (data.tournament.status !== 'open') {
        const standingsData = await api.tournaments.standings(id);
        setStandings(standingsData.standings);
      }
    } catch (err) {
      toast.error('Failed to load tournament');
    } finally {
      setLoading(false);
    }
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(tournament.tournament.invite_code);
    toast.success('Invite code copied!');
  };

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await api.tournaments.start(id);
      toast.success('Tournament started!');
      loadTournament();
    } catch (err) {
      toast.error(err.message || 'Failed to start tournament');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvance = async () => {
    setActionLoading(true);
    try {
      const result = await api.tournaments.advance(id);
      if (result.completed) {
        toast.success('Tournament completed!');
      } else {
        toast.success(`Round ${result.round} started!`);
      }
      loadTournament();
    } catch (err) {
      toast.error(err.message || 'Failed to advance round');
    } finally {
      setActionLoading(false);
    }
  };

  const openResultModal = (match) => {
    setResultModal({ open: true, match });
    setScores({ team1: 0, team2: 0 });
  };

  const handleReportResult = async () => {
    if (scores.team1 === scores.team2) {
      toast.error('Match cannot end in a draw');
      return;
    }

    setActionLoading(true);
    try {
      await api.tournaments.reportResult(resultModal.match.id, scores.team1, scores.team2);
      toast.success('Result recorded!');
      setResultModal({ open: false, match: null });
      loadTournament();
    } catch (err) {
      toast.error(err.message || 'Failed to report result');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="container">
        <div className="empty-state">
          <Trophy size={64} />
          <h3>Tournament Not Found</h3>
          <Link to="/tournaments" className="btn btn-primary mt-3">
            Back to Tournaments
          </Link>
        </div>
      </div>
    );
  }

  const { tournament: t, participants, rounds, isCreator, isParticipant } = tournament;
  const currentRound = rounds?.find(r => r.status === 'in_progress');
  const allMatchesComplete = currentRound?.matches?.every(m => m.status === 'completed');

  return (
    <div className="container">
      <div className="tournament-detail">
        {/* Header */}
        <header className="tournament-header">
          <div className="tournament-title-row">
            <h1 className="page-title">{t.name}</h1>
            <span className={`badge badge-${getStatusColor(t.status)}`}>
              {t.status.replace('_', ' ')}
            </span>
          </div>

          <div className="tournament-meta-row">
            <div className="meta-item">
              <Users size={16} />
              <span>{t.player_count} / {t.max_player_count || '∞'} players</span>
            </div>
            {t.location && (
              <div className="meta-item">
                <MapPin size={16} />
                <span>{t.location}</span>
              </div>
            )}
            <div className="meta-item">
              <Calendar size={16} />
              <span>{new Date(t.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Invite Code */}
          {t.status === 'open' && t.invite_code && (
            <div className="invite-code-box">
              <span className="invite-label">Invite Code:</span>
              <code className="invite-code">{t.invite_code}</code>
              <button className="btn btn-ghost btn-sm" onClick={copyInviteCode}>
                <Copy size={16} />
              </button>
            </div>
          )}

          {/* Actions */}
          {isCreator && (
            <div className="tournament-actions">
              {t.status === 'open' && t.player_count >= 2 && (
                <button 
                  className="btn btn-primary"
                  onClick={handleStart}
                  disabled={actionLoading}
                >
                  <Play size={18} />
                  Start Tournament
                </button>
              )}
              {t.status === 'in_progress' && allMatchesComplete && (
                <button 
                  className="btn btn-primary"
                  onClick={handleAdvance}
                  disabled={actionLoading}
                >
                  <ChevronRight size={18} />
                  Next Round
                </button>
              )}
            </div>
          )}
        </header>

        {/* Tabs */}
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab ${activeTab === 'standings' ? 'active' : ''}`}
            onClick={() => setActiveTab('standings')}
          >
            Standings
          </button>
          <button 
            className={`tab ${activeTab === 'rounds' ? 'active' : ''}`}
            onClick={() => setActiveTab('rounds')}
          >
            Rounds
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            <div className="overview-grid">
              {/* Participants */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Participants</h3>
                </div>
                {participants?.length > 0 ? (
                  <ul className="participant-list">
                    {participants.map((p, i) => (
                      <li key={p.user_id} className="participant-item">
                        <span className="participant-rank">{i + 1}</span>
                        <span className="participant-name">
                          {p.username}
                          <span className="participant-tag">#{String(p.tag).padStart(4, '0')}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-message">No participants yet</p>
                )}
              </div>

              {/* Current Round */}
              {currentRound && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Round {currentRound.round_number}</h3>
                    <span className="badge badge-blue">In Progress</span>
                  </div>
                  <div className="matches-list">
                    {currentRound.matches?.map(match => (
                      <div key={match.id} className="match-card">
                        {match.is_bye ? (
                          <div className="match-bye">
                            <span>{match.team1?.[0]?.username || 'Player'}</span>
                            <span className="bye-label">BYE</span>
                          </div>
                        ) : (
                          <>
                            <div className="match-teams">
                              <div className="match-team">
                                <span>{match.team1?.[0]?.username}</span>
                                {match.status === 'completed' && (
                                  <span className="match-score">{match.team_1_score}</span>
                                )}
                              </div>
                              <span className="match-vs">vs</span>
                              <div className="match-team">
                                <span>{match.team2?.[0]?.username}</span>
                                {match.status === 'completed' && (
                                  <span className="match-score">{match.team_2_score}</span>
                                )}
                              </div>
                            </div>
                            {isCreator && match.status !== 'completed' && (
                              <button 
                                className="btn btn-sm btn-secondary"
                                onClick={() => openResultModal(match)}
                              >
                                Report
                              </button>
                            )}
                            {match.status === 'completed' && (
                              <span className="badge badge-green">Done</span>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'standings' && (
          <div className="tab-content">
            {standings.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Player</th>
                      <th>Record</th>
                      <th>OMW%</th>
                      <th>GW%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => (
                      <tr key={i}>
                        <td>
                          <span className="rank-badge">
                            {i === 0 && <Award size={16} className="gold" />}
                            {i === 1 && <Award size={16} className="silver" />}
                            {i === 2 && <Award size={16} className="bronze" />}
                            {s.rank}
                          </span>
                        </td>
                        <td>
                          <span className="player-name">
                            {s.username}
                            <span className="player-tag">#{String(s.tag).padStart(4, '0')}</span>
                          </span>
                        </td>
                        <td>{s.matchWins}-{s.matchLosses}</td>
                        <td>{(s.omw * 100).toFixed(1)}%</td>
                        <td>{(s.gw * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <Swords size={48} />
                <h3>No Standings Yet</h3>
                <p>Standings will appear once the tournament starts</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'rounds' && (
          <div className="tab-content">
            {rounds?.length > 0 ? (
              <div className="rounds-list">
                {rounds.map(round => (
                  <div key={round.id} className="round-card card">
                    <div className="card-header">
                      <h3 className="card-title">Round {round.round_number}</h3>
                      <span className={`badge badge-${round.status === 'completed' ? 'green' : round.status === 'in_progress' ? 'blue' : 'gold'}`}>
                        {round.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="matches-list">
                      {round.matches?.map(match => (
                        <div key={match.id} className="match-card">
                          {match.is_bye ? (
                            <div className="match-bye">
                              <span>{match.team1?.[0]?.username || 'Player'}</span>
                              <span className="bye-label">BYE</span>
                            </div>
                          ) : (
                            <div className="match-teams">
                              <div className={`match-team ${match.winner_team_id === 1 ? 'winner' : ''}`}>
                                <span>{match.team1?.[0]?.username}</span>
                                <span className="match-score">{match.team_1_score}</span>
                              </div>
                              <span className="match-vs">vs</span>
                              <div className={`match-team ${match.winner_team_id === 2 ? 'winner' : ''}`}>
                                <span>{match.team2?.[0]?.username}</span>
                                <span className="match-score">{match.team_2_score}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Trophy size={48} />
                <h3>No Rounds Yet</h3>
                <p>Rounds will appear once the tournament starts</p>
              </div>
            )}
          </div>
        )}

        {/* Result Modal */}
        <Modal
          isOpen={resultModal.open}
          onClose={() => setResultModal({ open: false, match: null })}
          title="Report Match Result"
          footer={
            <>
              <button 
                className="btn btn-secondary"
                onClick={() => setResultModal({ open: false, match: null })}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleReportResult}
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving...' : 'Save Result'}
              </button>
            </>
          }
        >
          {resultModal.match && (
            <div className="result-form">
              <div className="result-team">
                <span className="team-name">{resultModal.match.team1?.[0]?.username}</span>
                <input
                  type="number"
                  className="input score-input"
                  value={scores.team1}
                  onChange={(e) => setScores(s => ({ ...s, team1: parseInt(e.target.value) || 0 }))}
                  min={0}
                />
              </div>
              <span className="result-vs">vs</span>
              <div className="result-team">
                <span className="team-name">{resultModal.match.team2?.[0]?.username}</span>
                <input
                  type="number"
                  className="input score-input"
                  value={scores.team2}
                  onChange={(e) => setScores(s => ({ ...s, team2: parseInt(e.target.value) || 0 }))}
                  min={0}
                />
              </div>
            </div>
          )}
        </Modal>
      </div>
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
