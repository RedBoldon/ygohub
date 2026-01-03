import { useState, useEffect } from 'react';
import { useToast } from '../hooks/useToast';
import { api } from '../api/client';
import { Plus, Edit2, Trash2, Sparkles } from 'lucide-react';
import Modal from '../components/Modal';
import './CustomCards.css';

// Card types with their categories
const CARD_TYPES = {
  // Spells
  'Normal Spell': { category: 'spell', defaultRace: 'Normal' },
  'Quick-Play Spell': { category: 'spell', defaultRace: 'Quick-Play' },
  'Continuous Spell': { category: 'spell', defaultRace: 'Continuous' },
  'Equip Spell': { category: 'spell', defaultRace: 'Equip' },
  'Field Spell': { category: 'spell', defaultRace: 'Field' },
  'Ritual Spell': { category: 'spell', defaultRace: 'Ritual' },
  // Traps
  'Normal Trap': { category: 'trap', defaultRace: 'Normal' },
  'Continuous Trap': { category: 'trap', defaultRace: 'Continuous' },
  'Counter Trap': { category: 'trap', defaultRace: 'Counter' },
  // Monsters
  'Normal Monster': { category: 'monster' },
  'Effect Monster': { category: 'monster' },
  'Flip Effect Monster': { category: 'monster' },
  'Tuner Monster': { category: 'monster' },
  'Gemini Monster': { category: 'monster' },
  'Spirit Monster': { category: 'monster' },
  'Union Monster': { category: 'monster' },
  'Toon Monster': { category: 'monster' },
  'Ritual Monster': { category: 'monster' },
  'Ritual Effect Monster': { category: 'monster' },
  'Fusion Monster': { category: 'monster' },
  'Synchro Monster': { category: 'monster' },
  'Synchro Tuner Monster': { category: 'monster' },
  'XYZ Monster': { category: 'monster' },
  'Link Monster': { category: 'monster', noDefense: true },
  // Pendulum Monsters
  'Pendulum Normal Monster': { category: 'monster', pendulum: true },
  'Pendulum Effect Monster': { category: 'monster', pendulum: true },
  'Pendulum Tuner Effect Monster': { category: 'monster', pendulum: true },
  'Pendulum Flip Effect Monster': { category: 'monster', pendulum: true },
  'Synchro Pendulum Monster': { category: 'monster', pendulum: true },
  'XYZ Pendulum Monster': { category: 'monster', pendulum: true },
  'Fusion Pendulum Monster': { category: 'monster', pendulum: true },
  'Ritual Pendulum Monster': { category: 'monster', pendulum: true },
};

const ATTRIBUTES = ['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND', 'DIVINE'];

// Helper to parse pendulum description
function parsePendulumDescription(description) {
  if (!description) return { pendulumEffect: '', monsterEffect: '' };
  
  const separator = '【Monster Effect】';
  const pendulumMarker = '【Pendulum Effect】';
  
  if (description.includes(separator)) {
    const parts = description.split(separator);
    let pendulumEffect = parts[0].replace(pendulumMarker, '').trim();
    let monsterEffect = parts[1]?.trim() || '';
    return { pendulumEffect, monsterEffect };
  }
  
  return { pendulumEffect: '', monsterEffect: description };
}

// Helper to combine pendulum description
function combinePendulumDescription(pendulumEffect, monsterEffect) {
  if (!pendulumEffect && !monsterEffect) return '';
  if (!pendulumEffect) return monsterEffect;
  if (!monsterEffect) return `【Pendulum Effect】\n${pendulumEffect}`;
  return `【Pendulum Effect】\n${pendulumEffect}\n【Monster Effect】\n${monsterEffect}`;
}

export default function CustomCards() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCard, setEditCard] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    humanreadablecardtype: 'Effect Monster',
    description: '',
    pendulumEffect: '',
    monsterEffect: '',
    race: '',
    atk: '',
    def: '',
    level: '',
    attribute: 'DARK',
  });

  const toast = useToast();

  // Derived state
  const cardTypeInfo = CARD_TYPES[formData.humanreadablecardtype] || { category: 'monster' };
  const isMonster = cardTypeInfo.category === 'monster';
  const isLink = formData.humanreadablecardtype === 'Link Monster';
  const isPendulum = cardTypeInfo.pendulum === true;

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
      const cardTypeInfo = CARD_TYPES[card.humanreadablecardtype] || {};
      const isPendulumCard = cardTypeInfo.pendulum === true;
      
      let pendulumEffect = '';
      let monsterEffect = '';
      let description = card.description || '';
      
      if (isPendulumCard) {
        const parsed = parsePendulumDescription(card.description);
        pendulumEffect = parsed.pendulumEffect;
        monsterEffect = parsed.monsterEffect;
      }
      
      setFormData({
        name: card.name,
        humanreadablecardtype: card.humanreadablecardtype,
        description: isPendulumCard ? '' : description,
        pendulumEffect,
        monsterEffect,
        race: card.race || '',
        atk: card.atk?.toString() || '',
        def: card.def?.toString() || '',
        level: card.level?.toString() || '',
        attribute: card.attribute || 'DARK',
      });
    } else {
      setFormData({
        name: '',
        humanreadablecardtype: 'Effect Monster',
        description: '',
        pendulumEffect: '',
        monsterEffect: '',
        race: '',
        atk: '',
        def: '',
        level: '',
        attribute: 'DARK',
      });
    }
    setModalOpen(true);
  };

  const handleCardTypeChange = (newType) => {
    const typeInfo = CARD_TYPES[newType];
    const wasPendulum = isPendulum;
    const willBePendulum = typeInfo?.pendulum === true;
    
    setFormData(f => {
      let newFormData = {
        ...f,
        humanreadablecardtype: newType,
        // Auto-set race for spells/traps
        race: typeInfo?.defaultRace || f.race,
      };
      
      // Clear monster fields if switching to spell/trap
      if (typeInfo?.category !== 'monster') {
        newFormData = {
          ...newFormData,
          atk: '',
          def: '',
          level: '',
          attribute: '',
          pendulumEffect: '',
          monsterEffect: '',
        };
      }
      
      // Clear DEF for Link monsters
      if (newType === 'Link Monster') {
        newFormData.def = '';
      }
      
      // Handle pendulum transition
      if (wasPendulum && !willBePendulum) {
        // Was pendulum, now not - combine effects into description
        newFormData.description = f.monsterEffect || f.pendulumEffect;
        newFormData.pendulumEffect = '';
        newFormData.monsterEffect = '';
      } else if (!wasPendulum && willBePendulum) {
        // Was not pendulum, now is - move description to monster effect
        newFormData.monsterEffect = f.description;
        newFormData.description = '';
        newFormData.pendulumEffect = '';
      }
      
      return newFormData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    // Build description
    let finalDescription;
    if (isPendulum) {
      finalDescription = combinePendulumDescription(formData.pendulumEffect, formData.monsterEffect);
    } else {
      finalDescription = formData.description;
    }

    const data = {
      name: formData.name,
      humanreadablecardtype: formData.humanreadablecardtype,
      description: finalDescription,
      race: formData.race,
    };

    // Only include monster fields if it's a monster
    if (isMonster) {
      if (formData.atk) data.atk = parseInt(formData.atk);
      if (formData.def && !isLink) data.def = parseInt(formData.def);
      if (formData.level) data.level = parseInt(formData.level);
      if (formData.attribute) data.attribute = formData.attribute;
    }

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

  // Check if form is valid
  const isFormValid = () => {
    if (!formData.name.trim() || !formData.race.trim()) return false;
    if (isPendulum) {
      return formData.pendulumEffect.trim() || formData.monsterEffect.trim();
    }
    return formData.description.trim();
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
                  {card.level !== null && <span>LV{card.level}</span>}
                  {card.atk !== null && <span>ATK/{card.atk}</span>}
                  {card.def !== null && <span>DEF/{card.def}</span>}
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
              disabled={saving || !isFormValid()}
            >
              {saving ? 'Saving...' : (editCard ? 'Update' : 'Create')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="custom-card-form">
          <div className="input-group">
            <label htmlFor="name">Card Name *</label>
            <input
              type="text"
              id="name"
              className="input"
              placeholder="Blue-Eyes Custom Dragon"
              value={formData.name}
              onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
              maxLength={200}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="humanreadablecardtype">Card Type *</label>
            <select
              id="humanreadablecardtype"
              className="input"
              value={formData.humanreadablecardtype}
              onChange={(e) => handleCardTypeChange(e.target.value)}
            >
              <optgroup label="Spell Cards">
                <option value="Normal Spell">Normal Spell</option>
                <option value="Quick-Play Spell">Quick-Play Spell</option>
                <option value="Continuous Spell">Continuous Spell</option>
                <option value="Equip Spell">Equip Spell</option>
                <option value="Field Spell">Field Spell</option>
                <option value="Ritual Spell">Ritual Spell</option>
              </optgroup>
              <optgroup label="Trap Cards">
                <option value="Normal Trap">Normal Trap</option>
                <option value="Continuous Trap">Continuous Trap</option>
                <option value="Counter Trap">Counter Trap</option>
              </optgroup>
              <optgroup label="Main Deck Monsters">
                <option value="Normal Monster">Normal Monster</option>
                <option value="Effect Monster">Effect Monster</option>
                <option value="Flip Effect Monster">Flip Effect Monster</option>
                <option value="Tuner Monster">Tuner Monster</option>
                <option value="Gemini Monster">Gemini Monster</option>
                <option value="Spirit Monster">Spirit Monster</option>
                <option value="Union Monster">Union Monster</option>
                <option value="Toon Monster">Toon Monster</option>
                <option value="Ritual Monster">Ritual Monster</option>
                <option value="Ritual Effect Monster">Ritual Effect Monster</option>
              </optgroup>
              <optgroup label="Extra Deck Monsters">
                <option value="Fusion Monster">Fusion Monster</option>
                <option value="Synchro Monster">Synchro Monster</option>
                <option value="Synchro Tuner Monster">Synchro Tuner Monster</option>
                <option value="XYZ Monster">XYZ Monster</option>
                <option value="Link Monster">Link Monster</option>
              </optgroup>
              <optgroup label="Pendulum Monsters">
                <option value="Pendulum Normal Monster">Pendulum Normal Monster</option>
                <option value="Pendulum Effect Monster">Pendulum Effect Monster</option>
                <option value="Pendulum Tuner Effect Monster">Pendulum Tuner Effect Monster</option>
                <option value="Pendulum Flip Effect Monster">Pendulum Flip Effect Monster</option>
                <option value="Synchro Pendulum Monster">Synchro Pendulum Monster</option>
                <option value="XYZ Pendulum Monster">XYZ Pendulum Monster</option>
                <option value="Fusion Pendulum Monster">Fusion Pendulum Monster</option>
                <option value="Ritual Pendulum Monster">Ritual Pendulum Monster</option>
              </optgroup>
            </select>
          </div>

          <div className="input-group">
            <label htmlFor="race">
              {isMonster ? 'Monster Type *' : 'Spell/Trap Type *'}
            </label>
            <input
              type="text"
              id="race"
              className="input"
              placeholder={isMonster ? 'Dragon, Warrior, Spellcaster...' : 'Normal, Continuous, Counter...'}
              value={formData.race}
              onChange={(e) => setFormData(f => ({ ...f, race: e.target.value }))}
              maxLength={30}
              required
            />
            <span className="input-hint">Max 30 characters</span>
          </div>

          {/* Pendulum cards have two effect boxes */}
          {isPendulum ? (
            <>
              <div className="input-group pendulum-effect-group">
                <label htmlFor="pendulumEffect">
                  <span className="effect-label pendulum-label">Pendulum Effect</span>
                </label>
                <textarea
                  id="pendulumEffect"
                  className="input pendulum-textarea"
                  placeholder="Once per turn, you can..."
                  value={formData.pendulumEffect}
                  onChange={(e) => setFormData(f => ({ ...f, pendulumEffect: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="input-group monster-effect-group">
                <label htmlFor="monsterEffect">
                  <span className="effect-label monster-label">Monster Effect</span>
                </label>
                <textarea
                  id="monsterEffect"
                  className="input monster-textarea"
                  placeholder="When this card is summoned..."
                  value={formData.monsterEffect}
                  onChange={(e) => setFormData(f => ({ ...f, monsterEffect: e.target.value }))}
                  rows={3}
                />
              </div>
            </>
          ) : (
            <div className="input-group">
              <label htmlFor="description">
                {isMonster ? 'Effect/Flavor Text *' : 'Card Effect *'}
              </label>
              <textarea
                id="description"
                className="input"
                placeholder={isMonster 
                  ? 'This legendary dragon is a powerful engine of destruction...'
                  : 'Activate this card when...'
                }
                value={formData.description}
                onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                rows={4}
                required
              />
            </div>
          )}

          {/* Monster-only fields */}
          {isMonster && (
            <>
              <div className="form-row">
                <div className="input-group">
                  <label htmlFor="attribute">Attribute *</label>
                  <select
                    id="attribute"
                    className="input"
                    value={formData.attribute}
                    onChange={(e) => setFormData(f => ({ ...f, attribute: e.target.value }))}
                    required
                  >
                    {ATTRIBUTES.map(attr => (
                      <option key={attr} value={attr}>{attr}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label htmlFor="level">
                    {isLink ? 'Link Rating' : isPendulum ? 'Level/Rank & Scale' : 'Level/Rank'}
                  </label>
                  <input
                    type="number"
                    id="level"
                    className="input"
                    min="0"
                    max="13"
                    placeholder={isLink ? '1-6' : '1-12'}
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
                    step="50"
                    placeholder="3000"
                    value={formData.atk}
                    onChange={(e) => setFormData(f => ({ ...f, atk: e.target.value }))}
                  />
                </div>
                {!isLink && (
                  <div className="input-group">
                    <label htmlFor="def">DEF</label>
                    <input
                      type="number"
                      id="def"
                      className="input"
                      min="0"
                      step="50"
                      placeholder="2500"
                      value={formData.def}
                      onChange={(e) => setFormData(f => ({ ...f, def: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
