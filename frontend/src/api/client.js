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

// API methods
// Auth routes are under /api directly (not /api/auth)
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
    
    editSnapshot: (snapshotCardId, changes, propagateToSource = false) => 
      apiRequest(`/custom-cards/snapshot/${snapshotCardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ changes, propagateToSource }),
      }),
  },

  // Custom Collections
  customCollections: {
    list: () => apiRequest('/custom-collections'),
    
    get: (id) => apiRequest(`/custom-collections/${id}`),
    
    create: (name, description) => 
      apiRequest('/custom-collections', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      }),
    
    update: (id, data) => 
      apiRequest(`/custom-collections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    
    delete: (id) => 
      apiRequest(`/custom-collections/${id}`, {
        method: 'DELETE',
      }),

    // Decks
    addDeck: (collectionId, deckName, archetype, description) => 
      apiRequest(`/custom-collections/${collectionId}/decks`, {
        method: 'POST',
        body: JSON.stringify({ deckName, archetype, description }),
      }),
    
    getDeck: (deckId) => apiRequest(`/custom-collections/decks/${deckId}`),
    
    updateDeck: (deckId, data) => 
      apiRequest(`/custom-collections/decks/${deckId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    
    deleteDeck: (deckId) => 
      apiRequest(`/custom-collections/decks/${deckId}`, {
        method: 'DELETE',
      }),

    // Deck Cards
    addCard: (deckId, cardData) => 
      apiRequest(`/custom-collections/decks/${deckId}/cards`, {
        method: 'POST',
        body: JSON.stringify(cardData),
      }),
    
    removeCard: (deckId, cardData) => 
      apiRequest(`/custom-collections/decks/${deckId}/cards`, {
        method: 'DELETE',
        body: JSON.stringify(cardData),
      }),

    // Snapshots
    createSeriesSnapshot: (collectionId, seriesId) => 
      apiRequest(`/custom-collections/${collectionId}/snapshots/series`, {
        method: 'POST',
        body: JSON.stringify({ seriesId }),
      }),
    
    createTournamentSnapshot: (tournamentId, sourceType, sourceId, seriesId) => 
      apiRequest('/custom-collections/snapshots/tournament', {
        method: 'POST',
        body: JSON.stringify({ tournamentId, sourceType, sourceId, seriesId }),
      }),
    
    getSnapshot: (snapshotId) => 
      apiRequest(`/custom-collections/snapshots/${snapshotId}`),
    
    lockSnapshot: (snapshotId) => 
      apiRequest(`/custom-collections/snapshots/${snapshotId}/lock`, {
        method: 'POST',
      }),
  },

  // Cards (official)
  cards: {
    search: (params) => {
      const query = new URLSearchParams(params).toString();
      return apiRequest(`/cards?${query}`);
    },
  },
};

export default api;
