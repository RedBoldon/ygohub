// API Client with automatic token refresh

const API_BASE = '/api';

let accessToken = localStorage.getItem('accessToken');
let refreshToken = localStorage.getItem('refreshToken');

// Event for auth state changes
const authEvents = new EventTarget();

export const onAuthChange = (callback) => {
  authEvents.addEventListener('authChange', callback);
  return () => authEvents.removeEventListener('authChange', callback);
};

export const setTokens = (access, refresh) => {
  accessToken = access;
  refreshToken = refresh;
  if (access) {
    localStorage.setItem('accessToken', access);
  } else {
    localStorage.removeItem('accessToken');
  }
  if (refresh) {
    localStorage.setItem('refreshToken', refresh);
  } else {
    localStorage.removeItem('refreshToken');
  }
  authEvents.dispatchEvent(new Event('authChange'));
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  authEvents.dispatchEvent(new Event('authChange'));
};

export const getAccessToken = () => accessToken;

// Refresh the access token
async function refreshAccessToken() {
  if (!refreshToken) {
    throw new Error('No refresh token');
  }

  const response = await fetch(`${API_BASE}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearTokens();
    throw new Error('Token refresh failed');
  }

  const data = await response.json();
  setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

// Main API request function
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(url, { ...options, headers });

  // If 401 and we have a refresh token, try to refresh
  if (response.status === 401 && refreshToken) {
    try {
      const newToken = await refreshAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, { ...options, headers });
    } catch (err) {
      clearTokens();
      throw new Error('Session expired');
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = response.status;
    error.details = data.details;
    throw error;
  }

  return data;
}

// Helper to build query string with custom flag
function buildCustomQuery(isCustom, extraParams = {}) {
  const params = { ...extraParams };
  if (isCustom) params.custom = 'true';
  const query = new URLSearchParams(params).toString();
  return query ? `?${query}` : '';
}

// API methods
export const api = {
  // Auth
  auth: {
    register: (email, password) => 
      apiRequest('/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    
    login: (email, password) => 
      apiRequest('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    
    logout: () => 
      apiRequest('/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),
    
    me: () => apiRequest('/me'),
    
    setUsername: (username, tag) => 
      apiRequest('/user/username', {
        method: 'POST',
        body: JSON.stringify({ username, tag }),
      }),
  },

  // Tournaments
  tournaments: {
    list: () => apiRequest('/tournaments'),
    
    create: (data) => 
      apiRequest('/tournaments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    get: (id) => apiRequest(`/tournaments/${id}`),
    
    join: (inviteCode) => 
      apiRequest(`/tournaments/join/${inviteCode}`, {
        method: 'POST',
      }),
    
    start: (id) => 
      apiRequest(`/tournaments/${id}/start`, {
        method: 'POST',
      }),
    
    advance: (id) => 
      apiRequest(`/tournaments/${id}/advance`, {
        method: 'POST',
      }),
    
    standings: (id) => apiRequest(`/tournaments/${id}/standings`),
    
    reportResult: (matchId, team1Score, team2Score) => 
      apiRequest(`/tournaments/matches/${matchId}/result`, {
        method: 'POST',
        body: JSON.stringify({ team1Score, team2Score }),
      }),
    
    assignDeck: (tournamentId, playerId, deckId) =>
      apiRequest(`/tournaments/${tournamentId}/assign-deck`, {
        method: 'POST',
        body: JSON.stringify({ playerId, deckId }),
      }),
    
    // Player deck selection (Player Mode)
    getMyDecks: (tournamentId) => apiRequest(`/tournaments/${tournamentId}/my-decks`),
    
    selectDeck: (tournamentId, deckId) =>
      apiRequest(`/tournaments/${tournamentId}/select-deck`, {
        method: 'POST',
        body: JSON.stringify({ deckId }),
      }),
    
    // Series
    listSeries: () => apiRequest('/tournaments/series'),
    
    createSeries: (name, description) => 
      apiRequest('/tournaments/series', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      }),
  },

  // Cards (official database)
  cards: {
    search: (params) => {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([_, v]) => v))
      ).toString();
      return apiRequest(`/cards?${query}`);
    },
    
    get: (id) => apiRequest(`/cards/${id}`),
    
    archetypes: () => apiRequest('/cards/meta/archetypes'),
    
    races: () => apiRequest('/cards/meta/races'),
  },

  // Collections (user deck collections - unified API for standard and custom)
  collections: {
    // List all collections (both standard and custom)
    list: () => apiRequest('/collections'),
    
    // Get a specific collection
    // isCustom: whether this is a custom collection (allow_custom_cards: true)
    get: (id, isCustom = false) => 
      apiRequest(`/collections/${id}${buildCustomQuery(isCustom)}`),
    
    // Create a new collection
    // allowCustomCards: if true, creates in custom_deck_collections
    create: (name, description, allowCustomCards = false) => 
      apiRequest('/collections', {
        method: 'POST',
        body: JSON.stringify({ name, description, allowCustomCards }),
      }),
    
    update: (id, data, isCustom = false) => 
      apiRequest(`/collections/${id}${buildCustomQuery(isCustom)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    
    delete: (id, isCustom = false) => 
      apiRequest(`/collections/${id}${buildCustomQuery(isCustom)}`, {
        method: 'DELETE',
      }),

    // Decks
    createDeck: (collectionId, deckName, archetype, description, isCustom = false) => 
      apiRequest(`/collections/${collectionId}/decks${buildCustomQuery(isCustom)}`, {
        method: 'POST',
        body: JSON.stringify({ deckName, archetype, description }),
      }),
    
    getDeck: (deckId, isCustom = false) => 
      apiRequest(`/collections/decks/${deckId}${buildCustomQuery(isCustom)}`),
    
    updateDeck: (deckId, data, isCustom = false) => 
      apiRequest(`/collections/decks/${deckId}${buildCustomQuery(isCustom)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    
    deleteDeck: (deckId, isCustom = false) => 
      apiRequest(`/collections/decks/${deckId}${buildCustomQuery(isCustom)}`, {
        method: 'DELETE',
      }),
    
    getDeckStats: (deckId, isCustom = false) => 
      apiRequest(`/collections/decks/${deckId}/stats${buildCustomQuery(isCustom)}`),

    // Deck Cards
    // For custom collections, you can pass customCardId instead of cardId
    addCard: (deckId, cardId, quantity = 1, deckSection = 'main', isCustom = false, customCardId = null) => 
      apiRequest(`/collections/decks/${deckId}/cards${buildCustomQuery(isCustom)}`, {
        method: 'POST',
        body: JSON.stringify({ 
          cardId: customCardId ? null : cardId, 
          customCardId, 
          quantity, 
          deckSection 
        }),
      }),
    
    updateCard: (deckId, cardId, quantity, deckSection, isCustom = false, isCustomCard = false) => 
      apiRequest(`/collections/decks/${deckId}/cards/${cardId}${buildCustomQuery(isCustom, { customCard: isCustomCard ? 'true' : undefined })}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity, deckSection }),
      }),
    
    removeCard: (deckId, cardId, deckSection, isCustom = false, isCustomCard = false) => {
      const params = {};
      if (deckSection) params.deckSection = deckSection;
      if (isCustomCard) params.customCard = 'true';
      return apiRequest(`/collections/decks/${deckId}/cards/${cardId}${buildCustomQuery(isCustom, params)}`, {
        method: 'DELETE',
      });
    },
    
    // History
    getHistory: (collectionId, isCustom = false) => 
      apiRequest(`/collections/${collectionId}/history${buildCustomQuery(isCustom)}`),
    
    getDeckHistory: (deckId, isCustom = false) => 
      apiRequest(`/collections/decks/${deckId}/history${buildCustomQuery(isCustom)}`),
  },

  // Custom Cards
  customCards: {
    list: () => apiRequest('/custom-cards'),
    
    get: (id) => apiRequest(`/custom-cards/${id}`),
    
    create: (data) => 
      apiRequest('/custom-cards', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    update: (id, data) => 
      apiRequest(`/custom-cards/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    
    delete: (id) => 
      apiRequest(`/custom-cards/${id}`, {
        method: 'DELETE',
      }),
    
    // History - shows how the card changed across tournaments
    getHistory: (id) => apiRequest(`/custom-cards/${id}/history`),
  },
};

export default api;
