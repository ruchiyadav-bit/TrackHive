import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
 Plus, Search, ChevronLeft, ChevronRight, MoreVertical,
 Pencil, Copy, Trash2, ExternalLink, Link2, Eye, RefreshCw,
} from 'lucide-react';
import api from '../api/client';
import { formatDate } from '../utils/formatDate';
import { formatCurrency, formatNumber } from '../utils/formatCurrency';
import { STATUSES, CATEGORIES } from '../utils/constants';

const statusDot = {
 active: 'bg-green-500',
 paused: 'bg-yellow-500',
 draft: 'bg-gray-400',
 expired: 'bg-red-500',
};

const statusColors = {
 active: 'bg-green-100 text-green-800',
 paused: 'bg-yellow-100 text-yellow-800',
 draft: 'bg-gray-100 text-gray-600',
 expired: 'bg-red-100 text-red-800',
};

const PAGE_SIZES = [25, 50, 100];

// ---- Action Menu ----

function ActionMenu({ offer, onEdit, onDuplicate, onDelete, onCopyUrl }) {
 const [open, setOpen] = useState(false);
 const ref = useRef(null);

 useEffect(() => {
 const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
 document.addEventListener('mousedown', handler);
 return () => document.removeEventListener('mousedown', handler);
 }, []);

 const items = [
 { label: 'Edit', icon: Pencil, action: () => onEdit(offer._id) },
 { label: 'Duplicate Offer', icon: Copy, action: () => onDuplicate(offer._id) },
 { label: 'Copy Landing Page URL', icon: Link2, action: () => onCopyUrl(offer.landingPageUrl || offer.offerUrl || '') },
 { label: 'View Details', icon: Eye, action: () => onEdit(offer._id, true) },
 { divider: true },
 { label: 'Delete', icon: Trash2, action: () => onDelete(offer._id), danger: true },
 ];

 return (
 <div className="relative" ref={ref}>
 <button
 onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
 className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
 >
 <MoreVertical size={16} />
 </button>
 {open && (
 <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
 {items.map((item, i) =>
 item.divider ? (
 <div key={i} className="border-t border-gray-100 my-1" />
 ) : (
 <button
 key={i}
 onClick={(e) => { e.stopPropagation(); item.action(); setOpen(false); }}
 className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 ${
 item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
 }`}
 >
 <item.icon size={14} />
 {item.label}
 </button>
 )
 )}
 </div>
 )}
 </div>
 );
}

// ---- Badge Components ----

function GeoChips({ countries = [], mode }) {
 if (!countries.length) return <span className="text-gray-400">All</span>;
 const show = countries.slice(0, 2);
 const rest = countries.length - show.length;
 return (
 <div className="flex flex-wrap gap-1 items-center">
 {show.map(c => (
 <span key={c} className="inline-flex items-center gap-0.5 text-xs">
 <span className="text-green-500">&#9745;</span> {c}
 </span>
 ))}
 {rest > 0 && (
 <span className="text-xs text-blue-600 cursor-default" title={countries.join(', ')}>
 View all ({countries.length})
 </span>
 )}
 </div>
 );
}

function DeviceChips({ devices = [] }) {
 if (!devices.length) return <span className="text-gray-400">All</span>;
 return (
 <div className="flex flex-wrap gap-1">
 {devices.map(d => (
 <span key={d} className="inline-flex items-center gap-0.5 text-xs">
 <span className="text-green-500">&#9745;</span> {d}
 </span>
 ))}
 </div>
 );
}

// ---- Main Component ----

export default function Offers() {
 const [offers, setOffers] = useState([]);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState('');
 const [categoryFilter, setCategoryFilter] = useState('');
 const [page, setPage] = useState(1);
 const [pageSize, setPageSize] = useState(25);
 const [pagination, setPagination] = useState({ total: 0, pages: 1 });
 const [copied, setCopied] = useState(null);
 const navigate = useNavigate();

 const fetchOffers = async () => {
 try {
 const params = { page, limit: pageSize };
 if (search) params.search = search;
 if (statusFilter) params.status = statusFilter;
 if (categoryFilter) params.category = categoryFilter;
 const { data } = await api.get('/offers', { params });
 setOffers(data.offers);
 setPagination(data.pagination || { total: data.offers.length, pages: 1 });
 } catch (err) {
 console.error('Failed to fetch offers:', err);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => { fetchOffers(); }, [statusFilter, categoryFilter, page, pageSize]);

 const handleSearch = (e) => { e.preventDefault(); setPage(1); fetchOffers(); };
 const handlePageSizeChange = (newSize) => { setPageSize(newSize); setPage(1); };

 const handleDuplicate = async (id) => {
 try { await api.post(`/offers/${id}/duplicate`); fetchOffers(); } catch (err) { console.error(err); }
 };

 const handleDelete = async (id) => {
 if (!window.confirm('Are you sure you want to delete this offer?')) return;
 try { await api.delete(`/offers/${id}`); fetchOffers(); } catch (err) { console.error(err); }
 };

 const handleCopyUrl = (url) => {
 if (!url) return;
 navigator.clipboard.writeText(url);
 setCopied(url);
 setTimeout(() => setCopied(null), 2000);
 };

 const getAdvertiserName = (offer) => {
 if (!offer.advertiser) return '—';
 return typeof offer.advertiser === 'object' ? offer.advertiser.name : offer.advertiser;
 };

 return (
 <div>
 {/* Header */}
 <div className="flex items-center justify-between mb-5">
 <div>
 <p className="text-xs text-gray-500 mb-0.5">Offers / Manage</p>
 <h1 className="text-2xl font-bold text-gray-900">Manage Offers</h1>
 </div>
 <div className="flex items-center gap-2">
 {/* Reload just this list — no full page refresh. */}
 <button
 onClick={async () => { setRefreshing(true); try { await fetchOffers(); } finally { setRefreshing(false); } }}
 disabled={refreshing}
 title="Refresh list"
 className="flex items-center justify-center w-9 h-9 bg-white border-2 border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50"
 >
 <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
 </button>
 <Link
 to="/offers/new"
 className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
 >
 <Plus size={16} /> Offer
 </Link>
 </div>
 </div>

 {/* Filters Bar */}
 <div className="flex flex-wrap items-center gap-3 mb-4">
 <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[240px]">
 <div className="relative flex-1">
 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
 <input
 type="text"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search offers..."
 className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-900"
 />
 </div>
 </form>

 {/* Status filter with dot */}
 <div className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer">
 <span className={`w-2.5 h-2.5 rounded-full ${statusDot[statusFilter] || 'bg-gray-300'}`} />
 <select
 value={statusFilter}
 onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
 className="text-sm outline-none bg-transparent text-gray-700 cursor-pointer pr-1"
 >
 <option value="">All Statuses</option>
 {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
 </select>
 </div>

 <select
 value={categoryFilter}
 onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
 className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white text-gray-700 cursor-pointer"
 >
 <option value="">All Categories</option>
 {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
 </select>
 </div>

 {/* Table */}
 <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
 {loading ? (
 <div className="p-12 text-center text-gray-400">Loading offers...</div>
 ) : offers.length === 0 ? (
 <div className="p-12 text-center">
 <p className="text-gray-500 mb-3">No offers found</p>
 <Link to="/offers/new" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
 Create your first offer
 </Link>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-gray-50 border-b border-gray-200">
 <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Name</th>
 <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Advertiser</th>
 <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Category</th>
 <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Status</th>
 <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Device Types</th>
 <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Countries</th>
 <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Revenue</th>
 <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Payout</th>
 {/* This column shows offer.totalClicks, which counts EVERY click including
     blocked ones — i.e. the same figure Reports calls "Gross Clicks".
     Reports' own "Clicks" column is gross minus invalid, so the two would
     disagree whenever traffic gets blocked. Named to match Reports. */}
 <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap" title="All clicks including blocked — same as Gross Clicks in Reports">Gross Clicks</th>
 <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Conv.</th>
 <th className="text-center px-2 py-3 font-semibold text-gray-600 w-10"></th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100">
 {offers.map((offer) => (
 <tr
 key={offer._id}
 onClick={() => navigate(`/offers/${offer._id}`)}
 className="hover:bg-blue-50/40 transition-colors cursor-pointer"
 >
 {/* Name + Status dot */}
 <td className="px-4 py-3 max-w-[260px]">
 <div className="flex items-center gap-2">
 <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[offer.status] || 'bg-gray-300'}`} />
 <span className="font-medium text-gray-900 truncate hover:text-blue-600">
 {offer.name}
 </span>
 </div>
 </td>

 {/* Advertiser */}
 <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
 {getAdvertiserName(offer)}
 </td>

 {/* Category */}
 <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
 {offer.category || '—'}
 </td>

 {/* Status badge */}
 <td className="px-4 py-3">
 <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[offer.status] || 'bg-gray-100 text-gray-600'}`}>
 {offer.status}
 </span>
 </td>

 {/* Device Types */}
 <td className="px-4 py-3">
 <DeviceChips devices={offer.deviceTypes} />
 </td>

 {/* Countries */}
 <td className="px-4 py-3">
 <GeoChips countries={offer.geoCountries} mode={offer.geoMode} />
 </td>

 {/* Revenue config */}
 <td className="px-4 py-3 whitespace-nowrap">
 <div className="text-xs text-gray-500">{offer.revenueType || 'RPA'}</div>
 <div className="font-medium text-gray-900">
 {formatCurrency(offer.revenueAmount, offer.currency)}
 </div>
 </td>

 {/* Payout config */}
 <td className="px-4 py-3 whitespace-nowrap">
 <div className="text-xs text-gray-500">{offer.payoutType || 'CPA'}</div>
 <div className="font-medium text-gray-900">
 {formatCurrency(offer.payoutAmount, offer.currency)}
 </div>
 </td>

 {/* Clicks */}
 <td className="px-4 py-3 text-right font-medium text-gray-700">
 {formatNumber(offer.totalClicks || 0)}
 </td>

 {/* Conversions */}
 <td className="px-4 py-3 text-right font-medium text-gray-700">
 {formatNumber(offer.totalConversions || 0)}
 </td>

 {/* Actions */}
 <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
 <ActionMenu
 offer={offer}
 onEdit={(id, detail) => navigate(detail ? `/offers/${id}` : `/offers/${id}/edit`)}
 onDuplicate={handleDuplicate}
 onDelete={handleDelete}
 onCopyUrl={handleCopyUrl}
 />
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* Pagination */}
 {!loading && offers.length > 0 && (
 <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50/50">
 <div className="flex items-center gap-2 text-sm text-gray-500">
 <span className="font-medium text-gray-700">{pagination.total} Total</span>
 <span className="mx-1 text-gray-300">|</span>
 <span>Per page:</span>
 {PAGE_SIZES.map(size => (
 <button
 key={size}
 onClick={() => handlePageSizeChange(size)}
 className={`px-2 py-0.5 rounded text-xs font-medium ${
 pageSize === size ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'
 }`}
 >
 {size}
 </button>
 ))}
 </div>
 <div className="flex items-center gap-1">
 {/* First */}
 <button onClick={() => setPage(1)} disabled={page <= 1}
 className="px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed font-medium">
 &#171;
 </button>
 <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
 className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed">
 <ChevronLeft size={16} />
 </button>

 {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
 let pageNum;
 if (pagination.pages <= 5) pageNum = i + 1;
 else if (page <= 3) pageNum = i + 1;
 else if (page >= pagination.pages - 2) pageNum = pagination.pages - 4 + i;
 else pageNum = page - 2 + i;
 return (
 <button key={pageNum} onClick={() => setPage(pageNum)}
 className={`w-8 h-8 rounded text-sm font-medium ${
 page === pageNum ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'
 }`}>
 {pageNum}
 </button>
 );
 })}

 <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}
 className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed">
 <ChevronRight size={16} />
 </button>
 {/* Last */}
 <button onClick={() => setPage(pagination.pages)} disabled={page >= pagination.pages}
 className="px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed font-medium">
 &#187;
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
