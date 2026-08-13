import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Pencil, ArrowLeft, ExternalLink, Copy, Trash2 } from 'lucide-react';
import api from '../api/client';
import { formatDate } from '../utils/formatDate';
import { formatCurrency } from '../utils/formatCurrency';

const statusColors = {
 active: 'bg-green-100 text-green-800',
 paused: 'bg-yellow-100 text-yellow-800',
 draft: 'bg-gray-100 text-gray-600',
 expired: 'bg-red-100 text-red-800',
};

export default function OfferDetail() {
 const { id } = useParams();
 const navigate = useNavigate();
 const [offer, setOffer] = useState(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const fetchOffer = async () => {
 try {
 const { data } = await api.get(`/offers/${id}`);
 setOffer(data.offer);
 } catch (err) {
 console.error('Failed to fetch offer:', err);
 navigate('/offers');
 } finally {
 setLoading(false);
 }
 };
 fetchOffer();
 }, [id, navigate]);

 const handleDelete = async () => {
 if (!window.confirm('Are you sure you want to delete this offer?')) return;
 try {
 await api.delete(`/offers/${id}`);
 navigate('/offers');
 } catch (err) {
 console.error('Failed to delete:', err);
 }
 };

 const handleDuplicate = async () => {
 try {
 const { data } = await api.post(`/offers/${id}/duplicate`);
 navigate(`/offers/${data.offer._id}/edit`);
 } catch (err) {
 console.error('Failed to duplicate:', err);
 }
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-64 text-gray-400">
 Loading offer...
 </div>
 );
 }

 if (!offer) return null;

 return (
 <div>
 <div className="flex items-center gap-3 mb-6">
 <Link to="/offers" className="p-1.5 rounded hover:bg-gray-200 text-gray-500">
 <ArrowLeft size={20} />
 </Link>
 <div className="flex-1">
 <h1 className="text-2xl font-bold text-gray-900">{offer.name}</h1>
 {offer.advertiser && (
 <p className="text-sm text-gray-500">{typeof offer.advertiser === 'object' ? offer.advertiser.name : offer.advertiser}</p>
 )}
 </div>
 <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[offer.status] || ''}`}>
 {offer.status}
 </span>
 <div className="flex items-center gap-1 ml-2">
 <Link
 to={`/offers/${id}/edit`}
 className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
 >
 <Pencil size={14} /> Edit
 </Link>
 <button
 onClick={handleDuplicate}
 className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
 title="Duplicate"
 >
 <Copy size={16} />
 </button>
 <button
 onClick={handleDelete}
 className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
 title="Delete"
 >
 <Trash2 size={16} />
 </button>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 {/* Main Info */}
 <div className="lg:col-span-2 space-y-4">
 <div className="bg-white rounded-xl border border-gray-200 p-5">
 <h2 className="text-sm font-semibold text-gray-700 mb-3">General</h2>
 <div className="grid grid-cols-2 gap-4 text-sm">
 <div>
 <span className="text-gray-500">Network</span>
 <p className="font-medium text-gray-900">{offer.network || '—'}</p>
 </div>
 <div>
 <span className="text-gray-500">Category</span>
 <p className="font-medium text-gray-900">{offer.category || '—'}</p>
 </div>
 <div>
 <span className="text-gray-500">Currency</span>
 <p className="font-medium text-gray-900">{offer.currency || 'USD'}</p>
 </div>
 <div>
 <span className="text-gray-500">Vertical</span>
 <p className="font-medium text-gray-900">{offer.vertical || '—'}</p>
 </div>
 {offer.description && (
 <div className="col-span-2">
 <span className="text-gray-500">Description</span>
 <p className="font-medium text-gray-900">{offer.description}</p>
 </div>
 )}
 </div>
 </div>

 <div className="bg-white rounded-xl border border-gray-200 p-5">
 <h2 className="text-sm font-semibold text-gray-700 mb-3">URLs & Tracking</h2>
 <div className="space-y-3 text-sm">
 {offer.offerUrl && (
 <div>
 <span className="text-gray-500">Offer URL</span>
 <p className="font-medium text-gray-900 break-all flex items-center gap-1">
 {offer.offerUrl}
 <a href={offer.offerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500">
 <ExternalLink size={12} />
 </a>
 </p>
 </div>
 )}
 {offer.affiliateUrl && (
 <div>
 <span className="text-gray-500">Affiliate URL</span>
 <p className="font-medium text-gray-900 break-all">{offer.affiliateUrl}</p>
 </div>
 )}
 {offer.postbackUrl && (
 <div>
 <span className="text-gray-500">Postback URL</span>
 <p className="font-medium text-gray-900 break-all">{offer.postbackUrl}</p>
 </div>
 )}
 </div>
 </div>

 {offer.geoTargets?.length > 0 && (
 <div className="bg-white rounded-xl border border-gray-200 p-5">
 <h2 className="text-sm font-semibold text-gray-700 mb-3">Targeting</h2>
 <div className="flex flex-wrap gap-1.5">
 {offer.geoTargets.map((geo) => (
 <span key={geo} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
 {geo}
 </span>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* Side Panel */}
 <div className="space-y-4">
 <div className="bg-white rounded-xl border border-gray-200 p-5">
 <h2 className="text-sm font-semibold text-gray-700 mb-3">Revenue & Payout</h2>
 <div className="space-y-3 text-sm">
 <div>
 <span className="text-gray-500">Revenue</span>
 <p className="text-lg font-bold text-gray-900">
 {formatCurrency(offer.totalRevenue, offer.currency)}
 </p>
 </div>
 <div>
 <span className="text-gray-500">Payout</span>
 <p className="text-lg font-bold text-gray-900">
 {formatCurrency(offer.totalPayout, offer.currency)}
 </p>
 </div>
 <div>
 <span className="text-gray-500">Profit</span>
 <p className={`text-lg font-bold ${offer.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
 {formatCurrency(offer.totalProfit, offer.currency)}
 </p>
 </div>
 </div>
 </div>

 <div className="bg-white rounded-xl border border-gray-200 p-5">
 <h2 className="text-sm font-semibold text-gray-700 mb-3">Details</h2>
 <div className="space-y-2 text-sm">
 <div className="flex justify-between">
 <span className="text-gray-500">Created</span>
 <span className="font-medium text-gray-900">{formatDate(offer.createdAt)}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-gray-500">Updated</span>
 <span className="font-medium text-gray-900">{formatDate(offer.updatedAt)}</span>
 </div>
 {offer.networkOfferId && (
 <div className="flex justify-between">
 <span className="text-gray-500">Network ID</span>
 <span className="font-medium text-gray-900">{offer.networkOfferId}</span>
 </div>
 )}
 {offer.insertionOrderId && (
 <div className="flex justify-between">
 <span className="text-gray-500">IO ID</span>
 <span className="font-medium text-gray-900">{offer.insertionOrderId}</span>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
