import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import { api } from '../api/client';
import { 
  Plus, 
  ArrowLeft, 
  Layers, 
  ChevronRight, 
  Edit2, 
  Trash2,
  BookOpen,
  History,
  Trophy,
  PlusCircle,
  MinusCircle
} from 'lucide-react';
import Modal from '../components/Modal';
import './CollectionDetail.css';

export default function CollectionDetail() {
  const { id } = useParams();
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editDeck, setEditDeck] = useState(null);
  const [formData, setFormData] = useState({ deckName: '', archetype: '', description: '' });
  const [saving, setSaving] = useState(false);
  
  // History modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const toast = useToast();

  useEffect(() => {
    loadCollection();
  }, [id]);

  const loadCollection = async () => {
    try {
      const data = await api.collections.get(id);
      setCollection(data.collection);
    } catch (err) {
      toast.error('Failed to load collection');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const data = await api.collections.getHistory(id);
      setHistory(data.history || []);
    } catch (err) {
      toast.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openModal = (deck = null) => {
    setEditDeck(deck);
    setFormData({
      deckName: deck?.deck_name || '',
      archetype: deck?.archetype || '',
      description: deck?.description || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editDeck) {
        await api.collections.updateDeck(editDeck.id, {
          deckName: formData.deckName,
          archetype: formData.archetype,
          description: formData.description,
        });
        toast.success('Deck updated');
      } else {
        await api.collections.createDeck(
          id,
          formData.deckName,
          formData.archetype,
          formData.description
        );
        toast.success('Deck created');
      }
      setModalOpen(false);
      loadCollection();
    } catch (err) {
      toast.error(err.message || 'Failed to save deck');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDeck = async (deckId) => {
    if (!confirm('Are you sure you want to delete this deck?')) return;

    try {
      await api.collections.deleteDeck(deckId);
      toast.success('Deck deleted');
      loadCollection();
    } catch (err) {
      toast.error(err.message || 'Failed to delete deck');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="container">
        <div className="empty-state">
          <Layers size={64} />
          <h3>Collection Not Found</h3>
          <Link to="/collections" className="btn btn-primary mt-3">
            Back to Collections
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <Link to="/collections" className="back-link">
          <ArrowLeft size={18} />
          Collections
        </Link>
        <div className="flex justify-between items-center mt-2">
          <div>
            <h1 className="page-title">{collection.name}</h1>
            {collection.description && (
              <p className="page-subtitle">{collection.description}</p>
            )}
          </div>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={loadHistory}>
              <History size={18} />
              Check History
            </button>
            <button className="btn btn-primary" onClick={() => openModal()}>
              <Plus size={18} />
              Add Deck
            </button>
          </div>
        </div>
      </div>

      {!collection.decks?.length ? (
        <div className="empty-state">
          <BookOpen size={64} />
          <h3>No Decks Yet</h3>
          <p>Add a deck to this collection to get started.</p>
          <button className="btn btn-primary mt-3" onClick={() => openModal()}>
            Add Deck
          </button>
        </div>
      ) : (
        <div className="decks-grid">
          {collection.decks.map(deck => (
            <div key={deck.id} className="deck-card">
              <Link to={`/decks/${deck.id}`} className="deck-link">
                <div className="deck-info">
                  <h3 className="deck-name">{deck.deck_name}</h3>
                  {deck.archetype && (
                    <span className="deck-archetype">{deck.archetype}</span>
                  )}
                  {deck.description && (
                    <p className="deck-desc">{deck.description}</p>
                  )}
                  <span className="deck-card-count">{deck.card_count || 0} cards</span>
                </div>
                <ChevronRight size={20} className="deck-arrow" />
              </Link>
              <div className="deck-actions">
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => { e.preventDefault(); openModal(deck); }}
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => { e.preventDefault(); handleDeleteDeck(deck.id); }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Deck Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editDeck ? 'Edit Deck' : 'New Deck'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button 
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={saving || !formData.deckName.trim()}
            >
              {saving ? 'Saving...' : (editDeck ? 'Update' : 'Create')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="input-group">
            <label htmlFor="deckName">Deck Name *</label>
            <input
              type="text"
              id="deckName"
              className="input"
              placeholder="Blue-Eyes Chaos MAX"
              value={formData.deckName}
              onChange={(e) => setFormData(f => ({ ...f, deckName: e.target.value }))}
              minLength={2}
              maxLength={200}
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="archetype">Archetype</label>
            <input
              type="text"
              id="archetype"
              className="input"
              placeholder="Blue-Eyes"
              value={formData.archetype}
              onChange={(e) => setFormData(f => ({ ...f, archetype: e.target.value }))}
            />
          </div>
          <div className="input-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              className="input"
              placeholder="Optional description..."
              value={formData.description}
              onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Collection History"
      >
        {historyLoading ? (
          <div className="loading-container">
            <div className="spinner"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state-small">
            <History size={48} />
            <h4>No Tournament History</h4>
            <p>This collection hasn't been used in any tournaments yet.</p>
          </div>
        ) : (
          <div className="history-list">
            {history.map((entry, index) => (
              <div key={entry.snapshotId} className="history-entry">
                <div className="history-header">
                  <div className="history-tournament">
                    <Trophy size={16} />
                    <Link to={`/tournaments/${entry.tournament.id}`} className="history-tournament-name">
                      {entry.tournament.name}
                    </Link>
                    <span className={`badge badge-sm badge-${getStatusColor(entry.tournament.status)}`}>
                      {entry.tournament.status}
                    </span>
                  </div>
                                  <div className="history-meta">
                    <span className="history-date">{new Date(entry.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="history-decks">
                  <span className="history-deck-count">{entry.decks.length} decks</span>
                  <div className="history-deck-names">
                    {entry.decks.map(d => d.name).join(', ')}
                  </div>
                </div>

                {entry.changes && (entry.changes.added.length > 0 || entry.changes.removed.length > 0) && (
                  <div className="history-changes">
                    {entry.changes.added.length > 0 && (
                      <div className="history-change added">
                        <PlusCircle size={14} />
                        <span>Added: {entry.changes.added.join(', ')}</span>
                      </div>
                    )}
                    {entry.changes.removed.length > 0 && (
                      <div className="history-change removed">
                        <MinusCircle size={14} />
                        <span>Removed: {entry.changes.removed.join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}

                {index === history.length - 1 && (
                  <div className="history-initial">Initial snapshot</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function getStatusColor(status) {
  return { open: 'green', in_progress: 'blue', completed: 'gold', cancelled: 'red' }[status] || 'gold';
}
