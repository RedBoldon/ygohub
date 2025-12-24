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
  BookOpen
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

  const toast = useToast();

  useEffect(() => {
    loadCollection();
  }, [id]);

  const loadCollection = async () => {
    try {
      const data = await api.customCollections.get(id);
      setCollection(data.collection);
    } catch (err) {
      toast.error('Failed to load collection');
    } finally {
      setLoading(false);
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
        await api.customCollections.updateDeck(editDeck.id, {
          deckName: formData.deckName,
          archetype: formData.archetype,
          description: formData.description,
        });
        toast.success('Deck updated');
      } else {
        await api.customCollections.addDeck(
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
      await api.customCollections.deleteDeck(deckId);
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
          <button className="btn btn-primary" onClick={() => openModal()}>
            <Plus size={18} />
            Add Deck
          </button>
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
                </div>
                <ChevronRight size={20} className="deck-arrow" />
              </Link>
              <div className="deck-actions">
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={() => openModal(deck)}
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDeleteDeck(deck.id)}
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
    </div>
  );
}
