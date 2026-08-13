import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, MousePointerClick, DollarSign, TrendingUp, RefreshCw, ArrowUpRight, ArrowDownRight, Globe } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import api from '../api/client';
import { formatCurrency, formatNumber } from '../utils/formatCurrency';
import { CardSkeleton } from '../components/ui/Skeleton';

const REFRESH_INTERVAL = 30000;

export default function Dashboard() {
 const [summary, setSummary] = useState(null);
 const [chartData, setChartData] = useState([]);
 const [topOffers, setTopOffers] = useState([]);
 const [recentClicks, setRecentClicks] = useState([]);
 const [geoData, setGeoData] = useState([]);
 const [loading, setLoading] = useState(true);
 const [dateRange, setDateRange] = useState('30d');
 const [lastRefresh, setLastRefresh] = useState(null);

 const getDateRange = useCallback(() => {
 const to = new Date().toISOString().split('T')[0];
 const from = new Date();
 switch (dateRange) {
 case '7d': from.setDate(from.getDate() - 7); break;
 case '14d': from.setDate(from.getDate() - 14); break;
 case '90d': from.setDate(from.getDate() - 90); break;
 case 'today': return { from: to, to };
 default: from.setDate(from.getDate() - 30);
 }
 return { from: from.toISOString().split('T')[0], to };
 }, [dateRange]);

 const fetchData = useCallback(async () => {
 try {
 const { from, to } = getDateRange();
 const [sumRes, chartRes, topRes, clickRes, geoRes] = await Promise.all([
 api.get('/dashboard/summary', { params: { from, to } }),
 api.get('/dashboard/chart', { params: { from, to } }),
 api.get('/dashboard/top-offers', { params: { from, to, limit: 5 } }),
 api.get('/dashboard/recent-clicks'),
 api.get('/dashboard/geo', { params: { from, to } }),
 ]);
 setSummary(sumRes.data);
 setChartData(chartRes.data.data);
 setTopOffers(topRes.data.offers);
 setRecentClicks(clickRes.data.clicks);
 setGeoData(geoRes.data.data?.slice(0, 10) || []);
 setLastRefresh(new Date());
 } catch (err) {
 console.error('Dashboard fetch error:', err);
 } finally {
 setLoading(false);
 }
 }, [getDateRange]);

 useEffect(() => {
 fetchData();
 const interval = setInterval(fetchData, REFRESH_INTERVAL);
 return () => clearInterval(interval);
 }, [fetchData]);

 if (loading) {
 return (
 <div>
 <div className="flex items-center justify-between mb-6">
 <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
 </div>
 <CardSkeleton count={4} />
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
 <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 h-64 animate-pulse" />
 <div className="bg-white rounded-xl border border-gray-200 p-5 h-64 animate-pulse" />
 </div>
 </div>
 );
 }

 const allTime = summary?.allTime || {};
 const today = summary?.today || {};

 const stats = [
 { label: 'Total Offers', value: formatNumber(summary?.totalOffers || 0), sub: `${summary?.activeOffers || 0} active`, icon: BarChart3, color: 'bg-blue-500' },
 { label: 'Clicks', value: formatNumber(today.clicks || 0), sub: `${formatNumber(allTime.totalClicks || 0)} all time`, icon: MousePointerClick, color: 'bg-green-500' },
 { label: 'Conversions', value: formatNumber(today.conversions || 0), sub: `${formatNumber(allTime.totalConversions || 0)} all time`, icon: TrendingUp, color: 'bg-purple-500' },
 { label: 'Revenue', value: formatCurrency(today.revenue || 0), sub: `${formatCurrency(allTime.totalRevenue || 0)} all time`, icon: DollarSign, color: 'bg-amber-500' },
 ];

 const chartFormatted = chartData.map(d => ({
 ...d,
 label: d.date?.slice(5) || '',
 }));

 return (
 <div>
 <div className="flex items-center justify-between mb-6">
 <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
 <div className="flex items-center gap-3">
 <select
 value={dateRange}
 onChange={(e) => setDateRange(e.target.value)}
 className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
 >
 <option value="today">Today</option>
 <option value="7d">Last 7 days</option>
 <option value="14d">Last 14 days</option>
 <option value="30d">Last 30 days</option>
 <option value="90d">Last 90 days</option>
 </select>
 <button onClick={fetchData} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Refresh">
 <RefreshCw size={16} />
 </button>
 {lastRefresh && (
 <span className="text-xs text-gray-400">
 {lastRefresh.toLocaleTimeString()}
 </span>
 )}
 </div>
 </div>

 {/* KPI Cards */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 {stats.map((stat) => {
 const Icon = stat.icon;
 return (
 <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
 <div className="flex items-center gap-3">
 <div className={`p-2.5 rounded-lg ${stat.color} text-white`}>
 <Icon size={20} />
 </div>
 <div>
 <div className="text-sm text-gray-500">{stat.label}</div>
 <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
 <div className="text-xs text-gray-400">{stat.sub}</div>
 </div>
 </div>
 </div>
 );
 })}
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
 {/* Chart */}
 <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
 <h2 className="text-sm font-semibold text-gray-700 mb-4">Clicks & Conversions</h2>
 {chartFormatted.length === 0 ? (
 <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
 No data for this period
 </div>
 ) : (
 <div className="h-64">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={chartFormatted} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e5e7eb)" />
 <XAxis
 dataKey="label"
 tick={{ fontSize: 11, fill: '#9ca3af' }}
 tickLine={false}
 axisLine={{ stroke: '#e5e7eb' }}
 />
 <YAxis
 yAxisId="clicks"
 tick={{ fontSize: 11, fill: '#9ca3af' }}
 tickLine={false}
 axisLine={false}
 width={45}
 />
 <YAxis
 yAxisId="conversions"
 orientation="right"
 tick={{ fontSize: 11, fill: '#9ca3af' }}
 tickLine={false}
 axisLine={false}
 width={40}
 />
 <Tooltip
 contentStyle={{
 backgroundColor: 'var(--tooltip-bg, #1f2937)',
 border: 'none',
 borderRadius: '8px',
 color: '#fff',
 fontSize: '12px',
 }}
 labelFormatter={(label) => `Date: ${label}`}
 formatter={(value, name) => [formatNumber(value), name === 'clicks' ? 'Clicks' : 'Conversions']}
 />
 <Legend
 verticalAlign="top"
 height={30}
 iconType="line"
 wrapperStyle={{ fontSize: '12px' }}
 />
 <Line
 yAxisId="clicks"
 type="monotone"
 dataKey="clicks"
 stroke="#2563eb"
 strokeWidth={2}
 dot={chartFormatted.length <= 31}
 activeDot={{ r: 5 }}
 name="Clicks"
 />
 <Line
 yAxisId="conversions"
 type="monotone"
 dataKey="conversions"
 stroke="#10b981"
 strokeWidth={2}
 dot={chartFormatted.length <= 31}
 activeDot={{ r: 5 }}
 name="Conversions"
 />
 </LineChart>
 </ResponsiveContainer>
 </div>
 )}
 </div>

 {/* Top GEOs */}
 <div className="bg-white rounded-xl border border-gray-200 p-5">
 <div className="flex items-center gap-2 mb-4">
 <Globe size={16} className="text-gray-500" />
 <h2 className="text-sm font-semibold text-gray-700">Top Countries</h2>
 </div>
 {geoData.length === 0 ? (
 <div className="text-sm text-gray-400 text-center py-8">No geo data yet</div>
 ) : (
 <div className="space-y-2">
 {geoData.map((g) => (
 <div key={g.country} className="flex items-center justify-between text-sm">
 <span className="font-medium text-gray-700">{g.country}</span>
 <span className="text-gray-500">{formatNumber(g.clicks)}</span>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 {/* Top Offers */}
 <div className="bg-white rounded-xl border border-gray-200 p-5">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-sm font-semibold text-gray-700">Top Offers</h2>
 <Link to="/reports" className="text-xs text-blue-600 hover:text-blue-800">View all</Link>
 </div>
 {topOffers.length === 0 ? (
 <div className="text-sm text-gray-400 text-center py-8">No offer data yet</div>
 ) : (
 <div className="space-y-3">
 {topOffers.map((o, i) => (
 <div key={o._id} className="flex items-center gap-3">
 <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
 <div className="flex-1 min-w-0">
 <div className="text-sm font-medium text-gray-900 truncate">{o.offerName}</div>
 <div className="text-xs text-gray-400">{formatNumber(o.clicks)} clicks &middot; {o.conversions} conv</div>
 </div>
 <div className="text-right">
 <div className="text-sm font-bold text-gray-900">{formatCurrency(o.revenue)}</div>
 <div className={`text-xs font-medium ${o.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
 {o.profit >= 0 ? <ArrowUpRight size={10} className="inline" /> : <ArrowDownRight size={10} className="inline" />}
 {formatCurrency(Math.abs(o.profit))}
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Recent Clicks */}
 <div className="bg-white rounded-xl border border-gray-200 p-5">
 <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Clicks</h2>
 {recentClicks.length === 0 ? (
 <div className="text-sm text-gray-400 text-center py-8">No clicks yet</div>
 ) : (
 <div className="space-y-2">
 {recentClicks.slice(0, 8).map((c) => (
 <div key={c.clickId} className="flex items-center gap-2 text-xs">
 <span className={`w-2 h-2 rounded-full ${c.converted ? 'bg-green-500' : 'bg-gray-300'}`} />
 <span className="font-medium text-gray-700 truncate flex-1">{c.offerName}</span>
 <span className="text-gray-400">{c.country}</span>
 <span className="text-gray-400">{c.device}</span>
 {c.converted && <span className="text-green-600 font-medium">{formatCurrency(c.revenue)}</span>}
 <span className="text-gray-300 w-14 text-right">
 {new Date(c.clickedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
 </span>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
