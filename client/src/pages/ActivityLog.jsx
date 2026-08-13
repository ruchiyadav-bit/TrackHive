import { useState, useEffect } from 'react';
import { Activity, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/client';

const ACTION_LABELS = {
 offer_created: 'Offer Created',
 offer_edited: 'Offer Edited',
 offer_deleted: 'Offer Deleted',
 offer_duplicated: 'Offer Duplicated',
 offer_paused: 'Offer Paused',
 offer_activated: 'Offer Activated',
 status_changed: 'Status Changed',
 user_login: 'User Login',
 user_created: 'User Created',
 user_updated: 'User Updated',
 settings_updated: 'Settings Updated',
 bulk_import: 'Bulk Import',
 template_created: 'Template Created',
 template_deleted: 'Template Deleted',
 group_created: 'Group Created',
 group_edited: 'Group Edited',
 group_deleted: 'Group Deleted',
};

const ACTION_COLORS = {
 offer_created: 'bg-green-100 text-green-700',
 offer_edited: 'bg-blue-100 text-blue-700',
 offer_deleted: 'bg-red-100 text-red-700',
 offer_duplicated: 'bg-purple-100 text-purple-700',
 offer_paused: 'bg-yellow-100 text-yellow-700',
 offer_activated: 'bg-green-100 text-green-700',
 user_login: 'bg-gray-100 text-gray-700',
 bulk_import: 'bg-blue-100 text-blue-700',
 template_created: 'bg-teal-100 text-teal-700',
 group_created: 'bg-orange-100 text-orange-700',
};

export default function ActivityLog() {
 const [logs, setLogs] = useState([]);
 const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
 const [loading, setLoading] = useState(true);
 const [filters, setFilters] = useState({ action: '', entityType: '', search: '', from: '', to: '' });
 const [showFilters, setShowFilters] = useState(false);

 const fetchLogs = async (page = 1) => {
 setLoading(true);
 try {
 const params = { page, limit: 30 };
 if (filters.action) params.action = filters.action;
 if (filters.entityType) params.entityType = filters.entityType;
 if (filters.search) params.search = filters.search;
 if (filters.from) params.from = filters.from;
 if (filters.to) params.to = filters.to;

 const { data } = await api.get('/activity', { params });
 setLogs(data.logs || []);
 setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
 } catch (err) {
 console.error(err);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => { fetchLogs(); }, []);

 const applyFilters = () => fetchLogs(1);
 const clearFilters = () => {
 setFilters({ action: '', entityType: '', search: '', from: '', to: '' });
 setTimeout(() => fetchLogs(1), 0);
 };

 return (
 <div>
 <div className="flex items-center justify-between mb-6">
 <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
 <div className="flex items-center gap-2">
 <span className="text-sm text-gray-500">{pagination.total} entries</span>
 <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-lg border text-sm ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
 <Filter size={16} />
 </button>
 </div>
 </div>

 {/* Filters */}
 {showFilters && (
 <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
 <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
 <div className="relative">
 <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
 <input value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
 placeholder="Name or user..."
 className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-900" />
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
 <select value={filters.action} onChange={e => setFilters(p => ({ ...p, action: e.target.value }))}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white text-gray-900">
 <option value="">All Actions</option>
 {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1">Entity Type</label>
 <select value={filters.entityType} onChange={e => setFilters(p => ({ ...p, entityType: e.target.value }))}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white text-gray-900">
 <option value="">All Types</option>
 <option value="offer">Offer</option>
 <option value="user">User</option>
 <option value="report">Report</option>
 <option value="template">Template</option>
 <option value="group">Group</option>
 <option value="settings">Settings</option>
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
 <input type="date" value={filters.from} onChange={e => setFilters(p => ({ ...p, from: e.target.value }))}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white text-gray-900" />
 </div>
 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
 <input type="date" value={filters.to} onChange={e => setFilters(p => ({ ...p, to: e.target.value }))}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white text-gray-900" />
 </div>
 </div>
 <div className="flex justify-end gap-2 mt-3">
 <button onClick={clearFilters} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800">Clear</button>
 <button onClick={applyFilters} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">Apply</button>
 </div>
 </div>
 )}

 {/* Log List */}
 <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
 {loading ? (
 <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
 ) : logs.length === 0 ? (
 <div className="p-8 text-center">
 <Activity size={32} className="mx-auto text-gray-300 mb-2" />
 <p className="text-sm text-gray-400">No activity found</p>
 </div>
 ) : (
 <div className="divide-y divide-gray-100">
 {logs.map(log => (
 <div key={log._id} className="px-4 py-3 hover:bg-gray-50 flex items-start gap-3">
 <div className="mt-0.5">
 <Activity size={14} className="text-gray-400" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-sm font-medium text-gray-900">{log.userName}</span>
 <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
 {ACTION_LABELS[log.action] || log.action}
 </span>
 {log.entityName && (
 <span className="text-sm text-gray-600 truncate">"{log.entityName}"</span>
 )}
 </div>

 {/* Changes */}
 {log.changes?.length > 0 && (
 <div className="mt-1 space-y-0.5">
 {log.changes.slice(0, 3).map((c, i) => (
 <p key={i} className="text-xs text-gray-500">
 <span className="font-medium">{c.field}</span>: <span className="text-red-500 line-through">{String(c.from ?? '').slice(0, 50)}</span> → <span className="text-green-600">{String(c.to ?? '').slice(0, 50)}</span>
 </p>
 ))}
 {log.changes.length > 3 && <p className="text-xs text-gray-400">+{log.changes.length - 3} more changes</p>}
 </div>
 )}

 {/* Details */}
 {log.details && !log.changes?.length && (
 <p className="text-xs text-gray-500 mt-0.5">
 {typeof log.details === 'object'
 ? Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(', ')
 : String(log.details)
 }
 </p>
 )}
 </div>
 <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
 {new Date(log.createdAt).toLocaleString()}
 </span>
 </div>
 ))}
 </div>
 )}

 {/* Pagination */}
 {pagination.pages > 1 && (
 <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
 <span className="text-xs text-gray-500">Page {pagination.page} of {pagination.pages}</span>
 <div className="flex gap-1">
 <button onClick={() => fetchLogs(pagination.page - 1)} disabled={pagination.page <= 1}
 className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
 <ChevronLeft size={14} />
 </button>
 <button onClick={() => fetchLogs(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
 className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
 <ChevronRight size={14} />
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
