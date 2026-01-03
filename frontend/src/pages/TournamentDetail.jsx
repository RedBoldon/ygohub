import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { api } from '../api/client';
import { 
  Trophy, Users, MapPin, Calendar, Copy, Play, ChevronRight,
  Award, Swords, AlertCircle, BookOpen, Check
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
  const [confirmStart, setConfirmStart] = useState(false);
  const [deckAssignments, setDeckAssignments] = useState({});
  
  // Player deck selection (Player Mode)
  const [playerDecks, setPlayerDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [canChangeDeck, setCanChangeDeck] = useState(false);
  const [deckModalOpen, setDeckModalOpen] = useState(false);
  const [loadingDecks, setLoadingDecks] = useState(false);

  useEffect(() => { loadTournament(); }, [id]);

  const loadTournament = async () => {
    try {
      const data = await api.tournaments.get(id);
      setTournament(data);
      const assignments = {};
      data.participants?.forEach(p => { assignments[p.user_id] = p.assigned_deck_id || ''; });
      setDeckAssignments(assignments);
      
      // Load player decks if Player Mode and user is participant
      const isParticipant = data.participants?.some(p => p.user_id === user?.id);
      if (data.tournament.deck_mode === 'player' && isParticipant) {
        loadPlayerDecks();
      }
      
      if (data.tournament.status !== 'open') {
        try {
          const standingsData = await api.tournaments.standings(id);
          setStandings(standingsData.standings || []);
        } catch (err) { console.error('Failed to load standings:', err); }
      }
    } catch (err) { toast.error('Failed to load tournament'); }
    finally { setLoading(false); }
  };

  const loadPlayerDecks = async () => {
    setLoadingDecks(true);
    try {
      const data = await api.tournaments.getMyDecks(id);
      setPlayerDecks(data.decks || []);
      setSelectedDeck(data.selectedDeck);
      setCanChangeDeck(data.canChange);
    } catch (err) {
      console.error('Failed to load player decks:', err);
    } finally {
      setLoadingDecks(false);
    }
  };

  const handleSelectDeck = async (deckId) => {
    setActionLoading(true);
    try {
      await api.tournaments.selectDeck(id, deckId);
      toast.success('Deck selected!');
      setDeckModalOpen(false);
      loadPlayerDecks();
    } catch (err) {
      toast.error(err.message || 'Failed to select deck');
    } finally {
      setActionLoading(false);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/tournaments/join?code=${tournament.tournament.invite_code}`);
    toast.success('Invite link copied!');
  };

  const handleStart = async () => {
    if (!confirmStart) { setConfirmStart(true); return; }
    setActionLoading(true); setConfirmStart(false);
    try { await api.tournaments.start(id); toast.success('Tournament started!'); loadTournament(); }
    catch (err) { toast.error(err.message || 'Failed to start tournament'); }
    finally { setActionLoading(false); }
  };

  const handleAdvance = async () => {
    setActionLoading(true);
    try {
      const result = await api.tournaments.advance(id);
      toast.success(result.completed ? 'Tournament completed!' : `Round ${result.round} started!`);
      loadTournament();
    } catch (err) { toast.error(err.message || 'Failed to advance round'); }
    finally { setActionLoading(false); }
  };

  const handleAssignDeck = async (playerId, deckId) => {
    setDeckAssignments(prev => ({ ...prev, [playerId]: deckId }));
    try { await api.tournaments.assignDeck(id, playerId, deckId || null); toast.success('Deck assigned'); loadTournament(); }
    catch (err) { toast.error(err.message || 'Failed to assign deck'); loadTournament(); }
  };

  const openResultModal = (match) => { setResultModal({ open: true, match }); setScores({ team1: 0, team2: 0 }); };

  const handleReportResult = async () => {
    if (scores.team1 === scores.team2) { toast.error('Match cannot end in a draw'); return; }
    setActionLoading(true);
    try { await api.tournaments.reportResult(resultModal.match.id, scores.team1, scores.team2); toast.success('Result recorded!'); setResultModal({ open: false, match: null }); loadTournament(); }
    catch (err) { toast.error(err.message || 'Failed to report result'); }
    finally { setActionLoading(false); }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (!tournament) return <div className="container"><div className="empty-state"><Trophy size={64} /><h3>Tournament Not Found</h3><Link to="/tournaments" className="btn btn-primary mt-3">Back to Tournaments</Link></div></div>;

  const { tournament: t, participants, rounds, availableDecks, isCreator } = tournament;
  const currentRound = rounds?.find(r => r.status === 'in_progress');
  const allMatchesComplete = currentRound?.matches?.every(m => m.status === 'completed' || m.is_bye);
  const canStart = t.status === 'open' && t.player_count >= (t.min_player_count || 2);
  const needsMorePlayers = t.status === 'open' && t.player_count < (t.min_player_count || 2);
  const isOrganizerMode = t.deck_mode === 'organizer';
  const isPlayerMode = t.deck_mode === 'player';
  const allDecksAssigned = !isOrganizerMode || participants?.every(p => p.assigned_deck_id);
  const isParticipant = participants?.some(p => p.user_id === user?.id);

  // Group player decks by collection for better display
  const decksByCollection = playerDecks.reduce((acc, deck) => {
    const col = deck.collection_name || 'Unknown Collection';
    if (!acc[col]) acc[col] = [];
    acc[col].push(deck);
    return acc;
  }, {});

  return (
    <div className="container">
      <div className="tournament-detail">
        <header className="tournament-header">
          <div className="tournament-title-row">
            <h1 className="page-title">{t.name}</h1>
            <span className={`badge badge-${getStatusColor(t.status)}`}>{formatStatus(t.status)}</span>
          </div>
          <div className="tournament-meta-row">
            <div className="meta-item"><Users size={16} /><span>{t.player_count} / {t.max_player_count || '∞'} players</span></div>
            {t.location && <div className="meta-item"><MapPin size={16} /><span>{t.location}</span></div>}
            <div className="meta-item"><Calendar size={16} /><span>{new Date(t.created_at).toLocaleDateString()}</span></div>
            {t.current_round > 0 && <div className="meta-item"><Trophy size={16} /><span>Round {t.current_round}{t.number_of_rounds ? ` / ${t.number_of_rounds}` : ''}</span></div>}
            {isOrganizerMode && <div className="meta-item"><BookOpen size={16} /><span>Organizer Decks ({t.collection_name})</span></div>}
            {isPlayerMode && <div className="meta-item"><BookOpen size={16} /><span>Player Decks</span></div>}
          </div>

          {t.status === 'open' && t.invite_code && (
            <div className="invite-code-box">
              <span className="invite-label">Share this link to invite players:</span>
              <div className="invite-row">
                <code className="invite-code">{t.invite_code}</code>
                <button className="btn btn-secondary btn-sm" onClick={copyInviteLink}><Copy size={16} />Copy Link</button>
              </div>
            </div>
          )}

          {/* Player Deck Selection (Player Mode) */}
          {isPlayerMode && isParticipant && t.status === 'open' && (
            <div className="player-deck-section">
              <div className="player-deck-header">
                <h3>Your Deck</h3>
                {selectedDeck ? (
                  <div className="selected-deck-info">
                    <Check size={16} className="check-icon" />
                    <span className="selected-deck-name">{selectedDeck.deck_name}</span>
                    {canChangeDeck && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setDeckModalOpen(true)}>
                        Change
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="no-deck-warning">
                    <AlertCircle size={16} />
                    <span>Select a deck before the tournament starts</span>
                    <button className="btn btn-primary btn-sm" onClick={() => setDeckModalOpen(true)}>
                      Select Deck
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Show selected deck when tournament is in progress */}
          {isPlayerMode && isParticipant && t.status !== 'open' && selectedDeck && (
            <div className="player-deck-section">
              <div className="player-deck-header">
                <h3>Your Deck</h3>
                <div className="selected-deck-info locked">
                  <BookOpen size={16} />
                  <span className="selected-deck-name">{selectedDeck.deck_name}</span>
                  <span className="deck-locked-badge">Locked</span>
                </div>
              </div>
            </div>
          )}

          {isCreator && (
            <div className="tournament-actions">
              {needsMorePlayers && <div className="action-warning"><AlertCircle size={16} /><span>Need at least {t.min_player_count || 2} players to start</span></div>}
              {canStart && !allDecksAssigned && <div className="action-warning"><AlertCircle size={16} /><span>Assign decks to all players before starting</span></div>}
              {canStart && allDecksAssigned && (
                <div className="start-action">
                  {confirmStart ? (
                    <>
                      <span className="confirm-text">Start with {t.player_count} players?</span>
                      <button className="btn btn-primary" onClick={handleStart} disabled={actionLoading}>{actionLoading ? 'Starting...' : 'Yes, Start!'}</button>
                      <button className="btn btn-secondary" onClick={() => setConfirmStart(false)}>Cancel</button>
                    </>
                  ) : (
                    <button className="btn btn-primary" onClick={handleStart} disabled={actionLoading}><Play size={18} />Start Tournament</button>
                  )}
                </div>
              )}
              {t.status === 'in_progress' && currentRound && allMatchesComplete && <button className="btn btn-primary" onClick={handleAdvance} disabled={actionLoading}><ChevronRight size={18} />{actionLoading ? 'Advancing...' : 'Next Round'}</button>}
              {t.status === 'in_progress' && currentRound && !allMatchesComplete && <div className="action-info"><AlertCircle size={16} /><span>Waiting for all matches to complete</span></div>}
            </div>
          )}
        </header>

        <div className="tabs">
          <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
          <button className={`tab ${activeTab === 'standings' ? 'active' : ''}`} onClick={() => setActiveTab('standings')}>Standings</button>
          <button className={`tab ${activeTab === 'rounds' ? 'active' : ''}`} onClick={() => setActiveTab('rounds')}>Rounds</button>
        </div>

        {activeTab === 'overview' && (
          <div className="tab-content">
            <div className="overview-grid">
              <div className="card">
                <div className="card-header"><h3 className="card-title">Participants ({participants?.length || 0})</h3></div>
                {participants?.length > 0 ? (
                  <ul className="participant-list">
                    {participants.map((p, i) => (
                      <li key={p.user_id} className="participant-item">
                        <div className="participant-info">
                          <span className="participant-rank">{i + 1}</span>
                          <span className="participant-name">{p.username}<span className="participant-tag">#{String(p.tag).padStart(4, '0')}</span></span>
                        </div>
                        {isOrganizerMode && isCreator && t.status === 'open' && (
                          <select className="input deck-select" value={deckAssignments[p.user_id] || ''} onChange={(e) => handleAssignDeck(p.user_id, e.target.value ? parseInt(e.target.value) : null)}>
                            <option value="">No deck</option>
                            {availableDecks?.map(deck => <option key={deck.id} value={deck.id}>{deck.deck_name}</option>)}
                          </select>
                        )}
                        {isOrganizerMode && (!isCreator || t.status !== 'open') && p.assigned_deck_name && <span className="assigned-deck-badge"><BookOpen size={14} />{p.assigned_deck_name}</span>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="empty-message">No participants yet</p>}
              </div>

              {currentRound && (
                <div className="card">
                  <div className="card-header"><h3 className="card-title">Round {currentRound.round_number}</h3><span className="badge badge-blue">In Progress</span></div>
                  <div className="matches-list">
                    {currentRound.matches?.map(match => (
                      <div key={match.id} className="match-card">
                        {match.is_bye ? (
                          <div className="match-bye"><span>{match.team1?.[0]?.username || 'Player'}</span><span className="bye-label">BYE</span></div>
                        ) : (
                          <>
                            <div className="match-teams">
                              <div className={`match-team ${match.winner_team_id === 1 ? 'winner' : ''}`}><span>{match.team1?.[0]?.username}</span>{match.status === 'completed' && <span className="match-score">{match.team_1_score}</span>}</div>
                              <span className="match-vs">vs</span>
                              <div className={`match-team ${match.winner_team_id === 2 ? 'winner' : ''}`}><span>{match.team2?.[0]?.username}</span>{match.status === 'completed' && <span className="match-score">{match.team_2_score}</span>}</div>
                            </div>
                            {isCreator && match.status !== 'completed' && <button className="btn btn-sm btn-secondary" onClick={() => openResultModal(match)}>Report</button>}
                            {match.status === 'completed' && <span className="badge badge-green">Done</span>}
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
                  <thead><tr><th>Rank</th><th>Player</th><th>Record</th><th>OMW%</th><th>GW%</th></tr></thead>
                  <tbody>
                    {standings.map((s, i) => (
                      <tr key={i}>
                        <td><span className="rank-badge">{i === 0 && <Award size={16} className="gold" />}{i === 1 && <Award size={16} className="silver" />}{i === 2 && <Award size={16} className="bronze" />}{s.rank}</span></td>
                        <td><span className="player-name">{s.username}<span className="player-tag">#{String(s.tag).padStart(4, '0')}</span></span></td>
                        <td>{s.matchWins}-{s.matchLosses}</td>
                        <td>{(s.omw * 100).toFixed(1)}%</td>
                        <td>{(s.gw * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state"><Swords size={48} /><h3>No Standings Yet</h3><p>Standings will appear once the tournament starts</p></div>}
          </div>
        )}

        {activeTab === 'rounds' && (
          <div className="tab-content">
            {rounds?.length > 0 ? (
              <div className="rounds-list">
                {rounds.map(round => (
                  <div key={round.id} className="round-card card">
                    <div className="card-header"><h3 className="card-title">Round {round.round_number}</h3><span className={`badge badge-${round.status === 'completed' ? 'green' : round.status === 'in_progress' ? 'blue' : 'gold'}`}>{round.status.replace('_', ' ')}</span></div>
                    <div className="matches-list">
                      {round.matches?.map(match => (
                        <div key={match.id} className="match-card">
                          {match.is_bye ? (
                            <div className="match-bye"><span>{match.team1?.[0]?.username || 'Player'}</span><span className="bye-label">BYE</span></div>
                          ) : (
                            <>
                              <div className="match-teams">
                                <div className={`match-team ${match.winner_team_id === 1 ? 'winner' : ''}`}><span>{match.team1?.[0]?.username}</span><span className="match-score">{match.team_1_score}</span></div>
                                <span className="match-vs">vs</span>
                                <div className={`match-team ${match.winner_team_id === 2 ? 'winner' : ''}`}><span>{match.team2?.[0]?.username}</span><span className="match-score">{match.team_2_score}</span></div>
                              </div>
                              {isCreator && round.status === 'in_progress' && match.status !== 'completed' && <button className="btn btn-sm btn-secondary" onClick={() => openResultModal(match)}>Report</button>}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="empty-state"><Trophy size={48} /><h3>No Rounds Yet</h3><p>Rounds will appear once the tournament starts</p></div>}
          </div>
        )}

        {/* Result Modal */}
        <Modal isOpen={resultModal.open} onClose={() => setResultModal({ open: false, match: null })} title="Report Match Result"
          footer={<><button className="btn btn-secondary" onClick={() => setResultModal({ open: false, match: null })}>Cancel</button><button className="btn btn-primary" onClick={handleReportResult} disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Save Result'}</button></>}>
          {resultModal.match && (
            <div className="result-form">
              <div className="result-team"><span className="team-name">{resultModal.match.team1?.[0]?.username}</span><input type="number" className="input score-input" value={scores.team1} onChange={(e) => setScores(s => ({ ...s, team1: parseInt(e.target.value) || 0 }))} min={0} /></div>
              <span className="result-vs">vs</span>
              <div className="result-team"><span className="team-name">{resultModal.match.team2?.[0]?.username}</span><input type="number" className="input score-input" value={scores.team2} onChange={(e) => setScores(s => ({ ...s, team2: parseInt(e.target.value) || 0 }))} min={0} /></div>
            </div>
          )}
        </Modal>

        {/* Deck Selection Modal (Player Mode) */}
        <Modal 
          isOpen={deckModalOpen} 
          onClose={() => setDeckModalOpen(false)} 
          title="Select Your Deck"
        >
          {loadingDecks ? (
            <div className="loading-container"><div className="spinner"></div></div>
          ) : playerDecks.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={48} />
              <h3>No Decks Found</h3>
              <p>You need to create a deck first.</p>
              <Link to="/collections" className="btn btn-primary mt-3">Go to Collections</Link>
            </div>
          ) : (
            <div className="deck-selection-list">
              {Object.entries(decksByCollection).map(([collectionName, decks]) => (
                <div key={collectionName} className="deck-collection-group">
                  <h4 className="collection-group-title">{collectionName}</h4>
                  <div className="deck-options">
                    {decks.map(deck => (
                      <button
                        key={deck.id}
                        className={`deck-option ${selectedDeck?.deck_id === deck.id ? 'selected' : ''}`}
                        onClick={() => handleSelectDeck(deck.id)}
                        disabled={actionLoading}
                      >
                        <div className="deck-option-info">
                          <span className="deck-option-name">{deck.deck_name}</span>
                          {deck.archetype && <span className="deck-option-archetype">{deck.archetype}</span>}
                          <span className="deck-option-cards">{deck.card_count} cards</span>
                        </div>
                        {selectedDeck?.deck_id === deck.id && <Check size={20} className="deck-selected-icon" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}

function getStatusColor(status) { return { open: 'green', in_progress: 'blue', completed: 'gold', cancelled: 'red' }[status] || 'gold'; }
function formatStatus(status) { return { open: 'Open', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' }[status] || status; }
