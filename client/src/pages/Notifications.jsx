import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, Info, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../api/client';
import { formatDate } from '../utils/formatDate';

const severityConfig = {
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
  success: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifications = async () => {
    try {
      const params = {};
      if (filter) params.type = filter;
      if (unreadOnly) params.unread = 'true';
      const { data } = await api.get('/notifications', { params });
      setNotifications(data.notifications);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [filter, unreadOnly]);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <button
          onClick={markAllRead}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
        >
          <CheckCheck size={14} /> Mark all read
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Types</option>
          <option value="cap_alert">Cap Alerts</option>
          <option value="conversion_spike">Conversion Spikes</option>
          <option value="offer_expired">Offer Expired</option>
          <option value="system">System</option>
          <option value="anomaly">Anomaly</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600"
          />
          Unread only
        </label>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Bell size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500">No notifications</p>
          </div>
        ) : (
          notifications.map((n) => {
            const config = severityConfig[n.severity] || severityConfig.info;
            const Icon = config.icon;
            const isRead = n.readBy?.length > 0;

            return (
              <div
                key={n._id}
                className={`bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 ${
                  !isRead ? 'border-l-4 border-l-indigo-500' : ''
                }`}
              >
                <div className={`p-2 rounded-lg ${config.bg}`}>
                  <Icon size={16} className={config.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">{n.title}</h3>
                    <span className="text-xs text-gray-400">{formatDate(n.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                  {n.offerName && (
                    <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {n.offerName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!isRead && (
                    <button
                      onClick={() => markRead(n._id)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      title="Mark read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(n._id)}
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
