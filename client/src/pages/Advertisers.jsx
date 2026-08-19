import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, Copy, ExternalLink, Search, AlertTriangle, Check, Info } from 'lucide-react';
import api from '../api/client';
import { buildPostbackUrl, resolveAdvertiserDomain, toBaseUrl } from '../utils/postbackUrl';

const statusColors = {
 active: 'bg-green-100 text-green-800',
 inactive: 'bg-gray-100 text-gray-600',
};

const networkBadgeColors = {
 impact: 'bg-indigo-100 text-indigo-700',
 everflow: 'bg-blue-100 text-blue-700',
 affise: 'bg-purple-100 text-purple-700',
 trackier: 'bg-teal-100 text-teal-700',
 cellxpert: 'bg-orange-100 text-orange-700',
 custom: 'bg-gray-100 text-gray-600',
};

export default function Advertisers() {
 const [advertisers, setAdvertisers] = useState([]);
 const [loading, setLoading] = useState(true);
 const [showModal, setShowModal] = useState(false);
 const [editing, setEditing] = useState(null);
 const [search, setSearch] = useState('');
 const [copied, setCopied] = useState(null);
 const [trackingDomain, setTrackingDomain] = useState('');
 const [presets, setPresets] = useState(null);
 const [settings, setSettings] = useState({});
 const [verifiedDomains, setVerifiedDomains] = useState([]);
 const [form, setForm] = useState({
  name: '', company: '', website: '', status: 'active', network: 'custom',
  clickIdParam: 'click_id', trackingDomain: '', contactName: '', contactEmail: '', notes: '',
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

 // Fetch tracking domain + network presets on mount
 useEffect(() => {
  const loadData = async () => {
   try {
    const [settingsRes, domainsRes, presetsRes] = await Promise.all([
     api.get('/settings').catch(() => ({ data: { settings: {} } })),
     api.get('/tracking-domains').catch(() => ({ data: { domains: [] } })),
     api.get('/network-presets').catch(() => ({ data: { presets: null } })),
    ]);
    const settings = settingsRes.data.settings || {};
    const domains = (domainsRes.data.domains || []).filter(d => d.status === 'verified');
    setSettings(settings);
    setVerifiedDomains(domains);
    // Account-level fallback, still used when an advertiser has no domain of
    // its own and to decide whether ANY domain exists at all.
    setTrackingDomain(settings.trackingDomain || domains[0]?.domain || '');
    if (presetsRes.data.presets) setPresets(presetsRes.data.presets);
   } catch (err) {
    console.error(err);
   }
  };
  loadData();
 }, []);

 useEffect(() => { fetchAdvertisers(); }, [search]);

 // Build postback URL using network presets. Delegates to the shared builder
 // so this list, the advertiser page and the offer page can never drift apart.
 const postbackUrlFor = (adv) => {
  if (!presets) return null;
  const preset = presets[adv.network || 'custom'] || presets.custom;
  if (!preset) return null;
  const domain = resolveAdvertiserDomain(adv, settings, verifiedDomains);
  if (!domain) return null;
  return buildPostbackUrl({ trackingDomain: toBaseUrl(domain), preset, secret: adv.postbackSecret });
 };

 const openAdd = () => {
  setEditing(null);
  setForm({ name: '', company: '', website: '', status: 'active', network: 'custom', clickIdParam: 'click_id', trackingDomain: '', contactName: '', contactEmail: '', notes: '' });
  setShowModal(true);
 };

 const openEdit = (adv) => {
  setEditing(adv);
  setForm({
   name: adv.name || '', company: adv.company || '', website: adv.website || '',
   status: adv.status || 'active', network: adv.network || 'custom',
   clickIdParam: adv.clickIdParam || 'click_id',
   trackingDomain: (typeof adv.trackingDomain === 'object' ? adv.trackingDomain?._id : adv.trackingDomain) || '',
   contactName: adv.contactName || '', contactEmail: adv.contactEmail || '', notes: adv.notes || '',
  });
  setShowModal(true);
 };

 const handleNetworkChange = (networkKey) => {
  const preset = presets?.[networkKey];
  setForm(prev => ({
   ...prev,
   network: networkKey,
   clickIdParam: preset ? preset.clickIdParam : prev.clickIdParam,
  }));
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
   const msg = err.response?.data?.error || 'Failed to delete';
   alert(msg);
  }
 };

 const copyUrl = (adv) => {
  const url = postbackUrlFor(adv);
  if (!url) return;
  navigator.clipboard.writeText(url);
  setCopied(adv._id);
  setTimeout(() => setCopied(null), 2000);
 };

 const getNetworkLabel = (key) => {
  if (presets?.[key]) return presets[key].label;
  const fallback = { impact: 'Impact.com', everflow: 'Everflow', affise: 'Affise', trackier: 'Trackier', cellxpert: 'Cellxpert', custom: 'Custom / Other' };
  return fallback[key] || key;
 };

 const getInstruction = (key) => {
  if (presets?.[key]) return presets[key].instruction;
  return '';
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
     <div className="max-h-[70vh] overflow-y-auto overflow-x-auto">
     <table className="w-full">
      <thead className="sticky top-0 z-10">
       <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        <th className="px-4 py-3 whitespace-nowrap">Name</th>
        <th className="px-4 py-3 whitespace-nowrap">Network</th>
        <th className="px-4 py-3 whitespace-nowrap">Status</th>
        <th className="px-4 py-3 whitespace-nowrap">Contact</th>
        <th className="px-4 py-3">Postback URL</th>
        <th className="px-4 py-3 whitespace-nowrap">Actions</th>
       </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
       {advertisers.map((adv) => {
        const network = adv.network || 'custom';
        const url = postbackUrlFor(adv);
        return (
        <tr key={adv._id} className="hover:bg-gray-50">
         <td className="px-4 py-3 align-top">
          <Link
           to={`/advertisers/${adv._id}`}
           title={adv.name}
           className="block font-medium text-blue-600 text-sm hover:underline whitespace-nowrap truncate max-w-[200px]"
          >{adv.name}</Link>
          {adv.website && (
           <a href={adv.website} target="_blank" rel="noopener noreferrer" title={adv.website}
              className="text-xs text-gray-400 flex items-center gap-1 hover:underline hover:text-blue-600 whitespace-nowrap truncate max-w-[200px]">
            <ExternalLink size={10} className="shrink-0" /> {adv.website.replace(/^https?:\/\//, '')}
           </a>
          )}
         </td>
         <td className="px-4 py-3 align-top">
          <span className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium ${networkBadgeColors[network] || networkBadgeColors.custom}`}>
           {getNetworkLabel(network)}
          </span>
         </td>
         <td className="px-4 py-3 align-top">
          <span className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[adv.status]}`}>
           {adv.status}
          </span>
         </td>
         <td className="px-4 py-3 text-sm text-gray-600 align-top">
          {adv.contactName && <div className="whitespace-nowrap">{adv.contactName}</div>}
          {adv.contactEmail && <div className="text-xs text-gray-400 whitespace-nowrap">{adv.contactEmail}</div>}
          {!adv.contactName && !adv.contactEmail && '—'}
         </td>
         <td className="px-4 py-3">
          {!trackingDomain ? (
           <span className="flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle size={12} /> Add a tracking domain first
           </span>
          ) : url ? (
           <div className="space-y-1">
            <div className="flex items-center gap-2">
             <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${networkBadgeColors[network] || networkBadgeColors.custom}`}>
              Ready for {getNetworkLabel(network)}
             </span>
             <button onClick={() => copyUrl(adv)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
              {copied === adv._id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              {copied === adv._id ? 'Copied!' : 'Copy'}
             </button>
            </div>
            {getInstruction(network) && (
             <p className="text-[10px] text-gray-400 leading-tight">{getInstruction(network)}</p>
            )}
            {network === 'custom' && (
             <p className="text-[10px] text-amber-500 leading-tight flex items-center gap-0.5">
              <AlertTriangle size={9} /> Default macros — verify with your advertiser's docs
             </p>
            )}
           </div>
          ) : (
           <span className="text-xs text-gray-400">—</span>
          )}
         </td>
         <td className="px-4 py-3">
          <div className="flex items-center gap-2">
           <button onClick={() => openEdit(adv)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Edit2 size={14} /></button>
           <button onClick={() => remove(adv._id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 size={14} /></button>
          </div>
         </td>
        </tr>
        );
       })}
      </tbody>
     </table>
     </div>
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
         <label className="block text-sm font-medium text-gray-700 mb-1">Network</label>
         <select value={form.network} onChange={(e) => handleNetworkChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          {presets ? Object.entries(presets).map(([key, p]) => (
           <option key={key} value={key}>{p.label}</option>
          )) : (
           <>
            <option value="impact">Impact.com</option>
            <option value="everflow">Everflow</option>
            <option value="affise">Affise</option>
            <option value="trackier">Trackier</option>
            <option value="cellxpert">Cellxpert</option>
            <option value="custom">Custom / Other</option>
           </>
          )}
         </select>
        </div>
        <div>
         <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
         <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
         </select>
        </div>
       </div>
       <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
         Tracking Domain <span className="font-normal text-gray-400">(postback URL is built on this)</span>
        </label>
        <select value={form.trackingDomain} onChange={(e) => setForm({ ...form, trackingDomain: e.target.value })}
         className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
         <option value="">
          {settings.trackingDomain
           ? `Account default (${settings.trackingDomain})`
           : verifiedDomains[0]
             ? `Account default (${verifiedDomains[0].domain})`
             : 'No domain available'}
         </option>
         {verifiedDomains.map(d => (
          <option key={d._id} value={d._id}>{d.domain}</option>
         ))}
        </select>
        <p className="text-[11px] text-gray-400 mt-1 flex items-start gap-1">
         <Info size={10} className="mt-0.5 shrink-0" />
         <span>
          Pick one and keep it. The postback URL is registered once on the network,
          so changing this later means re-pasting it there.
         </span>
        </p>
       </div>
       <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
         Click ID Param <span className="font-normal text-gray-400">(in landing page URL)</span>
        </label>
        <input value={form.clickIdParam} onChange={(e) => setForm({ ...form, clickIdParam: e.target.value })}
         placeholder="click_id" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
         <Info size={10} /> This param is added to the advertiser's tracking link, e.g. ?{form.clickIdParam || 'click_id'}=&#123;click_id&#125;
        </p>
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

       {/* Postback URL preview in modal */}
       {trackingDomain && presets && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
         <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Postback URL Preview</label>
         <code className="text-xs text-gray-700 break-all block mb-2">
          {(() => {
           const preset = presets[form.network] || presets.custom;
           if (!preset) return '';
           const picked = verifiedDomains.find(d => d._id === form.trackingDomain);
           const domain = picked?.domain || settings.trackingDomain || verifiedDomains[0]?.domain || '';
           if (!domain) return '';
           return buildPostbackUrl({
            trackingDomain: toBaseUrl(domain),
            preset,
            secret: editing?.postbackSecret || '{auto-generated}',
           });
          })()}
         </code>
         <p className="text-[11px] text-gray-400">
          {getInstruction(form.network)}
         </p>
         {form.network === 'custom' && (
          <p className="text-[11px] text-amber-500 mt-1 flex items-center gap-1">
           <AlertTriangle size={10} /> Default macros — verify with your advertiser's docs, otherwise conversions won't match
          </p>
         )}
         {/* A preset nobody has checked against the network's own docs is the
             same risk as 'custom', just less obvious — say so before it costs
             a month of unattributed conversions. */}
         {form.network !== 'custom' && presets[form.network]?.verified === false && (
          <p className="text-[11px] text-amber-500 mt-1 flex items-start gap-1">
           <AlertTriangle size={10} className="mt-0.5 shrink-0" />
           <span>
            These macros are unverified. Confirm them against{' '}
            {presets[form.network]?.docsUrl ? (
             <a href={presets[form.network].docsUrl} target="_blank" rel="noreferrer" className="underline">
              {presets[form.network].label} docs
             </a>
            ) : 'the network docs'}{' '}before sending live traffic.
           </span>
          </p>
         )}
        </div>
       )}
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
