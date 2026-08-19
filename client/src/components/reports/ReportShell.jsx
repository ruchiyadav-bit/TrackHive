import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ChevronDown, ChevronRight, ChevronLeft, Download, Play,
  Search, SlidersHorizontal, BarChart3, X, RefreshCw,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import api from '../../api/client';

// ─── Format Helpers ─────────────────────────────────────────────────────────

export function fmtCurrency(v) {
  const n = Number(v);
  if (isNaN(n)) return '$0.00';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtNumber(v) {
  const n = Number(v);
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-US');
}

export function fmtRate(v) {
  const n = Number(v);
  if (isNaN(n)) return '0.000';
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export function fmtPercent(v) {
  const n = Number(v);
  if (isNaN(n)) return '0.000%';
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + '%';
}

// ─── Date helpers ───────────────────────────────────────────────────────────

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

/**
 * Quick date ranges. `custom` keeps whatever is already in the From/To boxes
 * and is the only option that reveals them — the calendar is there when it is
 * needed and out of the way when it is not.
 */
const DATE_RANGES = [
  { key: 'today',     label: 'Today',       range: () => [todayStr(), todayStr()] },
  { key: 'yesterday', label: 'Yesterday',   range: () => [daysAgo(1), daysAgo(1)] },
  { key: 'last2',     label: 'Last 2 days', range: () => [daysAgo(1), todayStr()] },
  { key: 'last7',     label: 'Last 7 days', range: () => [daysAgo(6), todayStr()] },
  { key: 'custom',    label: 'Custom',      range: null },
];

/** Which preset (if any) the current from/to pair corresponds to. */
function matchRange(from, to) {
  const hit = DATE_RANGES.find(r => r.range && r.range().join() === [from, to].join());
  return hit ? hit.key : 'custom';
}

// ─── Summary Card ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${color || 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Summary Cards Grid ─────────────────────────────────────────────────────

function SummaryCards({ summary, collapsed, onToggle }) {
  if (!summary) return null;

  const cards = [
    { label: 'Gross Clicks', value: fmtNumber(summary.grossClicks) },
    { label: 'Clicks', value: fmtNumber(summary.clicks) },
    { label: 'Unique', value: fmtNumber(summary.uniqueClicks) },
    { label: 'Dup', value: fmtNumber(summary.dupClicks), color: 'text-amber-600' },
    { label: 'Invalid', value: fmtNumber(summary.invalidClicks), color: 'text-red-600' },
    { label: 'Conversions', value: fmtNumber(summary.cv) },
    { label: 'CVR', value: fmtPercent(summary.cvr) },
    { label: 'Revenue', value: fmtCurrency(summary.revenue), color: 'text-blue-600' },
    { label: 'Payout', value: fmtCurrency(summary.payout) },
    { label: 'Profit', value: fmtCurrency(summary.profit), color: Number(summary.profit) >= 0 ? 'text-green-600' : 'text-red-600' },
    { label: 'CPC', value: fmtCurrency(summary.cpc) },
    { label: 'CPA', value: fmtCurrency(summary.cpa) },
    { label: 'RPC', value: fmtCurrency(summary.rpc) },
    { label: 'RPA', value: fmtCurrency(summary.rpa) },
    { label: 'Margin', value: fmtPercent(summary.margin) },
  ];

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 mb-2"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        Summary
      </button>
      {!collapsed && (
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
          {cards.map(c => (
            <SummaryCard key={c.label} {...c} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Performance Chart ──────────────────────────────────────────────────────

function PerformanceChart({ chart, collapsed, onToggle }) {
  if (!chart || chart.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 mb-2"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        <BarChart3 size={14} />
        Performance Graph
      </button>
      {!collapsed && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5) || v} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(val, name) => {
                  if (name === 'Revenue' || name === 'Profit') return ['$' + Number(val).toFixed(2), name];
                  return [Number(val).toLocaleString(), name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="clicks" name="Clicks" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="conversions" name="Conversions" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="profit" name="Profit" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Status Badge ───────────────────────────────────────────────────────────

const BADGE_STYLES = {
  ok: 'bg-green-100 text-green-700',
  converted: 'bg-blue-100 text-blue-700',
  duplicate: 'bg-amber-100 text-amber-700',
  blocked: 'bg-red-100 text-red-700',
  bot: 'bg-red-100 text-red-700',
  vpn: 'bg-orange-100 text-orange-700',
};
const BADGE_LABELS = {
  ok: 'OK', converted: 'CONV', duplicate: 'DUP', blocked: 'BLOCKED', bot: 'BOT', vpn: 'VPN',
};

function Badge({ status }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${BADGE_STYLES[status] || BADGE_STYLES.ok}`}>
      {BADGE_LABELS[status] || status}
    </span>
  );
}

/**
 * A click can carry more than one flag at once — most notably a
 * frequency-cap block, which is both BLOCKED and DUP. When passed a row
 * with explicit boolean flags (isBlocked/isDuplicate/isBot/isVpn/converted),
 * every applicable badge is rendered side by side. Falls back to a single
 * `status` string for older callers.
 */
export function StatusBadge({ status, row }) {
  if (row) {
    const badges = [];
    if (row.isBot) badges.push('bot');
    if (row.isBlocked) badges.push('blocked');
    if (row.isDuplicate) badges.push('duplicate');
    if (row.converted) badges.push('converted');
    // Nothing wrong with this click — say so explicitly. VPN is only an
    // advisory flag (it never blocks), so on its own it must not replace OK,
    // otherwise a perfectly good click reads as a problem.
    if (!badges.length) badges.push('ok');
    if (row.isVpn) badges.push('vpn');
    return (
      <span className="inline-flex items-center gap-1">
        {badges.map(b => <Badge key={b} status={b} />)}
      </span>
    );
  }
  return <Badge status={status} />;
}

// ─── Main ReportShell ───────────────────────────────────────────────────────

export default function ReportShell({
  title,
  breadcrumb = 'Reports',
  columns,
  endpoint,
  defaultSort = '',
  // 0 = today only. Reports open on today's data instead of an empty
  // "click Run Report" screen.
  defaultDays = 0,
  renderCell,
  renderExpandRow,
  extraFilters,
  extraParams = {},
  hideChart = false,
  // > 0 turns on silent background polling (used by the click log)
  autoRefreshMs = 0,
}) {
  // State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [from, setFrom] = useState(daysAgo(defaultDays));
  const [to, setTo] = useState(todayStr());
  const [offerId, setOfferId] = useState('');
  const [offers, setOffers] = useState([]);
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState(defaultSort);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [chartCollapsed, setChartCollapsed] = useState(true); // default CLOSED
  const [searchText, setSearchText] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(autoRefreshMs > 0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [rangeKey, setRangeKey] = useState(() => matchRange(daysAgo(defaultDays), todayStr()));

  // Load offers on first render
  if (!offersLoaded) {
    setOffersLoaded(true);
    api.get('/offers', { params: { limit: 500 } })
      .then(r => setOffers(r.data.offers || []))
      .catch(() => {});
  }

  // extraParams is a fresh object literal on every parent render, so it can't
  // be a hook dependency directly — it would retrigger forever. Key on its
  // serialised contents instead.
  const extraKey = JSON.stringify(extraParams);

  // Fetch report. `silent` skips the loading state so a background refresh
  // doesn't blank the table the user is reading.
  const fetchReport = useCallback(async (p = 1, { silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const params = { from, to, page: p, sort: sortKey, ...extraParams };
      if (offerId) params.offer_id = offerId;
      if (searchText) params.search = searchText;
      const res = await api.get(endpoint, { params });
      setData(res.data);
      setPage(p);
      setHasRun(true);
      setLastUpdated(new Date());
      if (!silent) setExpandedRows(new Set());
    } catch (err) {
      console.error('Report error:', err);
      if (!silent) setData(null);
    } finally {
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, offerId, sortKey, endpoint, extraKey, searchText]);

  const handleRun = () => fetchReport(1);
  const handlePageChange = (newPage) => fetchReport(newPage);

  // Picking a range applies it straight away — making the user press Run Report
  // after clicking "Yesterday" is a pointless second step.
  const applyRange = (key) => {
    setRangeKey(key);
    const preset = DATE_RANGES.find(r => r.key === key);
    if (!preset?.range) return;
    const [f, t] = preset.range();
    setFrom(f);
    setTo(t);
    pendingRunRef.current = true;
  };

  // Refresh in place: same filters, same page, no full page reload. Also
  // reloads the Offer dropdown so a newly created offer appears without one.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      api.get('/offers', { params: { limit: 500 } })
        .then(r => setOffers(r.data.offers || []))
        .catch(() => {});
      await fetchReport(page, { silent: true });
    } finally {
      setRefreshing(false);
    }
  };

  // Keep the newest fetchReport/page in refs so the polling interval below
  // doesn't need them as dependencies (which would restart it constantly).
  // applyRange sets from/to and flags a run; the effect below fires once the
  // new dates are actually in state.
  const pendingRunRef = useRef(false);
  const fetchRef = useRef(fetchReport);
  const pageRef = useRef(page);
  useEffect(() => { fetchRef.current = fetchReport; }, [fetchReport]);
  useEffect(() => { pageRef.current = page; }, [page]);

  // Run once on mount so the report opens with data already on screen.
  // Filter changes still go through the Run Report button.
  const didAutoRun = useRef(false);
  useEffect(() => {
    if (didAutoRun.current) return;
    didAutoRun.current = true;
    fetchRef.current(1);
  }, []);

  // Apply a range preset once its dates have landed in state.
  useEffect(() => {
    if (!pendingRunRef.current) return;
    pendingRunRef.current = false;
    fetchRef.current(1);
  }, [from, to]);

  // Background polling — silent, keeps the current page, pauses when the tab
  // is hidden so a background tab isn't hammering the API.
  useEffect(() => {
    if (!autoRefreshMs || !autoRefresh) return undefined;
    const id = setInterval(() => {
      if (document.hidden) return;
      fetchRef.current(pageRef.current, { silent: true });
    }, autoRefreshMs);
    return () => clearInterval(id);
  }, [autoRefreshMs, autoRefresh]);

  const handleSort = (key) => {
    const newSort = sortKey === `-${key}` ? key : `-${key}`;
    setSortKey(newSort);
  };

  const toggleExpand = (idx) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // CSV export
  const handleExport = async () => {
    try {
      const type = endpoint.split('/').pop(); // 'conversion', 'offer', etc.
      const params = { from, to, type };
      if (offerId) params.offer_id = offerId;
      const res = await api.get('/reports/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${from}_to_${to}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const pagination = data?.pagination;
  const sortField = sortKey.replace(/^-/, '');
  const sortDir = sortKey.startsWith('-') ? 'desc' : 'asc';

  return (
    <div className="max-w-full">
      {/* Header with breadcrumb */}
      <div className="mb-5">
        <div className="text-xs text-gray-400 mb-1">{breadcrumb} / {title}</div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <div className="flex items-center gap-2">
            {autoRefreshMs > 0 && (
              <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={e => setAutoRefresh(e.target.checked)}
                  className="accent-blue-600"
                />
                <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                Live
                <span className="text-gray-400">
                  {autoRefresh ? `${Math.round(autoRefreshMs / 1000)}s` : 'off'}
                </span>
              </label>
            )}
            {lastUpdated && (
              <span className="text-[11px] text-gray-400">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              title="Refresh data"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>
            {hasRun && (
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
              >
                <Download size={13} /> CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
        {/* Quick ranges */}
        <div className="flex flex-wrap items-center gap-1 mb-3">
          {DATE_RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => applyRange(r.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                rangeKey === r.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className={rangeKey === 'custom' ? '' : 'hidden'}>
            <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={e => { setFrom(e.target.value); setRangeKey(matchRange(e.target.value, to)); }}
              className="px-2.5 py-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
            />
          </div>
          <div className={rangeKey === 'custom' ? '' : 'hidden'}>
            <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={e => { setTo(e.target.value); setRangeKey(matchRange(from, e.target.value)); }}
              className="px-2.5 py-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">Offer</label>
            <select
              value={offerId}
              onChange={e => setOfferId(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 min-w-[160px]"
            >
              <option value="">All Offers</option>
              {offers.map(o => (
                <option key={o._id} value={o._id}>{o.name}</option>
              ))}
            </select>
          </div>

          {rangeKey !== 'custom' && (
            <div className="text-[11px] text-gray-400 pb-1.5">
              {from === to ? from : `${from} → ${to}`}
            </div>
          )}

          {/* Extra filters injected by report page */}
          {extraFilters}

          <button
            onClick={handleRun}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 ml-auto"
          >
            <Play size={13} />
            {loading ? 'Running...' : 'Run Report'}
          </button>
        </div>
      </div>

      {/* Not run yet */}
      {!hasRun && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
          <BarChart3 size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Adjust your filters and click <strong>Run Report</strong></p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
          <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-gray-400 text-sm">Generating report...</p>
        </div>
      )}

      {/* Results */}
      {hasRun && !loading && data && (
        <>
          {/* Summary Cards */}
          <SummaryCards
            summary={data.summary}
            collapsed={summaryCollapsed}
            onToggle={() => setSummaryCollapsed(!summaryCollapsed)}
          />

          {/* Chart */}
          {!hideChart && data.chart && data.chart.length > 0 && (
            <PerformanceChart
              chart={data.chart}
              collapsed={chartCollapsed}
              onToggle={() => setChartCollapsed(!chartCollapsed)}
            />
          )}

          {/* Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {(!data.rows || data.rows.length === 0) ? (
              <div className="p-12 text-center">
                <BarChart3 size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">No data for this period</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {renderExpandRow && <th className="w-8 px-2 py-2.5" />}
                        {columns.map(col => (
                          <th
                            key={col.key}
                            onClick={() => col.sortable !== false && handleSort(col.key)}
                            className={`px-3 py-2.5 font-medium text-gray-600 whitespace-nowrap text-xs uppercase tracking-wider ${
                              col.align === 'left' ? 'text-left' : 'text-right'
                            } ${col.sortable !== false ? 'cursor-pointer hover:text-gray-900 select-none' : ''}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {col.label}
                              {sortField === col.key && (
                                <span className="text-blue-600">{sortDir === 'desc' ? '↓' : '↑'}</span>
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.rows.map((row, idx) => (
                        <>
                          <tr
                            key={idx}
                            className={`hover:bg-gray-50 ${expandedRows.has(idx) ? 'bg-blue-50/30' : ''}`}
                          >
                            {renderExpandRow && (
                              <td className="px-2 py-2">
                                {row.expand ? (
                                  <button onClick={() => toggleExpand(idx)} className="text-gray-400 hover:text-gray-700">
                                    {expandedRows.has(idx) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </button>
                                ) : null}
                              </td>
                            )}
                            {columns.map(col => (
                              <td
                                key={col.key}
                                className={`px-3 py-2 whitespace-nowrap ${col.align === 'left' ? 'text-left' : 'text-right'} ${col.className || ''}`}
                              >
                                {renderCell ? renderCell(row, col.key) : (
                                  <span className="text-gray-700">{String(row[col.key] ?? '—')}</span>
                                )}
                              </td>
                            ))}
                          </tr>
                          {renderExpandRow && expandedRows.has(idx) && row.expand && (
                            <tr key={`exp-${idx}`}>
                              <td colSpan={columns.length + 1} className="bg-gray-50/50 p-0">
                                {renderExpandRow(row)}
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                  <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      Page {pagination.page} of {pagination.pages} ({fmtNumber(pagination.total)} rows)
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page <= 1}
                        className="p-1.5 rounded border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      {/* Page number buttons */}
                      {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                        let p;
                        if (pagination.pages <= 5) p = i + 1;
                        else if (page <= 3) p = i + 1;
                        else if (page >= pagination.pages - 2) p = pagination.pages - 4 + i;
                        else p = page - 2 + i;
                        return (
                          <button
                            key={p}
                            onClick={() => handlePageChange(p)}
                            className={`px-2.5 py-1 rounded border text-xs font-medium ${
                              p === page
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page >= pagination.pages}
                        className="p-1.5 rounded border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
