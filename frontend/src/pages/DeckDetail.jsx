import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import { api } from '../api/client';
import { ArrowLeft, Plus, Trash2, BookOpen } from 'lucide-react';
import './DeckDetail.css';

export default function DeckDetail() {
  const { id } = useParams();
  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);

  const toast = useToast();

  useEffect(() => {
    loadDeck();
  }, [id]);

  const loadDeck = async () => {
    try {
      const data = await api.customCollections.getDeck(id);
      setDeck(data.deck);
    } catch (err) {
      toast.error('Failed to load deck');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCard = async (card) => {
    try {
      await api.customCollections.removeCard(id, {
        cardId: card.card_id || undefined,
        customCardId: card.custom_card_id || undefined,
        deckSection: card.deck_section,
      });
      toast.success('Card removed');
      loadDeck();
    } catch (err) {
      toast.error(err.message || 'Failed to remove card');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="container">
        <div className="empty-state">
          <BookOpen size={64} />
          <h3>Deck Not Found</h3>
          <Link to="/collections" className="btn btn-primary mt-3">
            Back to Collections
          </Link>
        </div>
      </div>
    );
  }

  const mainDeck = deck.cards?.filter(c => c.deck_section === 'main') || [];
  const extraDeck = deck.cards?.filter(c => c.deck_section === 'extra') || [];
  const sideDeck = deck.cards?.filter(c => c.deck_section === 'side') || [];

  return (
    <div className="container">
      <div className="page-header">
        <Link to={`/collections/${deck.collection_id}`} className="back-link">
          <ArrowLeft size={18} />
          Back to Collection
        </Link>
        <div className="flex justify-between items-center mt-2">
          <div>
            <h1 className="page-title">{deck.deck_name}</h1>
            {deck.archetype && (
              <span className="deck-archetype-badge">{deck.archetype}</span>
            )}
            {deck.description && (
              <p className="page-subtitle">{deck.description}</p>
            )}
          </div>
          <Link to="/cards" className="btn btn-primary">
            <Plus size={18} />
            Add Cards
          </Link>
        </div>
      </div>

      <div className="deck-sections">
        {/* Main Deck */}
        <section className="deck-section">
          <div className="section-header">
            <h2 className="section-title">Main Deck</h2>
            <span className="section-count">{mainDeck.reduce((sum, c) => sum + c.quantity, 0)} cards</span>
          </div>
          {mainDeck.length === 0 ? (
            <p className="section-empty">No cards in main deck</p>
          ) : (
            <div className="cards-grid">
              {mainDeck.map((card, i) => (
                <CardItem 
                  key={i} 
                  card={card} 
                  onRemove={() => handleRemoveCard(card)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Extra Deck */}
        <section className="deck-section">
          <div className="section-header">
            <h2 className="section-title">Extra Deck</h2>
            <span className="section-count">{extraDeck.reduce((sum, c) => sum + c.quantity, 0)} cards</span>
          </div>
          {extraDeck.length === 0 ? (
            <p className="section-empty">No cards in extra deck</p>
          ) : (
            <div className="cards-grid">
              {extraDeck.map((card, i) => (
                <CardItem 
                  key={i} 
                  card={card} 
                  onRemove={() => handleRemoveCard(card)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Side Deck */}
        <section className="deck-section">
          <div className="section-header">
            <h2 className="section-title">Side Deck</h2>
            <span className="section-count">{sideDeck.reduce((sum, c) => sum + c.quantity, 0)} cards</span>
          </div>
          {sideDeck.length === 0 ? (
            <p className="section-empty">No cards in side deck</p>
          ) : (
            <div className="cards-grid">
              {sideDeck.map((card, i) => (
                <CardItem 
                  key={i} 
                  card={card} 
                  onRemove={() => handleRemoveCard(card)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function CardItem({ card, onRemove }) {
  return (
    <div className="card-item">
      <div className="card-item-info">
        <span className="card-item-name">{card.name}</span>
        <span className="card-item-qty">×{card.quantity}</span>
      </div>
      <div className="card-item-meta">
        <span className={`card-type card-type-${card.frametype}`}>
          {card.humanreadablecardtype || card.type}
        </span>
      </div>
      <button className="card-remove" onClick={onRemove}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}
