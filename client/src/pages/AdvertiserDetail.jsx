import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Pencil, ArrowLeft, ExternalLink, Copy, Trash2, ChevronDown,
  Building2, Link2, Clock, BarChart3, Eye, EyeOff, Check,
  AlertTriangle, Info, RefreshCw, Plus,
} from 'lucide-react';
import api from '../api/client';
import { formatDate } from '../utils/formatDate';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatCurrency';
import { buildPostbackUrl, resolveAdvertiserDomain, toBaseUrl } from '../utils/postbackUrl';

const statusColors = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-600',
};

const offerStatusColors = {
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  draft: 'bg-gray-100 text-gray-600',
  expired: 'bg-red-100 text-red-800',
};

const networkBadgeColors = {
  impact: 'bg-indigo-100 text-indigo-700',
  everflow: 'bg-blue-100 text-blue-700',
  affise: 'bg-purple-100 text-purple-700',
  trackier: 'bg-teal-100 text-teal-700',
  cellxpert: 'bg-orange-100 text-orange-700',
  custom: 'bg-gray-100 text-gray-600',
};

// ---- Shared Components (same as OfferDetail) ----

function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        {Icon && <Icon size={16} className="text-gray-400" />}
        <span className="text-sm font-semibold text-gray-800 flex-1">{title}</span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100">{children}</div>}
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-medium text-gray-900 text-right max-w-[60%] ${mono ? 'font-mono text-xs' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mb-3 last:mb-0">
      <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">{label}</span>
      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
        <code className="text-xs text-gray-800 break-all flex-1 select-all">{value}</code>
        <button onClick={copy} className="shrink-0 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600" title="Copy">
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = 'gray' }) {
  const textColor = color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' : 'text-gray-900';
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-bold ${textColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ---- Main Component ----

export default function AdvertiserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [advertiser, setAdvertiser] = useState(null);
  const [offers, setOffers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [settings, setSettings] = useState({});
  const [presets, setPresets] = useState(null);
  const [domains, setDomains] = useState([]);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [form, setForm] = useState({});

  const fetchData = async () => {
    try {
      const [advRes, settingsRes, presetsRes, domainsRes] = await Promise.all([
        api.get(`/advertisers/${id}`),
        api.get('/settings').catch(() => ({ data: { settings: {} } })),
        api.get('/network-presets').catch(() => ({ data: { presets: null } })),
        api.get('/tracking-domains').catch(() => ({ data: { domains: [] } })),
      ]);
      setAdvertiser(advRes.data.advertiser);
      setOffers(advRes.data.offers || []);
      setStats(advRes.data.stats || null);
      setSettings(settingsRes.data.settings || {});
      setDomains((domainsRes.data.domains || []).filter(d => d.status === 'verified'));
      if (presetsRes.data.presets) setPresets(presetsRes.data.presets);
    } catch (err) {
      console.error('Failed to fetch advertiser:', err);
      if (err.response?.status === 404) {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this advertiser?')) return;
    try {
      await api.delete(`/advertisers/${id}`);
      navigate('/advertisers');
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to delete';
      alert(msg);
    }
  };

  const handleRegenerateSecret = async () => {
    if (!window.confirm('Regenerate postback secret? All existing postback URLs with the old secret will stop working.')) return;
    try {
      const { data } = await api.post(`/advertisers/${id}/regenerate-secret`);
      setAdvertiser(data.advertiser);
      setShowSecret(true);
      alert('Secret regenerated. Update the new postback URL in the advertiser\'s panel — old URLs will no longer work.');
    } catch (err) {
      console.error('Failed to regenerate secret:', err);
    }
  };

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const openEdit = () => {
    setForm({
      name: advertiser.name || '', company: advertiser.company || '',
      website: advertiser.website || '', status: advertiser.status || 'active',
      network: advertiser.network || 'custom',
      clickIdParam: advertiser.clickIdParam || 'click_id',
      contactName: advertiser.contactName || '', contactEmail: advertiser.contactEmail || '',
      notes: advertiser.notes || '',
    });
    setShowEditModal(true);
  };

  const handleNetworkChange = (networkKey) => {
    const preset = presets?.[networkKey];
    setForm(prev => ({
      ...prev,
      network: networkKey,
      clickIdParam: preset ? preset.clickIdParam : prev.clickIdParam,
    }));
  };

  const saveEdit = async () => {
    if (!form.name.trim()) return;
    try {
      await api.put(`/advertisers/${id}`, form);
      setShowEditModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to update:', err);
    }
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

  // Loading state
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-200 rounded" />
            <div className="flex-1">
              <div className="h-7 bg-gray-200 rounded w-48 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-32" />
            </div>
          </div>
          <div className="h-24 bg-gray-200 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-48 bg-gray-200 rounded-xl" />
              <div className="h-64 bg-gray-200 rounded-xl" />
            </div>
            <div className="space-y-4">
              <div className="h-48 bg-gray-200 rounded-xl" />
              <div className="h-32 bg-gray-200 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 404 state
  if (notFound || !advertiser) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-20">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Advertiser not found</h2>
          <p className="text-gray-500 mb-4">This advertiser may have been deleted.</p>
          <Link to="/advertisers" className="text-blue-600 text-sm font-medium hover:underline">
            ← Back to Advertisers
          </Link>
        </div>
      </div>
    );
  }

  // Build postback URL
  const network = advertiser.network || 'custom';
  // Resolve through the shared helper, not settings alone — this page used to
  // ignore the advertiser's own domain entirely and show a different postback
  // URL from the one on the Offers page.
  const trackingDomain = resolveAdvertiserDomain(advertiser, settings, domains) || window.location.origin;
  const baseUrl = toBaseUrl(trackingDomain);
  const preset = presets?.[network] || presets?.custom;
  const postbackUrl = buildPostbackUrl({
    trackingDomain: baseUrl,
    preset,
    secret: advertiser.postbackSecret,
  });

  // Mask secret
  const secret = advertiser.postbackSecret || '';
  const maskedSecret = secret.length > 6 ? '••••••' + secret.slice(-4) : '••••••';

  // CR%
  const cvr = stats && stats.totalClicks > 0 ? (stats.totalConversions / stats.totalClicks) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/advertisers" className="p-1.5 rounded hover:bg-gray-200 text-gray-500">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{advertiser.name}</h1>
          {advertiser.company && <p className="text-sm text-gray-500">{advertiser.company}</p>}
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[advertiser.status] || ''}`}>
          {advertiser.status}
        </span>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={openEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Pencil size={14} /> Edit
          </button>
          <button onClick={handleDelete} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ---- Left Column (2/3) ---- */}
        <div className="lg:col-span-2 space-y-4">

          {/* General */}
          <Section title="General" icon={Building2}>
            <div className="grid grid-cols-2 gap-x-6 mt-3">
              <InfoRow label="Company / Brand" value={advertiser.company} />
              <InfoRow label="Network" value={
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${networkBadgeColors[network] || networkBadgeColors.custom}`}>
                  {getNetworkLabel(network)}
                </span>
              } />
              <InfoRow label="Website" value={
                advertiser.website ? (
                  <a href={advertiser.website} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1">
                    {advertiser.website.replace(/^https?:\/\//, '')} <ExternalLink size={12} />
                  </a>
                ) : null
              } />
              <InfoRow label="Status" value={advertiser.status} />
              <InfoRow label="Contact Name" value={advertiser.contactName} />
              <InfoRow label="Contact Email" value={advertiser.contactEmail} />
              {advertiser.notes && (
                <div className="col-span-2 py-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Notes</span>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{advertiser.notes}</p>
                </div>
              )}
            </div>
          </Section>

          {/* Postback Configuration */}
          <Section title="Postback Configuration" icon={Link2}>
            <div className="mt-3 space-y-3">
              {/* Network badge */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${networkBadgeColors[network] || networkBadgeColors.custom}`}>
                  {getNetworkLabel(network)}
                </span>
              </div>

              {/* Click ID Param */}
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Click ID Param</span>
                <code className="text-sm font-mono text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                  {advertiser.clickIdParam || 'click_id'}
                </code>
                <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                  <Info size={10} /> Added to advertiser's tracking link, e.g. ?{advertiser.clickIdParam || 'click_id'}={'{click_id}'}
                </p>
              </div>

              {/* Postback URL */}
              <CopyField label="Postback URL" value={postbackUrl} />
              {getInstruction(network) && (
                <p className="text-xs text-gray-500">{getInstruction(network)}</p>
              )}
              {network === 'custom' && (
                <p className="text-xs text-amber-500 flex items-center gap-1">
                  <AlertTriangle size={12} /> Default macros — verify with your advertiser's docs
                </p>
              )}

              {/* Postback Secret */}
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Postback Secret</span>
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                  <code className="text-xs text-gray-800 flex-1 select-all font-mono">
                    {showSecret ? secret : maskedSecret}
                  </code>
                  <button onClick={() => setShowSecret(!showSecret)}
                    className="shrink-0 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                    title={showSecret ? 'Hide' : 'Show'}>
                    {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => copyText(secret, 'secret')}
                    className="shrink-0 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600" title="Copy">
                    {copied === 'secret' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                  <button onClick={handleRegenerateSecret}
                    className="shrink-0 flex items-center gap-1 px-2 py-0.5 text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded"
                    title="Regenerate secret">
                    <RefreshCw size={12} /> Regenerate
                  </button>
                </div>
              </div>
            </div>
          </Section>

          {/* Offers */}
          <Section title="Offers" icon={BarChart3}>
            <div className="mt-3">
              {offers.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                  <p className="text-gray-500 mb-2">No offers linked to this advertiser</p>
                  <Link to="/offers/new"
                    className="inline-flex items-center gap-1.5 text-blue-600 text-sm font-medium hover:underline">
                    <Plus size={14} /> Create offer for this advertiser
                  </Link>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Name</th>
                        <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Status</th>
                        <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Clicks</th>
                        <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Conv.</th>
                        <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Revenue</th>
                        <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Payout</th>
                        <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {offers.map((o) => {
                        const profit = (o.totalRevenue || 0) - (o.totalPayout || 0);
                        return (
                          <tr key={o._id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <Link to={`/offers/${o._id}`} className="font-medium text-blue-600 hover:underline">
                                {o.name}
                              </Link>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${offerStatusColors[o.status] || ''}`}>
                                {o.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">{formatNumber(o.totalClicks || 0)}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{formatNumber(o.totalConversions || 0)}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(o.totalRevenue, o.currency)}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(o.totalPayout, o.currency)}</td>
                            <td className={`px-3 py-2 text-right font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(o.totalProfit ?? profit, o.currency)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* ---- Right Column (1/3) ---- */}
        <div className="space-y-4">

          {/* Performance */}
          <Section title="Performance" icon={BarChart3}>
            <div className="mt-3 space-y-0">
              <InfoRow label="Total Offers" value={formatNumber(stats?.totalOffers || 0)} />
              <InfoRow label="Active Offers" value={formatNumber(stats?.activeOffers || 0)} />
              <InfoRow label="Total Clicks" value={formatNumber(stats?.totalClicks || 0)} />
              <InfoRow label="Total Conversions" value={formatNumber(stats?.totalConversions || 0)} />
              <InfoRow label="Revenue" value={formatCurrency(stats?.totalRevenue || 0)} />
              <InfoRow label="Payout" value={formatCurrency(stats?.totalPayout || 0)} />
              <InfoRow label="Profit" value={
                <span className={stats?.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(stats?.totalProfit || 0)}
                </span>
              } />
              <InfoRow label="CR%" value={formatPercent(cvr)} />
            </div>
          </Section>

          {/* Details */}
          <Section title="Details" icon={Clock}>
            <div className="mt-3 space-y-0">
              <CopyField label="Advertiser ID" value={advertiser._id} />
              <InfoRow label="Created" value={formatDate(advertiser.createdAt)} />
              <InfoRow label="Updated" value={formatDate(advertiser.updatedAt)} />
            </div>
          </Section>

          {/* Internal Notes */}
          {advertiser.notes && (
            <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
              <h3 className="text-xs font-semibold text-yellow-700 uppercase mb-1">Notes</h3>
              <p className="text-sm text-yellow-900 whitespace-pre-wrap">{advertiser.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal — same as Advertisers.jsx modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <h2 className="text-lg font-semibold text-gray-900 px-6 pt-6 pb-4 shrink-0">Edit Advertiser</h2>
            {/* Only the form scrolls — the action bar below stays pinned, so
                Save Changes is reachable without scrolling to the bottom. */}
            <div className="space-y-4 px-6 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Advertiser Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company / Brand</label>
                <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
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
                  Click ID Param <span className="font-normal text-gray-400">(in landing page URL)</span>
                </label>
                <input value={form.clickIdParam} onChange={(e) => setForm({ ...form, clickIdParam: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                  <Info size={10} /> This param is added to the advertiser's tracking link, e.g. ?{form.clickIdParam || 'click_id'}={'{click_id}'}
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
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0 bg-white rounded-b-xl">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={saveEdit} disabled={!form.name?.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
