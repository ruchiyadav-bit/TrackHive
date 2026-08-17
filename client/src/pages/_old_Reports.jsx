import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Download, Filter } from 'lucide-react';
import api from '../api/client';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatCurrency';

const TABS = [
 { key: 'offer', label: 'By Offer' },
 { key: 'daily', label: 'Daily' },
 { key: 'geo', label: 'By Country' },
 { key: 'subid', label: 'By SubID' },
 { key: 'device', label: 'By Device' },
];

export default function Reports() {
 const [tab, setTab] = useState('offer');
 const [data, setData] = useState([]);
 const [loading, setLoading] = useState(true);
 const [from, setFrom] = useState(daysAgo(30));
 const [to, setTo] = useState(todayStr());
 const [offerId, setOfferId] = useState('');
 const [offers, setOffers] = useState([]);
 const [subField, setSubField] = useState('subId1');
 const [deviceGroup, setDeviceGroup] = useState('device');

 useEffect(() => {
 api.get('/offers', { params: { limit: 500 } }).then(r => setOffers(r.data.offers || [])).catch(() => {});
 }, []);

 const fetchReport = useCallback(async () => {
 setLoading(true);
 try {
 const params = { from, to };
 if (offerId) params.offer_id = offerId;

 let res;
 switch (tab) {
 case 'offer':
 res = await api.get('/reports/offer-report', { params });
 break;
 case 'daily':
 res = await api.get('/reports/daily-report', { params });
 break;
 case 'geo':
 res = await api.get('/reports/geo-report', { params });
 break;
 case 'subid':
 res = await api.get('/reports/subid-report', { params: { ...params, subField } });
 break;
 case 'device':
 res = await api.get('/reports/device-report', { params: { ...params, groupBy: deviceGroup } });
 break;
 default:
 res = { data: { data: [] } };
 }
 setData(res.data.data || []);
 } catch (err) {
 console.error('Report fetch error:', err);
 setData([]);
 } finally {
 setLoading(false);
 }
 }, [tab, from, to, offerId, subField, deviceGroup]);

 useEffect(() => {
 fetchReport();
 }, [fetchReport]);

 const handleExport = async () => {
 try {
 const params = { from, to, type: tab === 'daily' ? 'daily' : 'offer' };
 if (offerId) params.offer_id = offerId;
 const res = await api.get('/reports/export', { params, responseType: 'blob' });
 const url = window.URL.createObjectURL(new Blob([res.data]));
 const a = document.createElement('a');
 a.href = url;
 a.download = `report_${tab}_${from}_${to}.csv`;
 a.click();
 window.URL.revokeObjectURL(url);
 } catch (err) {
 console.error('Export error:', err);
 }
 };

 return (
 <div>
 <div className="flex items-center justify-between mb-6">
 <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
 <button
 onClick={handleExport}
 className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
 >
 <Download size={14} /> Export CSV
 </button>
 </div>

 {/* Tabs */}
 <div className="flex gap-1 mb-4 bg-white rounded-lg border border-gray-200 p-1 w-fit">
 {TABS.map(t => (
 <button
 key={t.key}
 onClick={() => setTab(t.key)}
 className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
 tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
 }`}
 >
 {t.label}
 </button>
 ))}
 </div>

 {/* Filters */}
 <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
 <div className="flex flex-wrap items-center gap-3">
 <div>
 <label className="block text-xs text-gray-500 mb-1">From</label>
 <input
 type="date" value={from} onChange={e => setFrom(e.target.value)}
 className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
 />
 </div>
 <div>
 <label className="block text-xs text-gray-500 mb-1">To</label>
 <input
 type="date" value={to} onChange={e => setTo(e.target.value)}
 className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
 />
 </div>
 <div>
 <label className="block text-xs text-gray-500 mb-1">Offer</label>
 <select
 value={offerId} onChange={e => setOfferId(e.target.value)}
 className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
 >
 <option value="">All Offers</option>
 {offers.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
 </select>
 </div>
 {tab === 'subid' && (
 <div>
 <label className="block text-xs text-gray-500 mb-1">Sub Field</label>
 <select
 value={subField} onChange={e => setSubField(e.target.value)}
 className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
 >
 <option value="subId1">Sub ID 1</option>
 <option value="subId2">Sub ID 2</option>
 <option value="subId3">Sub ID 3</option>
 <option value="source">Source</option>
 </select>
 </div>
 )}
 {tab === 'device' && (
 <div>
 <label className="block text-xs text-gray-500 mb-1">Group By</label>
 <select
 value={deviceGroup} onChange={e => setDeviceGroup(e.target.value)}
 className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
 >
 <option value="device">Device</option>
 <option value="os">OS</option>
 <option value="browser">Browser</option>
 </select>
 </div>
 )}
 </div>
 </div>

 {/* Table */}
 <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
 {loading ? (
 <div className="p-12 text-center text-gray-400">Loading report...</div>
 ) : data.length === 0 ? (
 <div className="p-12 text-center">
 <BarChart3 size={32} className="mx-auto text-gray-300 mb-2" />
 <p className="text-gray-500">No data for this period</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-gray-50 border-b border-gray-200">
 <th className="text-left px-4 py-3 font-medium text-gray-600">
 {tab === 'offer' ? 'Offer' : tab === 'daily' ? 'Date' : tab === 'geo' ? 'Country' : tab === 'subid' ? 'Sub ID' : deviceGroup.charAt(0).toUpperCase() + deviceGroup.slice(1)}
 </th>
 <th className="text-right px-4 py-3 font-medium text-gray-600">Clicks</th>
 <th className="text-right px-4 py-3 font-medium text-gray-600">Conv</th>
 <th className="text-right px-4 py-3 font-medium text-gray-600">CR%</th>
 <th className="text-right px-4 py-3 font-medium text-gray-600">Revenue</th>
 <th className="text-right px-4 py-3 font-medium text-gray-600">Payout</th>
 <th className="text-right px-4 py-3 font-medium text-gray-600">Profit</th>
 {tab === 'offer' && <th className="text-right px-4 py-3 font-medium text-gray-600">EPC</th>}
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100">
 {data.map((row, i) => {
 const label = row.offerName || row.date || row.country || row.subId || row[deviceGroup] || '—';
 const cr = row.cr || (row.clicks > 0 ? (row.conversions / row.clicks * 100) : 0);
 return (
 <tr key={i} className="hover:bg-gray-50">
 <td className="px-4 py-3 font-medium text-gray-900">{label}</td>
 <td className="px-4 py-3 text-right text-gray-600">{formatNumber(row.clicks)}</td>
 <td className="px-4 py-3 text-right text-gray-600">{formatNumber(row.conversions)}</td>
 <td className="px-4 py-3 text-right text-gray-600">{formatPercent(cr)}</td>
 <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(row.revenue)}</td>
 <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(row.payout)}</td>
 <td className="px-4 py-3 text-right font-medium">
 <span className={(row.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
 {formatCurrency(row.profit || 0)}
 </span>
 </td>
 {tab === 'offer' && (
 <td className="px-4 py-3 text-right text-gray-600">
 {row.epc ? `$${row.epc.toFixed(4)}` : '—'}
 </td>
 )}
 </tr>
 );
 })}
 </tbody>
 {data.length > 1 && (
 <tfoot>
 <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
 <td className="px-4 py-3 text-gray-700">Total</td>
 <td className="px-4 py-3 text-right text-gray-700">{formatNumber(data.reduce((s, r) => s + (r.clicks || 0), 0))}</td>
 <td className="px-4 py-3 text-right text-gray-700">{formatNumber(data.reduce((s, r) => s + (r.conversions || 0), 0))}</td>
 <td className="px-4 py-3 text-right text-gray-700">
 {(() => {
 const tc = data.reduce((s, r) => s + (r.clicks || 0), 0);
 const tv = data.reduce((s, r) => s + (r.conversions || 0), 0);
 return tc > 0 ? formatPercent(tv / tc * 100) : '0%';
 })()}
 </td>
 <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(data.reduce((s, r) => s + (r.revenue || 0), 0))}</td>
 <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(data.reduce((s, r) => s + (r.payout || 0), 0))}</td>
 <td className="px-4 py-3 text-right font-semibold">
 {(() => {
 const tp = data.reduce((s, r) => s + (r.profit || 0), 0);
 return <span className={tp >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(tp)}</span>;
 })()}
 </td>
 {tab === 'offer' && <td className="px-4 py-3" />}
 </tr>
 </tfoot>
 )}
 </table>
 </div>
 )}
 </div>
 </div>
 );
}

function todayStr() {
 return new Date().toISOString().split('T')[0];
}
function daysAgo(n) {
 const d = new Date();
 d.setDate(d.getDate() - n);
 return d.toISOString().split('T')[0];
}
