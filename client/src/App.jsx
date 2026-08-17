import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Offers from './pages/Offers';
import OfferNew from './pages/OfferNew';
import OfferEdit from './pages/OfferEdit';
import OfferDetail from './pages/OfferDetail';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ClickReport from './pages/ClickReport';
import UserManagement from './pages/UserManagement';
import Advertisers from './pages/Advertisers';
import AdvertiserDetail from './pages/AdvertiserDetail';
import TrackingDomains from './pages/TrackingDomains';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestRoute>
            <Login />
          </GuestRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <GuestRoute>
            <Signup />
          </GuestRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/offers/new" element={<OfferNew />} />
        <Route path="/offers/:id" element={<OfferDetail />} />
        <Route path="/offers/:id/edit" element={<OfferEdit />} />
        <Route path="/advertisers" element={<Advertisers />} />
        <Route path="/advertisers/new" element={<Advertisers />} />
        <Route path="/advertisers/:id" element={<AdvertiserDetail />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/*" element={<Reports />} />
        <Route path="/reports/clicks" element={<ClickReport />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/*" element={<Settings />} />
        <Route path="/settings/tracking-domains" element={<TrackingDomains />} />
        <Route path="/settings/users" element={<UserManagement />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
