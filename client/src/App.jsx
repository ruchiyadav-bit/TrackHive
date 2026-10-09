import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { isManager, isReadOnly, isTeam, canManageTeam } from './utils/roles';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Offers from './pages/Offers';
import OfferNew from './pages/OfferNew';
import OfferEdit from './pages/OfferEdit';
import OfferDetail from './pages/OfferDetail';
import ConversionReport from './pages/ConversionReport';
import OfferReport from './pages/OfferReport';
import DailyReport from './pages/DailyReport';
import HourlyReport from './pages/HourlyReport';
import LogReport from './pages/LogReport';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
import Advertisers from './pages/Advertisers';
import AdvertiserDetail from './pages/AdvertiserDetail';
import TrackingDomains from './pages/TrackingDomains';
import AdSpend from './pages/AdSpend';
import SystemHealth from './pages/SystemHealth';
import ClickTrackerInfo from './pages/ClickTrackerInfo';
import PrivacyPolicy from './pages/PrivacyPolicy';
import PublicContact from './pages/PublicContact';

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

/**
 * Manager-only pages. A partner who types /settings/users directly lands back
 * on the dashboard instead of an empty screen that fires 403s.
 */
function ManagerRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return isManager(user) ? children : <Navigate to="/" replace />;
}

/**
 * Pages that only make sense for an account that can write. A team member who
 * types /offers/new lands back on the dashboard rather than on a form whose
 * Save button the server will refuse.
 */
function WriteRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return isReadOnly(user) ? <Navigate to="/" replace /> : children;
}

/**
 * Team administration: a manager (whole account) or a partner (its own team
 * only — the server filters the list to that team).
 */
function TeamManagerRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return canManageTeam(user) ? children : <Navigate to="/" replace />;
}

/** Tracking Domains: managers administer it, team members may look at it. */
function ManagerOrTeamRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (isManager(user) || isTeam(user)) ? children : <Navigate to="/" replace />;
}

/**
 * Pages a team member has no business opening at all — as opposed to pages
 * they may read. The single-offer page is one: it is built around the offer's
 * own money and setup, so rather than blank half of it, the role does not go
 * there and the offer list does not link to it.
 */
function HideFromTeamRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return isTeam(user) ? <Navigate to="/offers" replace /> : children;
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
      <Route path="/tracker-info" element={<ClickTrackerInfo />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/contact" element={<PublicContact />} />
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
        <Route path="/offers/new" element={<WriteRoute><OfferNew /></WriteRoute>} />
        <Route path="/offers/:id" element={<HideFromTeamRoute><OfferDetail /></HideFromTeamRoute>} />
        <Route path="/offers/:id/edit" element={<WriteRoute><OfferEdit /></WriteRoute>} />
        <Route path="/advertisers" element={<Advertisers />} />
        <Route path="/advertisers/new" element={<WriteRoute><Advertisers /></WriteRoute>} />
        <Route path="/advertisers/:id" element={<AdvertiserDetail />} />
        <Route path="/reports/conversion" element={<ConversionReport />} />
        <Route path="/reports/offer" element={<OfferReport />} />
        <Route path="/reports/daily" element={<DailyReport />} />
        <Route path="/reports/hourly" element={<HourlyReport />} />
        <Route path="/reports/logs" element={<LogReport />} />
        <Route path="/ad-spend" element={<AdSpend />} />
        <Route path="/system-health" element={<TeamManagerRoute><SystemHealth /></TeamManagerRoute>} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/*" element={<Settings />} />
        <Route
          path="/settings/tracking-domains"
          element={<ManagerOrTeamRoute><TrackingDomains /></ManagerOrTeamRoute>}
        />
        <Route
          path="/settings/users"
          element={<TeamManagerRoute><UserManagement /></TeamManagerRoute>}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
