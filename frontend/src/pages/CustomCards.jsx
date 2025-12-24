import { useState, useEffect } from 'react';
import { useToast } from '../hooks/useToast';
import { api } from '../api/client';
import { Plus, Edit2, Trash2, Sparkles } from 'lucide-react';
import Modal from '../components/Modal';
import './CustomCards.css';

const FRAME_TYPES = [
  'spell', 'effect', 'normal', 'link', 'trap', 'fusion',
  'effect_pendulum', 'xyz', 'synchro', 'ritual', 'token',
  'fusion_pendulum', 'normal_pendulum', 'synchro_pendulum',
  'xyz_pendulum', 'ritual_pendulum'
];

const ATTRIBUTES = ['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND', 'DIVINE'];

export default function CustomCards() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCard, setEditCard] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'Effect Monster',
    humanReadableCardType: 'Effect Monster',
    frameType: 'effect',
    description: '',
    race: '',
    archetype: '',
    atk: '',
    def: '',
    level: '',
    attribute: '',
  });

  const toast = useToast();

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      const data = await api.customCards.list();
      setCards(data.cards || []);
    } catch (err) {
      toast.error('Failed to load custom cards');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (card = null) => {
    setEditCard(card);
    if (card) {
      setFormData({
        name: card.name,
        type: card.type,
        humanReadableCardType: card.humanreadablecardtype,
        frameType: card.frametype,
        description: card.description,
        race: card.race || '',
        archetype: card.archetype || '',
        atk: card.atk?.toString() || '',
        def: card.def?.toString() || '',
        level: card.level?.toString() || '',
        attribute: card.attribute || '',
      });
    } else {
      setFormData({
        name: '',
        type: 'Effect Monster',
        humanReadableCardType: 'Effect Monster',
        frameType: 'effect',
        description: '',
        race: '',
        archetype: '',
        atk: '',
        def: '',
        level: '',
        attribute: '',
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const data = {
      name: formData.name,
      type: formData.type,
      humanReadableCardType: formData.humanReadableCardType,
      frameType: formData.frameType,
      description: formData.description,
      race: formData.race,
    };

    if (formData.archetype) data.archetype = formData.archetype;
    if (formData.atk) data.atk = parseInt(formData.atk);
    if (formData.def) data.def = parseInt(formData.def);
    if (formData.level) data.level = parseInt(formData.level);
    if (formData.attribute) data.attribute = formData.attribute;

    try {
      if (editCard) {
        await api.customCards.update(editCard.id, data);
        toast.success('Card updated');
      } else {
        await api.customCards.create(data);
        toast.success('Card created');
      }
      setModalOpen(false);
      loadCards();
    } catch (err) {
      toast.error(err.message || 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this card?')) return;

    try {
      await api.customCards.delete(id);
      toast.success('Card deleted');
      loadCards();
    } catch (err) {
      toast.error(err.message || 'Failed to delete card');
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
          <h1 className="page-title">Custom Cards</h1>
          <p className="page-subtitle">Create and manage your custom cards</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} />
          New Card
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="empty-state">
          <Sparkles size={64} />
          <h3>No Custom Cards Yet</h3>
          <p>Create your first custom card to use in alternative formats.</p>
          <button className="btn btn-primary mt-3" onClick={() => openModal()}>
            Create Card
          </button>
        </div>
      ) : (
        <div className="custom-cards-grid">
          {cards.map(card => (
            <div key={card.id} className={`custom-card custom-card-${card.frametype}`}>
              <div className="custom-card-header">
                <h3 className="custom-card-name">{card.name}</h3>
                {card.attribute && (
                  <span className="custom-card-attr">{card.attribute}</span>
                )}
              </div>
              <div className="custom-card-type">
                {card.humanreadablecardtype}
                {card.race && ` / ${card.race}`}
              </div>
              <p className="custom-card-desc">{card.description}</p>
              {(card.atk !== null || card.def !== null) && (
                <div className="custom-card-stats">
                  {card.atk !== null && <span>ATK/{card.atk}</span>}
                  {card.def !== null && <span>DEF/{card.def}</span>}
                  {card.level !== null && <span>LV{card.level}</span>}
                </div>
              )}
              <div className="custom-card-actions">
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={() => openModal(card)}
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDelete(card.id)}
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
        title={editCard ? 'Edit Custom Card' : 'New Custom Card'}
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
              {saving ? 'Saving...' : (editCard ? 'Update' : 'Create')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="custom-card-form">
          <div className="form-row">
            <div className="input-group">
              <label htmlFor="name">Name *</label>
              <input
                type="text"
                id="name"
                className="input"
                value={formData.name}
                onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="frameType">Frame Type *</label>
              <select
                id="frameType"
                className="input"
                value={formData.frameType}
                onChange={(e) => setFormData(f => ({ ...f, frameType: e.target.value }))}
              >
                {FRAME_TYPES.map(ft => (
                  <option key={ft} value={ft}>{ft}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="input-group">
              <label htmlFor="type">Type *</label>
              <input
                type="text"
                id="type"
                className="input"
                placeholder="Effect Monster"
                value={formData.type}
                onChange={(e) => setFormData(f => ({ ...f, type: e.target.value }))}
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="humanReadableCardType">Card Type Display *</label>
              <input
                type="text"
                id="humanReadableCardType"
                className="input"
                placeholder="Effect Monster"
                value={formData.humanReadableCardType}
                onChange={(e) => setFormData(f => ({ ...f, humanReadableCardType: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              className="input"
              value={formData.description}
              onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
              rows={4}
              required
            />
          </div>

          <div className="form-row">
            <div className="input-group">
              <label htmlFor="race">Race/Type *</label>
              <input
                type="text"
                id="race"
                className="input"
                placeholder="Dragon"
                value={formData.race}
                onChange={(e) => setFormData(f => ({ ...f, race: e.target.value }))}
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
          </div>

          <div className="form-row">
            <div className="input-group">
              <label htmlFor="attribute">Attribute</label>
              <select
                id="attribute"
                className="input"
                value={formData.attribute}
                onChange={(e) => setFormData(f => ({ ...f, attribute: e.target.value }))}
              >
                <option value="">None</option>
                {ATTRIBUTES.map(attr => (
                  <option key={attr} value={attr}>{attr}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label htmlFor="level">Level/Rank</label>
              <input
                type="number"
                id="level"
                className="input"
                min="0"
                max="13"
                value={formData.level}
                onChange={(e) => setFormData(f => ({ ...f, level: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="input-group">
              <label htmlFor="atk">ATK</label>
              <input
                type="number"
                id="atk"
                className="input"
                min="0"
                value={formData.atk}
                onChange={(e) => setFormData(f => ({ ...f, atk: e.target.value }))}
              />
            </div>
            <div className="input-group">
              <label htmlFor="def">DEF</label>
              <input
                type="number"
                id="def"
                className="input"
                min="0"
                value={formData.def}
                onChange={(e) => setFormData(f => ({ ...f, def: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
