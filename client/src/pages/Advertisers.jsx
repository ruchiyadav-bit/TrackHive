import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Copy, RefreshCw, ExternalLink, Search, AlertTriangle } from 'lucide-react';
import api from '../api/client';

const statusColors = {
 active: 'bg-green-100 text-green-800',
 inactive: 'bg-gray-100 text-gray-600',
};

export default function Advertisers() {
 const [advertisers, setAdvertisers] = useState([]);
 const [loading, setLoading] = useState(true);
 const [showModal, setShowModal] = useState(false);
 const [editing, setEditing] = useState(null);
 const [search, setSearch] = useState('');
 const [copied, setCopied] = useState(null);
 const [trackingDomain, setTrackingDomain] = useState('');
 const [form, setForm] = useState({
 name: '', company: '', website: '', status: 'active',
 clickIdParam: 'click_id', contactName: '', contactEmail: '', notes: '',
 });

 const fetchAdvertisers = async () => {
 try {
 const params = {};
 if (search) params.search = search;
 const { data } = await api.get('/advertisers', { params });
 setAdvertisers(data.advertisers || []);
 } catch (err) {
 console.error(err);
 } finally {
 setLoading(false);
 }
 };

 // Fetch tracking domain from settings + verified domains list
 useEffect(() => {
 const loadDomain = async () => {
 try {
 const [settingsRes, domainsRes] = await Promise.all([
 api.get('/settings').catch(() => ({ data: { settings: {} } })),
 api.get('/tracking-domains').catch(() => ({ data: { domains: [] } })),
 ]);
 const settings = settingsRes.data.settings || {};
 const domains = (domainsRes.data.domains || []).filter(d => d.status === 'verified');
 // Priority: settings.trackingDomain → first verified domain → empty
 const domain = settings.trackingDomain || (domains.length > 0 ? domains[0].domain : '');
 setTrackingDomain(domain);
 } catch (err) {
 console.error(err);
 }
 };
 loadDomain();
 }, []);

 useEffect(() => { fetchAdvertisers(); }, [search]);

 const openAdd = () => {
 setEditing(null);
 setForm({ name: '', company: '', website: '', status: 'active', clickIdParam: 'click_id', contactName: '', contactEmail: '', notes: '' });
 setShowModal(true);
 };

 const openEdit = (adv) => {
 setEditing(adv);
 setForm({
 name: adv.name || '', company: adv.company || '', website: adv.website || '',
 status: adv.status || 'active', clickIdParam: adv.clickIdParam || 'click_id',
 contactName: adv.contactName || '', contactEmail: adv.contactEmail || '', notes: adv.notes || '',
 });
 setShowModal(true);
 };

 const save = async () => {
 if (!form.name.trim()) return;
 try {
 if (editing) {
 await api.put(`/advertisers/${editing._id}`, form);
 } else {
 await api.post('/advertisers', form);
 }
 setShowModal(false);
 fetchAdvertisers();
 } catch (err) {
 console.error(err);
 }
 };

 const remove = async (id) => {
 if (!window.confirm('Delete this advertiser?')) return;
 try {
 await api.delete(`/advertisers/${id}`);
 fetchAdvertisers();
 } catch (err) {
 console.error(err);
 }
 };

 const copyPostbackUrl = (adv) => {
 if (!trackingDomain) return;
 const base = trackingDomain.startsWith('http') ? trackingDomain : `https://${trackingDomain}`;
 const url = `${base}/postback?click_id={click_id}&revenue={revenue}&payout={payout}&event={event}&secret=${adv.postbackSecret || '{secret}'}`;
 navigator.clipboard.writeText(url);
 setCopied(adv._id);
 setTimeout(() => setCopied(null), 2000);
 };

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <h1 className="text-2xl font-bold text-gray-900">Advertisers</h1>
 <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
 <Plus size={16} /> Add Advertiser
 </button>
 </div>

 <div className="relative max-w-sm">
 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
 <input
 value={search} onChange={(e) => setSearch(e.target.value)}
 placeholder="Search advertisers..."
 className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
 />
 </div>

 {loading ? (
 <div className="text-center py-12 text-gray-400">Loading...</div>
 ) : advertisers.length === 0 ? (
 <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
 <p className="text-gray-500 mb-2">No advertisers yet</p>
 <button onClick={openAdd} className="text-blue-600 text-sm font-medium hover:underline">Add your first advertiser</button>
 </div>
 ) : (
 <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
 <table className="w-full">
 <thead>
 <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
 <th className="px-4 py-3">Name</th>
 <th className="px-4 py-3">Company</th>
 <th className="px-4 py-3">Status</th>
 <th className="px-4 py-3">Contact</th>
 <th className="px-4 py-3">Click ID Param</th>
 <th className="px-4 py-3">Postback URL</th>
 <th className="px-4 py-3">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100">
 {advertisers.map((adv) => (
 <tr key={adv._id} className="hover:bg-gray-50">
 <td className="px-4 py-3">
 <div className="font-medium text-gray-900 text-sm">{adv.name}</div>
 {adv.website && (
 <a href={adv.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
 <ExternalLink size={10} /> {adv.website.replace(/^https?:\/\//, '')}
 </a>
 )}
 </td>
 <td className="px-4 py-3 text-sm text-gray-600">{adv.company || '—'}</td>
 <td className="px-4 py-3">
 <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[adv.status]}`}>
 {adv.status}
 </span>
 </td>
 <td className="px-4 py-3 text-sm text-gray-600">
 {adv.contactName && <div>{adv.contactName}</div>}
 {adv.contactEmail && <div className="text-xs text-gray-400">{adv.contactEmail}</div>}
 {!adv.contactName && !adv.contactEmail && '—'}
 </td>
 <td className="px-4 py-3 text-sm font-mono text-gray-600">{adv.clickIdParam}</td>
 <td className="px-4 py-3">
 {trackingDomain ? (
 <button onClick={() => copyPostbackUrl(adv)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
 <Copy size={12} /> {copied === adv._id ? 'Copied!' : 'Copy URL'}
 </button>
 ) : (
 <span className="flex items-center gap-1 text-xs text-amber-600">
 <AlertTriangle size={12} /> Add a tracking domain first
 </span>
 )}
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-2">
 <button onClick={() => openEdit(adv)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Edit2 size={14} /></button>
 <button onClick={() => remove(adv._id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 size={14} /></button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* Add/Edit Modal */}
 {showModal && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
 <h2 className="text-lg font-semibold text-gray-900 mb-4">
 {editing ? 'Edit Advertiser' : 'Add Advertiser'}
 </h2>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Advertiser Name *</label>
 <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
 placeholder="Impact.com" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Company / Brand</label>
 <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
 placeholder="BetMGM" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
 <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
 placeholder="https://impact.com" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
 <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
 className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
 <option value="active">Active</option>
 <option value="inactive">Inactive</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Click ID Parameter</label>
 <input value={form.clickIdParam} onChange={(e) => setForm({ ...form, clickIdParam: e.target.value })}
 placeholder="click_id" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
 <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })}
 className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
 <input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
 type="email" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
 <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
 rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
 </div>
 </div>
 <div className="flex justify-end gap-3 mt-6">
 <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
 <button onClick={save} disabled={!form.name.trim()}
 className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
 {editing ? 'Save Changes' : 'Add Advertiser'}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
