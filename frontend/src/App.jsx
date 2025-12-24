import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { useAuth } from './hooks/useAuth';

// Layout
import Navbar from './components/Navbar';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import SetUsername from './pages/SetUsername';
import Dashboard from './pages/Dashboard';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import CreateTournament from './pages/CreateTournament';
import JoinTournament from './pages/JoinTournament';
import Collections from './pages/Collections';
import CollectionDetail from './pages/CollectionDetail';
import DeckDetail from './pages/DeckDetail';
import CustomCards from './pages/CustomCards';
import CardSearch from './pages/CardSearch';

// Protected Route wrapper
function ProtectedRoute({ children, requireUsername = true }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireUsername && user.status === 'no_username') {
    return <Navigate to="/set-username" replace />;
  }

  return children;
}

// Guest Route (redirect if already logged in)
function GuestRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (user) {
    if (user.status === 'no_username') {
      return <Navigate to="/set-username" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
      
      {/* Set Username (protected but doesn't require username) */}
      <Route path="/set-username" element={
        <ProtectedRoute requireUsername={false}><SetUsername /></ProtectedRoute>
      } />

      {/* Protected Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      
      {/* Tournaments */}
      <Route path="/tournaments" element={<ProtectedRoute><Tournaments /></ProtectedRoute>} />
      <Route path="/tournaments/create" element={<ProtectedRoute><CreateTournament /></ProtectedRoute>} />
      <Route path="/tournaments/join" element={<ProtectedRoute><JoinTournament /></ProtectedRoute>} />
      <Route path="/tournaments/join/:inviteCode" element={<ProtectedRoute><JoinTournament /></ProtectedRoute>} />
      <Route path="/tournaments/:id" element={<ProtectedRoute><TournamentDetail /></ProtectedRoute>} />
      
      {/* Collections */}
      <Route path="/collections" element={<ProtectedRoute><Collections /></ProtectedRoute>} />
      <Route path="/collections/:id" element={<ProtectedRoute><CollectionDetail /></ProtectedRoute>} />
      <Route path="/decks/:id" element={<ProtectedRoute><DeckDetail /></ProtectedRoute>} />
      
      {/* Cards */}
      <Route path="/custom-cards" element={<ProtectedRoute><CustomCards /></ProtectedRoute>} />
      <Route path="/cards" element={<ProtectedRoute><CardSearch /></ProtectedRoute>} />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <div className="app">
            <Navbar />
            <main className="page">
              <AppRoutes />
            </main>
          </div>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
