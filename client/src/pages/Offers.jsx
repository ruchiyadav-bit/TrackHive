import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, MoreHorizontal, Copy, Pencil, Trash2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/client';
import { formatDate } from '../utils/formatDate';
import { formatCurrency } from '../utils/formatCurrency';
import { STATUSES, CATEGORIES, NETWORKS } from '../utils/constants';

const statusColors = {
 active: 'bg-green-100 text-green-800',
 paused: 'bg-yellow-100 text-yellow-800',
 draft: 'bg-gray-100 text-gray-600',
 expired: 'bg-red-100 text-red-800',
};

const PAGE_SIZES = [25, 50, 100];

export default function Offers() {
 const [offers, setOffers] = useState([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState('');
 const [categoryFilter, setCategoryFilter] = useState('');
 const [page, setPage] = useState(1);
 const [pageSize, setPageSize] = useState(25);
 const [pagination, setPagination] = useState({ total: 0, pages: 1 });
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

 useEffect(() => {
 fetchOffers();
 }, [statusFilter, categoryFilter, page, pageSize]);

 const handleSearch = (e) => {
 e.preventDefault();
 setPage(1);
 fetchOffers();
 };

 const handlePageSizeChange = (newSize) => {
 setPageSize(newSize);
 setPage(1);
 };

 const handleDuplicate = async (id) => {
 try {
 await api.post(`/offers/${id}/duplicate`);
 fetchOffers();
 } catch (err) {
 console.error('Failed to duplicate:', err);
 }
 };

 const handleDelete = async (id) => {
 if (!window.confirm('Are you sure you want to delete this offer?')) return;
 try {
 await api.delete(`/offers/${id}`);
 fetchOffers();
 } catch (err) {
 console.error('Failed to delete:', err);
 }
 };

 return (
 <div>
 <div className="flex items-center justify-between mb-6">
 <h1 className="text-2xl font-bold text-gray-900">Offers</h1>
 <Link
 to="/offers/new"
 className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
 >
 <Plus size={16} /> Add Offer
 </Link>
 </div>

 {/* Filters */}
 <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
 <div className="flex flex-wrap items-center gap-3">
 <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
 <div className="relative">
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
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
 >
 <option value="">All Statuses</option>
 {STATUSES.map((s) => (
 <option key={s.value} value={s.value}>{s.label}</option>
 ))}
 </select>
 <select
 value={categoryFilter}
 onChange={(e) => setCategoryFilter(e.target.value)}
 className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
 >
 <option value="">All Categories</option>
 {CATEGORIES.map((c) => (
 <option key={c} value={c}>{c}</option>
 ))}
 </select>
 </div>
 </div>

 {/* Table */}
 <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
 {loading ? (
 <div className="p-12 text-center text-gray-400">Loading offers...</div>
 ) : offers.length === 0 ? (
 <div className="p-12 text-center">
 <p className="text-gray-500 mb-3">No offers found</p>
 <Link
 to="/offers/new"
 className="text-sm text-blue-600 hover:text-blue-800 font-medium"
 >
 Create your first offer
 </Link>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-gray-50 border-b border-gray-200">
 <th className="text-left px-4 py-3 font-medium text-gray-600">Offer</th>
 <th className="text-left px-4 py-3 font-medium text-gray-600">Network</th>
 <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
 <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
 <th className="text-left px-4 py-3 font-medium text-gray-600">GEO</th>
 <th className="text-right px-4 py-3 font-medium text-gray-600">Revenue</th>
 <th className="text-right px-4 py-3 font-medium text-gray-600">Profit</th>
 <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
 <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100">
 {offers.map((offer) => (
 <tr key={offer._id} className="hover:bg-gray-50 transition-colors">
 <td className="px-4 py-3">
 <Link
 to={`/offers/${offer._id}`}
 className="font-medium text-gray-900 hover:text-blue-600"
 >
 {offer.name}
 </Link>
 {offer.advertiser && (
 <div className="text-xs text-gray-400">{typeof offer.advertiser === 'object' ? offer.advertiser.name : offer.advertiser}</div>
 )}
 </td>
 <td className="px-4 py-3">
 {offer.network && (
 <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
 {offer.network}
 </span>
 )}
 </td>
 <td className="px-4 py-3 text-gray-600">{offer.category || '—'}</td>
 <td className="px-4 py-3">
 <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[offer.status] || ''}`}>
 {offer.status}
 </span>
 </td>
 <td className="px-4 py-3 text-gray-600 text-xs">
 {offer.geoTargets?.slice(0, 3).join(', ') || '—'}
 {offer.geoTargets?.length > 3 && ` +${offer.geoTargets.length - 3}`}
 </td>
 <td className="px-4 py-3 text-right font-medium text-gray-900">
 {formatCurrency(offer.totalRevenue, offer.currency)}
 </td>
 <td className="px-4 py-3 text-right font-medium">
 <span className={offer.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
 {formatCurrency(offer.totalProfit, offer.currency)}
 </span>
 </td>
 <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(offer.createdAt)}</td>
 <td className="px-4 py-3">
 <div className="flex items-center justify-center gap-1">
 <button
 onClick={() => navigate(`/offers/${offer._id}/edit`)}
 className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
 title="Edit"
 >
 <Pencil size={14} />
 </button>
 <button
 onClick={() => handleDuplicate(offer._id)}
 className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
 title="Duplicate"
 >
 <Copy size={14} />
 </button>
 <button
 onClick={() => handleDelete(offer._id)}
 className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
 title="Delete"
 >
 <Trash2 size={14} />
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* Pagination */}
 {!loading && offers.length > 0 && (
 <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
 <div className="flex items-center gap-2 text-sm text-gray-500">
 <span>Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, pagination.total)} of {pagination.total}</span>
 <span className="mx-1">|</span>
 <span>Per page:</span>
 {PAGE_SIZES.map(size => (
 <button
 key={size}
 onClick={() => handlePageSizeChange(size)}
 className={`px-2 py-0.5 rounded text-xs font-medium ${
 pageSize === size
 ? 'bg-blue-100 text-blue-700'
 : 'hover:bg-gray-100 text-gray-600'
 }`}
 >
 {size}
 </button>
 ))}
 </div>
 <div className="flex items-center gap-1">
 <button
 onClick={() => setPage(p => Math.max(1, p - 1))}
 disabled={page <= 1}
 className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
 >
 <ChevronLeft size={16} />
 </button>
 {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
 let pageNum;
 if (pagination.pages <= 5) {
 pageNum = i + 1;
 } else if (page <= 3) {
 pageNum = i + 1;
 } else if (page >= pagination.pages - 2) {
 pageNum = pagination.pages - 4 + i;
 } else {
 pageNum = page - 2 + i;
 }
 return (
 <button
 key={pageNum}
 onClick={() => setPage(pageNum)}
 className={`w-8 h-8 rounded text-sm font-medium ${
 page === pageNum
 ? 'bg-blue-600 text-white'
 : 'hover:bg-gray-100 text-gray-600'
 }`}
 >
 {pageNum}
 </button>
 );
 })}
 <button
 onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
 disabled={page >= pagination.pages}
 className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
 >
 <ChevronRight size={16} />
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
