import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
 Pencil, ArrowLeft, ExternalLink, Copy, Trash2, ChevronDown,
 Globe, Monitor, Smartphone, Shield, Clock, Target, BarChart3,
 DollarSign, Link2, Check, Zap,
} from 'lucide-react';
import api from '../api/client';
import { formatDate } from '../utils/formatDate';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatCurrency';

const statusColors = {
 active: 'bg-green-100 text-green-800',
 paused: 'bg-yellow-100 text-yellow-800',
 draft: 'bg-gray-100 text-gray-600',
 expired: 'bg-red-100 text-red-800',
};

// ---- Shared Components ----

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

function Badge({ children, color = 'gray' }) {
 const colors = {
 gray: 'bg-gray-100 text-gray-600',
 blue: 'bg-blue-100 text-blue-700',
 green: 'bg-green-100 text-green-700',
 yellow: 'bg-yellow-100 text-yellow-700',
 red: 'bg-red-100 text-red-700',
 };
 return (
 <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.gray}`}>
 {children}
 </span>
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

export default function OfferDetail() {
 const { id } = useParams();
 const navigate = useNavigate();
 const [offer, setOffer] = useState(null);
 const [loading, setLoading] = useState(true);
 const [settings, setSettings] = useState({});
 const [presets, setPresets] = useState(null);

 useEffect(() => {
 const fetchData = async () => {
 try {
 const [offerRes, settingsRes, presetsRes] = await Promise.all([
 api.get(`/offers/${id}`),
 api.get('/settings').catch(() => ({ data: { settings: {} } })),
 api.get('/network-presets').catch(() => ({ data: { presets: null } })),
 ]);
 setOffer(offerRes.data.offer);
 setSettings(settingsRes.data.settings || {});
 if (presetsRes.data.presets) setPresets(presetsRes.data.presets);
 } catch (err) {
 console.error('Failed to fetch offer:', err);
 navigate('/offers');
 } finally {
 setLoading(false);
 }
 };
 fetchData();
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
 return <div className="flex items-center justify-center h-64 text-gray-400">Loading offer...</div>;
 }

 if (!offer) return null;

 // Build tracking URLs
 const trackingDomain = offer.trackingDomain?.domain || settings.trackingDomain || window.location.origin;
 const baseUrl = trackingDomain.startsWith('http') ? trackingDomain : `https://${trackingDomain}`;
 const clickUrl = `${baseUrl}/click?offer_id=${offer._id}&sub1={sub1}&sub2={sub2}&source={source}`;
 const advSecret = typeof offer.advertiser === 'object' ? offer.advertiser?.postbackSecret : null;
 const advNetwork = typeof offer.advertiser === 'object' ? (offer.advertiser?.network || 'custom') : 'custom';
 const preset = presets?.[advNetwork] || presets?.custom;
 const macros = preset?.macros || { click_id: '{click_id}', revenue: '{revenue}', payout: '{payout}', event: '{event}' };
 const postbackUrl = `${baseUrl}/postback?click_id=${macros.click_id}&revenue=${macros.revenue}&payout=${macros.payout}&event=${macros.event}${advSecret ? `&secret=${advSecret}` : ''}`;

 // Stats
 const cvr = offer.totalClicks > 0 ? (offer.totalConversions / offer.totalClicks) * 100 : 0;
 const margin = offer.totalRevenue > 0 ? ((offer.totalProfit / offer.totalRevenue) * 100) : 0;

 // Advertiser name
 const advertiserName = offer.advertiser
 ? (typeof offer.advertiser === 'object' ? offer.advertiser.name : offer.advertiser)
 : null;

 return (
 <div className="max-w-6xl mx-auto">
 {/* Header */}
 <div className="flex items-center gap-3 mb-6">
 <Link to="/offers" className="p-1.5 rounded hover:bg-gray-200 text-gray-500">
 <ArrowLeft size={20} />
 </Link>
 <div className="flex-1 min-w-0">
 <h1 className="text-2xl font-bold text-gray-900 truncate">{offer.name}</h1>
 {advertiserName && <p className="text-sm text-gray-500">{advertiserName}</p>}
 </div>
 <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[offer.status] || ''}`}>
 {offer.status}
 </span>
 <div className="flex items-center gap-1 ml-2">
 <Link to={`/offers/${id}/edit`}
 className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
 <Pencil size={14} /> Edit
 </Link>
 <button onClick={handleDuplicate} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Duplicate">
 <Copy size={16} />
 </button>
 <button onClick={handleDelete} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title="Delete">
 <Trash2 size={16} />
 </button>
 </div>
 </div>

 {/* Stats Bar */}
 <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
 <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
 <StatCard label="Clicks" value={formatNumber(offer.totalClicks || 0)} />
 <StatCard label="Conversions" value={formatNumber(offer.totalConversions || 0)} />
 <StatCard label="CVR" value={formatPercent(cvr)} />
 <StatCard label="Revenue" value={formatCurrency(offer.totalRevenue, offer.currency)} />
 <StatCard label="Payout" value={formatCurrency(offer.totalPayout, offer.currency)} />
 <StatCard label="Profit" value={formatCurrency(offer.totalProfit, offer.currency)}
 color={offer.totalProfit >= 0 ? 'green' : 'red'} sub={margin ? `${margin.toFixed(1)}% margin` : undefined} />
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 {/* ---- Left Column (2/3) ---- */}
 <div className="lg:col-span-2 space-y-4">

 {/* General */}
 <Section title="General" icon={BarChart3}>
 <div className="grid grid-cols-2 gap-x-6 mt-3">
 <InfoRow label="Advertiser" value={advertiserName} />
 <InfoRow label="Category" value={offer.category} />
 <InfoRow label="Currency" value={offer.currency || 'USD'} />
 <InfoRow label="Status" value={offer.status} />
 {offer.labels?.length > 0 && (
 <div className="col-span-2 py-2 border-b border-gray-50">
 <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1.5">Labels</span>
 <div className="flex flex-wrap gap-1">
 {offer.labels.map(l => <Badge key={l} color="blue">{l}</Badge>)}
 </div>
 </div>
 )}
 {offer.channels?.length > 0 && (
 <div className="col-span-2 py-2 border-b border-gray-50">
 <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1.5">Channels</span>
 <div className="flex flex-wrap gap-1">
 {offer.channels.map(c => <Badge key={c}>{c}</Badge>)}
 </div>
 </div>
 )}
 {offer.description && (
 <div className="col-span-2 py-2">
 <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Description</span>
 <p className="text-sm text-gray-700">{offer.description}</p>
 </div>
 )}
 </div>
 </Section>

 {/* Tracking & URLs */}
 <Section title="Tracking & URLs" icon={Link2}>
 <div className="mt-3 space-y-1">
 {offer.landingPageUrl && (
 <div className="mb-3">
 <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Landing Page URL</span>
 <a href={offer.landingPageUrl} target="_blank" rel="noopener noreferrer"
 className="text-sm text-blue-600 hover:underline break-all flex items-center gap-1">
 {offer.landingPageUrl} <ExternalLink size={12} />
 </a>
 </div>
 )}
 <CopyField label="Click Tracking URL" value={clickUrl} />
 <CopyField label="Postback URL (S2S)" value={postbackUrl} />
 <div className="grid grid-cols-2 gap-x-6 mt-3">
 <InfoRow label="Tracking Domain" value={offer.trackingDomain?.domain || settings.trackingDomain || '—'} />
 <InfoRow label="Conversion Method" value={
 offer.conversionTrackingMethod === 'server_postback' ? 'Server Postback (S2S)' :
 offer.conversionTrackingMethod === 'javascript_sdk' ? 'JavaScript SDK' :
 offer.conversionTrackingMethod === 'iframe_pixel' ? 'iFrame Pixel' :
 offer.conversionTrackingMethod || 'Server Postback (S2S)'
 } />
 <InfoRow label="Linking Type" value={offer.linkingType === 'direct' ? 'Direct' : 'Redirect'} />
 <InfoRow label="Redirect Mode" value={offer.redirectMode || '302'} />
 <InfoRow label="Duplicate Filter" value={offer.enableDuplicateFilter !== false ? 'Enabled' : 'Disabled'} />
 <InfoRow label="Session ID" value={
 offer.uniqueSessionIdentifier === 'ip' ? 'IP Address' :
 offer.uniqueSessionIdentifier === 'ip_ua' ? 'IP + User Agent' :
 offer.uniqueSessionIdentifier === 'cookie' ? 'Cookie' :
 offer.uniqueSessionIdentifier === 'device_id' ? 'Device ID' :
 offer.uniqueSessionIdentifier || 'IP Address'
 } />
 </div>
 </div>
 </Section>

 {/* Revenue & Payout Configuration */}
 <Section title="Revenue & Payout" icon={DollarSign}>
 <div className="mt-3">
 <div className="grid grid-cols-2 gap-6">
 {/* Revenue */}
 <div className="bg-gray-50 rounded-lg p-4">
 <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Revenue</h4>
 <div className="space-y-2">
 <div className="flex justify-between">
 <span className="text-sm text-gray-600">Type</span>
 <Badge color="blue">{offer.revenueType || 'RPA'}</Badge>
 </div>
 <div className="flex justify-between">
 <span className="text-sm text-gray-600">Amount</span>
 <span className="text-sm font-bold text-gray-900">{formatCurrency(offer.revenueAmount, offer.currency)}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-sm text-gray-600">Action</span>
 <span className="text-sm text-gray-700 capitalize">{offer.revenueAction || 'conversion'}</span>
 </div>
 </div>
 </div>
 {/* Payout */}
 <div className="bg-gray-50 rounded-lg p-4">
 <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Payout</h4>
 <div className="space-y-2">
 <div className="flex justify-between">
 <span className="text-sm text-gray-600">Type</span>
 <Badge color="green">{offer.payoutType || 'CPA'}</Badge>
 </div>
 <div className="flex justify-between">
 <span className="text-sm text-gray-600">Amount</span>
 <span className="text-sm font-bold text-gray-900">{formatCurrency(offer.payoutAmount, offer.currency)}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-sm text-gray-600">Action</span>
 <span className="text-sm text-gray-700 capitalize">{offer.payoutAction || 'conversion'}</span>
 </div>
 </div>
 </div>
 </div>

 {/* Events table */}
 {offer.events?.length > 0 && (
 <div className="mt-4">
 <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Conversion Events</h4>
 <div className="border border-gray-200 rounded-lg overflow-hidden">
 <table className="w-full text-sm">
 <thead className="bg-gray-50">
 <tr>
 <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Event Name</th>
 <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Revenue</th>
 <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Payout</th>
 </tr>
 </thead>
 <tbody>
 {offer.events.map((ev, i) => (
 <tr key={ev._id || i} className="border-t border-gray-100">
 <td className="px-3 py-2 font-medium text-gray-800">{ev.name || `Event ${i + 1}`}</td>
 <td className="px-3 py-2 text-gray-600">
 {ev.revenueType || 'RPA'} {formatCurrency(ev.revenueAmount, offer.currency)}
 </td>
 <td className="px-3 py-2 text-gray-600">
 {ev.payoutType || 'CPA'} {formatCurrency(ev.payoutAmount, offer.currency)}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 <div className="grid grid-cols-2 gap-x-6 mt-3">
 <InfoRow label="Duplicate Conversions" value={offer.allowDuplicateConversions ? 'Allowed' : 'Blocked'} />
 <InfoRow label="Manual Approval" value={offer.manualApproveConversions ? 'Yes' : 'No'} />
 </div>
 </div>
 </Section>

 {/* Targeting */}
 <Section title="Targeting" icon={Target} defaultOpen={false}>
 <div className="mt-3 space-y-4">
 {/* GEO */}
 {offer.geoCountries?.length > 0 && (
 <div>
 <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1.5">
 GEO ({offer.geoMode === 'exclude' ? 'Excluded' : 'Included'})
 </span>
 <div className="flex flex-wrap gap-1">
 {offer.geoCountries.map(g => (
 <Badge key={g} color={offer.geoMode === 'exclude' ? 'red' : 'green'}>{g}</Badge>
 ))}
 </div>
 </div>
 )}
 {/* Devices */}
 {offer.deviceTypes?.length > 0 && (
 <div>
 <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1.5">Devices</span>
 <div className="flex flex-wrap gap-1">
 {offer.deviceTypes.map(d => <Badge key={d} color="blue">{d}</Badge>)}
 </div>
 </div>
 )}
 {/* OS */}
 {offer.operatingSystems?.length > 0 && (
 <div>
 <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1.5">Operating Systems</span>
 <div className="flex flex-wrap gap-1">
 {offer.operatingSystems.map(os => <Badge key={os} color="blue">{os}</Badge>)}
 {offer.osVersionMin && <span className="text-xs text-gray-500 ml-1">(min v{offer.osVersionMin})</span>}
 </div>
 </div>
 )}
 {/* Browsers */}
 {offer.browsers?.length > 0 && (
 <div>
 <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1.5">Browsers</span>
 <div className="flex flex-wrap gap-1">
 {offer.browsers.map(b => <Badge key={b} color="blue">{b}</Badge>)}
 </div>
 </div>
 )}
 {/* Connection */}
 {offer.connectionTypes?.length > 0 && (
 <div>
 <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1.5">Connection Types</span>
 <div className="flex flex-wrap gap-1">
 {offer.connectionTypes.map(c => <Badge key={c}>{c}</Badge>)}
 </div>
 </div>
 )}
 {/* IP Block */}
 {offer.enableIPBlock && offer.ipBlocklist && (
 <div>
 <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1.5">IP Blocklist</span>
 <Badge color="red">Enabled</Badge>
 </div>
 )}
 {/* Empty state */}
 {!offer.geoCountries?.length && !offer.deviceTypes?.length && !offer.operatingSystems?.length && !offer.browsers?.length && (
 <p className="text-sm text-gray-400 italic">No targeting restrictions — all traffic accepted</p>
 )}
 </div>
 </Section>
 </div>

 {/* ---- Right Column (1/3) ---- */}
 <div className="space-y-4">

 {/* Caps & Control */}
 <Section title="Caps & Control" icon={Shield}>
 <div className="mt-3">
 {offer.enableCaps ? (
 <div className="space-y-2">
 {offer.dailyClickCap > 0 && <InfoRow label="Daily Click Cap" value={formatNumber(offer.dailyClickCap)} />}
 {offer.dailyConversionCap > 0 && <InfoRow label="Daily Conv. Cap" value={formatNumber(offer.dailyConversionCap)} />}
 {offer.monthlyConversionCap > 0 && <InfoRow label="Monthly Conv. Cap" value={formatNumber(offer.monthlyConversionCap)} />}
 {offer.totalCap > 0 && <InfoRow label="Total Cap" value={formatNumber(offer.totalCap)} />}
 {!offer.dailyClickCap && !offer.dailyConversionCap && !offer.monthlyConversionCap && !offer.totalCap && (
 <p className="text-sm text-gray-400 italic">Caps enabled but no limits set</p>
 )}
 </div>
 ) : (
 <p className="text-sm text-gray-400 italic">No caps configured</p>
 )}
 <div className="mt-2">
 <InfoRow label="Visibility" value={
 offer.offerVisibility === 'requires_approval' ? 'Requires Approval' :
 offer.offerVisibility === 'private' ? 'Private' : 'Public'
 } />
 </div>
 </div>
 </Section>

 {/* Attribution */}
 <Section title="Attribution" icon={Zap}>
 <div className="mt-3 space-y-0">
 <InfoRow label="Method" value={
 offer.attributionMethod === 'first_click' ? 'First Click' : 'Last Click'
 } />
 <InfoRow label="Throttle" value={
 offer.enableThrottle ? `${offer.throttleRate || 0}%` : 'Disabled'
 } />
 <InfoRow label="Click-to-Conv. Window" value={
 offer.enableClickToConversionTime
 ? `${offer.clickToConversionValue || 24} ${offer.clickToConversionUnit || 'hours'}`
 : 'No limit'
 } />
 </div>
 </Section>

 {/* Details */}
 <Section title="Details" icon={Clock}>
 <div className="mt-3 space-y-0">
 <InfoRow label="Created" value={formatDate(offer.createdAt)} />
 <InfoRow label="Updated" value={formatDate(offer.updatedAt)} />
 <InfoRow label="Offer ID" value={offer._id} mono />
 {offer.slug && <InfoRow label="Slug" value={offer.slug} mono />}
 {offer.hasExpiration && offer.expirationDate && (
 <InfoRow label="Expires" value={formatDate(offer.expirationDate)} />
 )}
 {offer.appIdentifier && <InfoRow label="App ID" value={offer.appIdentifier} mono />}
 </div>
 </Section>

 {/* Internal Notes */}
 {offer.internalNotes && (
 <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
 <h3 className="text-xs font-semibold text-yellow-700 uppercase mb-1">Internal Notes</h3>
 <p className="text-sm text-yellow-900 whitespace-pre-wrap">{offer.internalNotes}</p>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
