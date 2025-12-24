import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import { api } from '../api/client';
import { Plus, Layers, ChevronRight, Edit2, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import './Collections.css';

export default function Collections() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCollection, setEditCollection] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const toast = useToast();

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      const data = await api.customCollections.list();
      setCollections(data.collections || []);
    } catch (err) {
      toast.error('Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (collection = null) => {
    setEditCollection(collection);
    setFormData({
      name: collection?.name || '',
      description: collection?.description || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editCollection) {
        await api.customCollections.update(editCollection.id, formData);
        toast.success('Collection updated');
      } else {
        await api.customCollections.create(formData.name, formData.description);
        toast.success('Collection created');
      }
      setModalOpen(false);
      loadCollections();
    } catch (err) {
      toast.error(err.message || 'Failed to save collection');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this collection?')) return;

    try {
      await api.customCollections.delete(id);
      toast.success('Collection deleted');
      loadCollections();
    } catch (err) {
      toast.error(err.message || 'Failed to delete collection');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Deck Collections</h1>
          <p className="page-subtitle">Organize your decks into collections</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} />
          New Collection
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="empty-state">
          <Layers size={64} />
          <h3>No Collections Yet</h3>
          <p>Create a collection to start organizing your decks.</p>
          <button className="btn btn-primary mt-3" onClick={() => openModal()}>
            Create Collection
          </button>
        </div>
      ) : (
        <div className="collections-grid">
          {collections.map(collection => (
            <div key={collection.id} className="collection-card">
              <Link to={`/collections/${collection.id}`} className="collection-link">
                <div className="collection-icon">
                  <Layers size={24} />
                </div>
                <div className="collection-info">
                  <h3 className="collection-name">{collection.name}</h3>
                  {collection.description && (
                    <p className="collection-desc">{collection.description}</p>
                  )}
                  <span className="collection-meta">
                    {collection.deck_count || 0} decks
                  </span>
                </div>
                <ChevronRight size={20} className="collection-arrow" />
              </Link>
              <div className="collection-actions">
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={() => openModal(collection)}
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDelete(collection.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editCollection ? 'Edit Collection' : 'New Collection'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button 
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={saving || !formData.name.trim()}
            >
              {saving ? 'Saving...' : (editCollection ? 'Update' : 'Create')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="input-group">
            <label htmlFor="name">Name *</label>
            <input
              type="text"
              id="name"
              className="input"
              placeholder="My Custom Decks"
              value={formData.name}
              onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
              minLength={2}
              maxLength={200}
              required
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
