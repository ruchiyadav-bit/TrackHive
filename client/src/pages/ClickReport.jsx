import { useState, useEffect, useCallback } from 'react';
import { MousePointerClick, Search, Filter, ChevronLeft, ChevronRight, ExternalLink, Check, X as XIcon, Bot, Shield } from 'lucide-react';
import api from '../api/client';

const COLUMNS = [
 { key: 'clickedAt', label: 'Timestamp', show: true },
 { key: 'offerName', label: 'Offer', show: true },
 { key: 'ip', label: 'IP Address', show: true },
 { key: 'country', label: 'Country', show: true },
 { key: 'city', label: 'City', show: false },
 { key: 'device', label: 'Device', show: true },
 { key: 'os', label: 'OS', show: false },
 { key: 'browser', label: 'Browser', show: false },
 { key: 'isUnique', label: 'Unique?', show: true },
 { key: 'isBlocked', label: 'Blocked?', show: true },
 { key: 'isBot', label: 'Bot?', show: false },
 { key: 'isVpn', label: 'VPN?', show: false },
 { key: 'source', label: 'Source', show: true },
 { key: 'subId1', label: 'Sub1', show: false },
 { key: 'subId2', label: 'Sub2', show: false },
 { key: 'referrer', label: 'Referrer', show: false },
 { key: 'redirectUrl', label: 'Redirected To', show: false },
 { key: 'clickId', label: 'Click ID', show: false },
];

export default function ClickReport() {
 const [clicks, setClicks] = useState([]);
 const [loading, setLoading] = useState(true);
 const [page, setPage] = useState(1);
 const [totalPages, setTotalPages] = useState(1);
 const [total, setTotal] = useState(0);
 const [offers, setOffers] = useState([]);
 const [filters, setFilters] = useState({
 from: daysAgo(7),
 to: todayStr(),
 offerId: '',
 search: '',
 unique: '',
 blocked: '',
 });
 const [showFilters, setShowFilters] = useState(false);
 const [visibleCols, setVisibleCols] = useState(() =>
 COLUMNS.filter(c => c.show).map(c => c.key)
 );
 const [showColPicker, setShowColPicker] = useState(false);

 useEffect(() => {
 api.get('/offers', { params: { limit: 500 } }).then(r => setOffers(r.data.offers || [])).catch(() => {});
 }, []);

 const fetchClicks = useCallback(async (p = 1) => {
 setLoading(true);
 try {
 const params = { page: p, limit: 50, from: filters.from, to: filters.to };
 if (filters.offerId) params.offerId = filters.offerId;
 if (filters.search) params.search = filters.search;

 const { data } = await api.get('/click/api/list', { params });
 setClicks(data.clicks || []);
 setTotalPages(data.pagination?.pages || 1);
 setTotal(data.pagination?.total || 0);
 setPage(p);
 } catch (err) {
 console.error(err);
 } finally {
 setLoading(false);
 }
 }, [filters]);

 useEffect(() => { fetchClicks(1); }, [fetchClicks]);

 const toggleCol = (key) => {
 setVisibleCols(prev =>
 prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
 );
 };

 const deviceIcon = (device) => {
 if (!device) return '—';
 const d = device.toLowerCase();
 if (d.includes('mobile')) return '📱';
 if (d.includes('tablet')) return '📱';
 return '💻';
 };

 const renderCell = (click, key) => {
 switch (key) {
 case 'clickedAt':
 return <span className="text-gray-600 whitespace-nowrap">{new Date(click.clickedAt).toLocaleString()}</span>;
 case 'offerName':
 return <span className="font-medium text-gray-900 truncate max-w-[200px] inline-block">{click.offerName || '—'}</span>;
 case 'ip':
 return <code className="text-xs bg-gray-100 px-1 py-0.5 rounded text-gray-700">{click.ip}</code>;
 case 'country':
 return <span className="text-gray-700">{click.country || '—'}</span>;
 case 'city':
 return <span className="text-gray-600">{click.city || '—'}</span>;
 case 'device':
 return <span>{deviceIcon(click.device)} {click.device || '—'}</span>;
 case 'os':
 return <span className="text-gray-600">{click.os || '—'}</span>;
 case 'browser':
 return <span className="text-gray-600">{click.browser || '—'}</span>;
 case 'isUnique':
 return click.isDuplicate
 ? <span className="px-1.5 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">Dup</span>
 : <span className="px-1.5 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Unique</span>;
 case 'isBlocked':
 return click.isBlocked
 ? <span className="px-1.5 py-0.5 rounded-full text-xs bg-red-100 text-red-700" title={click.blockReason}>Blocked</span>
 : <span className="px-1.5 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Passed</span>;
 case 'isBot':
 return click.isBot
 ? <Bot size={14} className="text-orange-500" title="Bot detected" />
 : <span className="text-gray-300">—</span>;
 case 'isVpn':
 return click.isVpn
 ? <Shield size={14} className="text-red-500" title="VPN detected" />
 : <span className="text-gray-300">—</span>;
 case 'source':
 return <span className="text-gray-600">{click.source || '—'}</span>;
 case 'subId1':
 case 'subId2':
 return <span className="text-gray-600 text-xs">{click[key] || '—'}</span>;
 case 'referrer':
 return click.referrer
 ? <a href={click.referrer} target="_blank" rel="noopener" className="text-blue-600 text-xs hover:underline truncate max-w-[150px] inline-block">{click.referrer}</a>
 : <span className="text-gray-300">—</span>;
 case 'redirectUrl':
 return click.redirectUrl
 ? <a href={click.redirectUrl} target="_blank" rel="noopener" className="text-blue-600 text-xs hover:underline truncate max-w-[150px] inline-block">{click.redirectUrl}</a>
 : <span className="text-gray-300">—</span>;
 case 'clickId':
 return <code className="text-xs text-gray-500 truncate max-w-[120px] inline-block">{click.clickId}</code>;
 default:
 return <span className="text-gray-600">{String(click[key] ?? '—')}</span>;
 }
 };

 return (
 <div>
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold text-gray-900">Click Report</h1>
 <p className="text-sm text-gray-500">{total} clicks total</p>
 </div>
 <div className="flex items-center gap-2">
 <button onClick={() => setShowFilters(!showFilters)}
 className={`p-2 rounded-lg border text-sm ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
 <Filter size={16} />
 </button>
 <div className="relative">
 <button onClick={() => setShowColPicker(!showColPicker)}
 className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
 Columns
 </button>
 {showColPicker && (
 <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-72 overflow-y-auto p-2">
 {COLUMNS.map(c => (
 <label key={c.key} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
 <input type="checkbox" checked={visibleCols.includes(c.key)} onChange={() => toggleCol(c.key)} className="rounded text-blue-600" />
 <span className="text-sm text-gray-700">{c.label}</span>
 </label>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Filters */}
 {showFilters && (
 <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
 <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1">Offer</label>
 <select value={filters.offerId} onChange={e => setFilters(p => ({ ...p, offerId: e.target.value }))}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white text-gray-900">
 <option value="">All Offers</option>
 {offers.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1">Search (IP / Click ID)</label>
 <input value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
 placeholder="Search..."
 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white text-gray-900" />
 </div>
 <div className="flex items-end">
 <button onClick={() => fetchClicks(1)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 w-full">
 Apply
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Table */}
 <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
 {loading ? (
 <div className="p-12 text-center text-gray-400 text-sm">Loading clicks...</div>
 ) : clicks.length === 0 ? (
 <div className="p-12 text-center">
 <MousePointerClick size={40} className="mx-auto text-gray-300 mb-3" />
 <p className="text-gray-500 text-sm">No clicks found for the selected period</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-xs">
 <thead>
 <tr className="bg-gray-50 border-b border-gray-200">
 {COLUMNS.filter(c => visibleCols.includes(c.key)).map(c => (
 <th key={c.key} className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">{c.label}</th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100">
 {clicks.map((click, i) => (
 <tr key={click._id || i} className="hover:bg-gray-50">
 {COLUMNS.filter(c => visibleCols.includes(c.key)).map(c => (
 <td key={c.key} className="px-3 py-2 whitespace-nowrap">
 {renderCell(click, c.key)}
 </td>
 ))}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* Pagination */}
 {totalPages > 1 && (
 <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
 <span className="text-xs text-gray-500">Page {page} of {totalPages} ({total} total)</span>
 <div className="flex gap-1">
 <button onClick={() => fetchClicks(page - 1)} disabled={page <= 1}
 className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
 <ChevronLeft size={14} />
 </button>
 <button onClick={() => fetchClicks(page + 1)} disabled={page >= totalPages}
 className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
 <ChevronRight size={14} />
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}

function todayStr() { return new Date().toISOString().split('T')[0]; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }
