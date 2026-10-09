import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, Copy, ExternalLink, Search, AlertTriangle, Check, Info, RefreshCw } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { isReadOnly } from '../utils/roles';
import { buildPostbackUrl, resolveAdvertiserDomain, toBaseUrl } from '../utils/postbackUrl';
import AdvertiserFormModal from '../components/advertisers/AdvertiserFormModal';
import SearchSuggest from '../components/ui/SearchSuggest';

// Green is reserved for Active and red for Inactive — nothing else on this
// list uses either colour.
const statusColors = {
 active: 'bg-green-100 text-green-800',
 inactive: 'bg-red-100 text-red-700',
};

// Every network badge is the same blue. Colour on this list carries one
// meaning only: green = Active, red = Inactive.
const BADGE_BLUE = 'bg-blue-100 text-blue-700';

export default function Advertisers() {
 const { user } = useAuth();
 // Read-only accounts see the advertiser list but cannot touch it.
 const canEdit = !isReadOnly(user);
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
 const [refreshing, setRefreshing] = useState(false);
 // Every advertiser name, for the search suggestions (the table itself is
 // filtered by the search, so it cannot be the source).
 const [allNames, setAllNames] = useState([]);
 const fetchAllNames = () => {
  api.get('/advertisers').then(({ data }) => setAllNames((data.advertisers || []).map(a => a.name))).catch(() => {});
 };
 useEffect(() => { fetchAllNames(); }, []);

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
  return buildPostbackUrl({ trackingDomain: toBaseUrl(domain), preset, secret: adv.postbackSecret, clickIdParam: adv.clickIdParam });
 };

 const openAdd = () => { setEditing(null); setShowModal(true); };
 const openEdit = (adv) => { setEditing(adv); setShowModal(true); };

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
  const fallback = { impact: 'Impact.com', everflow: 'Everflow', affise: 'Affise', trackier: 'Trackier', cellxpert: 'Cellxpert', katalys: 'Katalys', smartadv: 'SmartAdv', oasisads: 'Oasis Ads', vipresponse: 'VIP Response', blueaff: 'BlueAff', salegains: 'SaleGains', maxbounty: 'MaxBounty', maxweb: 'MaxWeb', flexoffers: 'FlexOffers', fanfuel: 'FanFuel', musketeers: 'Musketeers (Trackier)', somicreative: 'Somi Creative (Affise)', custom: 'Custom / Other' };
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
    <div className="flex items-center gap-2">
     {/* Reload just this list — no full page refresh. */}
     <button
      onClick={async () => { setRefreshing(true); try { await fetchAdvertisers(); } finally { setRefreshing(false); } }}
      disabled={refreshing}
      title="Refresh list"
      className="flex items-center justify-center w-9 h-9 bg-white border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50"
     >
      <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
     </button>
     {canEdit && (
      <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
       <Plus size={16} /> Add Advertiser
      </button>
     )}
    </div>
   </div>

   <SearchSuggest
    className="max-w-sm"
    value={search}
    onChange={setSearch}
    names={allNames}
    placeholder="Search advertisers..."
   />

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
          <span className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_BLUE}`}>
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
             <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${BADGE_BLUE}`}>
              Ready for {getNetworkLabel(network)}
             </span>
             <button onClick={() => copyUrl(adv)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
              {copied === adv._id ? <Check size={12} className="text-blue-600" /> : <Copy size={12} />}
              {copied === adv._id ? 'Copied!' : 'Copy'}
             </button>
            </div>
            {/* The domain this postback URL is built on. */}
            <div className="text-xs text-gray-700 whitespace-nowrap">
             <span className="text-gray-400">Domain:</span>{' '}
             <span className="font-medium">{resolveAdvertiserDomain(adv, settings, verifiedDomains)}</span>
            </div>
            {getInstruction(network) && (
             <details className="text-[10px] text-gray-400 leading-tight">
              <summary className="cursor-pointer hover:text-gray-600">How to add on network</summary>
              <p className="mt-1">{getInstruction(network)}</p>
             </details>
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
           {canEdit ? (
            <>
             <button onClick={() => openEdit(adv)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Edit2 size={14} /></button>
             <button onClick={() => remove(adv._id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 size={14} /></button>
            </>
           ) : <span className="text-xs text-gray-300">—</span>}
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

   <AdvertiserFormModal
    open={showModal}
    editing={editing}
    presets={presets}
    verifiedDomains={verifiedDomains}
    onClose={() => setShowModal(false)}
    onSaved={() => { setShowModal(false); fetchAdvertisers(); fetchAllNames(); }}
   />
  </div>
 );
}
