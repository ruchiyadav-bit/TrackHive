import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import {
  Activity, Server, Database, Globe, Radio, AlertTriangle, CheckCircle2,
  XCircle, RefreshCw, Link2, Clock, ChevronDown, ChevronRight, HardDrive,
  Cpu, Gauge, RotateCcw, Bug, ShieldCheck, Bell, Plus, Trash2, Send,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { isManager } from '../utils/roles';
import { useToast } from '../components/ui/Toast';
import { fmtDateTime } from '../utils/datetime';

/**
 * System Health.
 *
 * Answers "is the tracker working right now?" and "when did it stop?" without
 * opening a terminal.
 *
 * Sections load independently. The two that make real outbound requests — the
 * offer-URL probe and the live domain check — sit behind buttons and never
 * hold up the page.
 *
 * A section's colour is the worst level among its own checks; the banner is
 * the worst on the page. `down` is reserved for something that actually stops
 * tracking (database disconnected, a full disk, a dead offer URL), so a red
 * banner always means act now.
 */

const LEVEL_RANK = { ok: 0, warn: 1, down: 2 };

const LEVEL_STYLE = {
  ok: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', Icon: CheckCircle2, label: 'Healthy' },
  warn: { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', Icon: AlertTriangle, label: 'Needs attention' },
  down: { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', Icon: XCircle, label: 'Broken' },
};

/**
 * Chart series colours — categorical slots 1-3 of the validated palette.
 * Fixed order, never cycled: a filter that drops a series must not repaint the
 * ones that remain. Three is the cap for this palette on an all-pairs chart;
 * a fourth measure gets its own chart rather than a new hue.
 */
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'];

const worst = (issues = []) =>
  issues.reduce((acc, i) => (LEVEL_RANK[i.level] > LEVEL_RANK[acc] ? i.level : acc), 'ok');

/** "3 min ago" / "2h 15m ago" / "—". Minutes, because that is the unit here. */
function ago(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m ? `${h}h ${m}m ago` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h ago`;
}

function uptime(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

const num = v => (v === null || v === undefined ? '—' : Number(v).toLocaleString('en-US'));
const gb = v => (v === null || v === undefined ? '—' : `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 })} GB`);

/** Timezone-correct short label for a chart tick. */
function axisLabel(value, hours, tz) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const opts = hours <= 24
    ? { hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', hour: 'numeric' };
  try {
    return d.toLocaleString('en-US', tz ? { ...opts, timeZone: tz } : opts);
  } catch {
    return d.toLocaleString('en-US', opts);
  }
}

function Dot({ level }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${LEVEL_STYLE[level].dot}`} />;
}

function Section({ title, icon: Icon, level = 'ok', right, children, note }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-200 flex items-center gap-3">
        <Icon size={17} className="text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900 flex-1">{title}</h2>
        {right}
        <Dot level={level} />
      </div>
      {note && <p className="px-5 pt-3 text-xs text-gray-500">{note}</p>}
      <div className="p-5">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${tone || 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

/**
 * A percentage with a bar under it. Used for anything that has a ceiling —
 * CPU, memory, swap, disk — so they can be compared at a glance instead of
 * being read one number at a time.
 */
function Meter({ label, pct, caption, warnAt = 80, dangerAt = 92 }) {
  const value = Number(pct);
  const known = Number.isFinite(value);
  const tone = !known ? 'bg-gray-300'
    : value >= dangerAt ? 'bg-red-500'
      : value >= warnAt ? 'bg-amber-500'
        : 'bg-emerald-500';
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-gray-600 truncate mr-2">{label}</span>
        <span className="text-sm font-semibold text-gray-900 shrink-0">{known ? `${value}%` : '—'}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${tone} rounded-full transition-all`} style={{ width: `${known ? Math.min(100, value) : 0}%` }} />
      </div>
      {caption && <div className="text-xs text-gray-400 mt-1">{caption}</div>}
    </div>
  );
}

function Issues({ items }) {
  if (!items?.length) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700">
        <CheckCircle2 size={15} /> Nothing wrong here.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((i, idx) => {
        const s = LEVEL_STYLE[i.level] || LEVEL_STYLE.warn;
        return (
          <li key={idx} className={`flex gap-2.5 p-3 rounded-lg border ${s.bg} ${s.border}`}>
            <s.Icon size={15} className={`${s.text} mt-0.5 shrink-0`} />
            <div>
              <div className={`text-sm font-medium ${s.text}`}>{i.message}</div>
              {i.hint && <div className="text-xs text-gray-600 mt-0.5">{i.hint}</div>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Bar({ label, value, total, tone = 'bg-blue-500' }) {
  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span className="font-medium text-gray-900">{num(value)} · {pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${tone} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * The peak of one metric, with the minute it happened. This is the whole point
 * of keeping history — "CPU peaked at 87%" is trivia; "at 3:42 AM on the 21st"
 * is something you can go and look up in a log.
 */
function Peak({ label, peak, unit = '%', tz, tone }) {
  if (!peak || peak.value === null || peak.value === undefined) {
    return <Stat label={label} value="—" />;
  }
  return (
    <Stat
      label={label}
      value={`${Number(peak.value).toLocaleString('en-US', { maximumFractionDigits: 1 })}${unit}`}
      sub={peak.at ? fmtDateTime(peak.at, tz) : ''}
      tone={tone}
    />
  );
}

/** Shared tooltip: dark card, one row per series, value in ink not series colour. */
function ChartTip({ active, payload, label, hours, tz, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <div className="text-gray-500 mb-1.5">{axisLabel(label, hours, tz)}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-gray-600 flex-1">{p.name}</span>
          <span className="font-semibold text-gray-900">
            {Number(p.value ?? 0).toLocaleString('en-US', { maximumFractionDigits: 1 })}{unit}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * One time-series chart. Every series on a chart shares ONE axis and one unit —
 * a second y-scale would let any two lines be made to look however you like.
 * Measures of different units get their own chart.
 */
function TimeChart({ title, data, series, hours, tz, unit = '', domain, height = 190 }) {
  if (!data?.length) {
    return (
      <div>
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">{title}</h3>
        <div className="h-[190px] flex items-center justify-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
          No samples in this window yet
        </div>
      </div>
    );
  }
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#f1f1ef" vertical={false} />
          <XAxis
            dataKey="at"
            tickFormatter={v => axisLabel(v, hours, tz)}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            minTickGap={44}
          />
          <YAxis
            domain={domain || ['auto', 'auto']}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip content={<ChartTip hours={hours} tz={tz} unit={unit} />} />
          {series.length > 1 && (
            <Legend
              verticalAlign="top"
              align="left"
              height={24}
              iconType="plainline"
              wrapperStyle={{ fontSize: 12, color: '#4b5563', paddingLeft: 32 }}
            />
          )}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={SERIES[i % SERIES.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * The last 60 checks, oldest on the left. A strip rather than a number
 * because "99.1% uptime" hides whether that missing 0.9% was one bad hour or
 * a flap every twenty minutes, and those call for different responses.
 */
function StatusStrip({ checks, tz }) {
  if (!checks?.length) {
    return <div className="text-xs text-gray-400">No checks recorded yet</div>;
  }
  return (
    <div className="flex items-end gap-[2px] h-6" role="img" aria-label={`Last ${checks.length} checks`}>
      {checks.map((c, i) => (
        <div
          key={i}
          title={`${fmtDateTime(c.at, tz)} — ${c.ok ? `OK ${c.status} · ${c.ms} ms` : 'FAILED'}`}
          className={`flex-1 min-w-[3px] rounded-sm ${c.ok ? 'bg-emerald-500' : 'bg-red-500'}`}
          style={{ height: c.ok ? '100%' : '100%' }}
        />
      ))}
    </div>
  );
}

const RANGES = [
  { hours: 6, label: '6h' },
  { hours: 24, label: '24h' },
  { hours: 72, label: '3d' },
  { hours: 168, label: '7d' },
  { hours: 336, label: '14d' },
];

const th = 'px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide';
const td = 'px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap';

export default function SystemHealth() {
  const { user } = useAuth();
  const manager = isManager(user);
  const toast = useToast();

  const [server, setServer] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [data, setData] = useState(null);
  const [errors, setErrors] = useState({ rows: [], total: 0 });
  const [urls, setUrls] = useState(null);
  const [history, setHistory] = useState(null);
  const [serverErrors, setServerErrors] = useState([]);
  const [domainChecks, setDomainChecks] = useState(null);
  // Named `monitors`, not `uptime` — there is already an uptime() formatter at
  // module scope and a state variable of that name would silently shadow it.
  const [monitors, setMonitors] = useState(null);
  const [uptimeBusy, setUptimeBusy] = useState(false);
  const [showAddMonitor, setShowAddMonitor] = useState(false);
  const [monitorForm, setMonitorForm] = useState({ label: '', url: '', expectBody: '', intervalSec: 300 });

  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [probing, setProbing] = useState(false);
  const [checkingDomains, setCheckingDomains] = useState(false);
  const [auto, setAuto] = useState(false);
  const [checkedAt, setCheckedAt] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const [showServerErrors, setShowServerErrors] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async (quiet) => {
    if (!quiet) setLoading(true);
    const calls = [
      api.get('/system-health/tracking').then(r => setTracking(r.data)).catch(() => setTracking(null)),
      api.get('/system-health/data').then(r => setData(r.data)).catch(() => setData(null)),
      api.get('/system-health/postback-errors', { params: { limit: 50 } })
        .then(r => setErrors(r.data)).catch(() => setErrors({ rows: [], total: 0 })),
    ];
    if (manager) {
      calls.push(
        api.get('/system-health/server').then(r => setServer(r.data)).catch(() => setServer(null)),
        api.get('/system-health/errors').then(r => setServerErrors(r.data.errors || [])).catch(() => setServerErrors([])),
        api.get('/system-health/uptime').then(r => setMonitors(r.data)).catch(() => setMonitors(null)),
      );
    }
    await Promise.all(calls);
    setCheckedAt(new Date());
    setLoading(false);
  }, [manager]);

  const loadHistory = useCallback(async (h) => {
    if (!manager) return;
    setHistoryLoading(true);
    try {
      const { data } = await api.get('/system-health/history', { params: { hours: h } });
      setHistory(data);
    } catch {
      setHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }, [manager]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadHistory(hours); }, [loadHistory, hours]);

  // Auto-refresh is off by default. This page is a diagnostic, not a monitor —
  // polling its aggregations every minute all day costs more than it tells you.
  useEffect(() => {
    if (!auto) return undefined;
    const t = setInterval(() => { load(true); loadHistory(hours); }, 60000);
    return () => clearInterval(t);
  }, [auto, load, loadHistory, hours]);

  const checkUrls = async () => {
    setProbing(true);
    try {
      const res = await api.get('/system-health/offer-urls');
      setUrls(res.data);
      if (!res.data.checked) toast.success('No active offers with a landing page URL to check');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not check offer URLs');
    } finally {
      setProbing(false);
    }
  };

  const checkDomains = async () => {
    setCheckingDomains(true);
    try {
      const res = await api.get('/system-health/domain-checks');
      setDomainChecks(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not check domains');
    } finally {
      setCheckingDomains(false);
    }
  };

  const reloadMonitors = useCallback(async () => {
    try {
      const { data } = await api.get('/system-health/uptime');
      setMonitors(data);
    } catch { /* the section renders its own empty state */ }
  }, []);

  const checkMonitorsNow = async () => {
    setUptimeBusy(true);
    try {
      await api.post('/system-health/uptime/check');
      await reloadMonitors();
      toast.success('All monitors checked');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not run the checks');
    } finally {
      setUptimeBusy(false);
    }
  };

  const saveMonitor = async (e) => {
    e.preventDefault();
    setUptimeBusy(true);
    try {
      await api.post('/system-health/uptime', monitorForm);
      setMonitorForm({ label: '', url: '', expectBody: '', intervalSec: 300 });
      setShowAddMonitor(false);
      await reloadMonitors();
      toast.success('Monitor added and checked');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not add the monitor');
    } finally {
      setUptimeBusy(false);
    }
  };

  const toggleMonitor = async (m) => {
    try {
      await api.put(`/system-health/uptime/${m.id}`, { enabled: !m.enabled });
      await reloadMonitors();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update the monitor');
    }
  };

  const removeMonitor = async (m) => {
    if (!window.confirm(`Stop monitoring ${m.label}? Its check history is deleted too.`)) return;
    try {
      await api.delete(`/system-health/uptime/${m.id}`);
      await reloadMonitors();
      toast.success('Monitor removed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not remove the monitor');
    }
  };

  const levels = useMemo(() => ({
    server: worst(server?.issues),
    uptime: worst(monitors?.issues),
    tracking: worst(tracking?.issues),
    data: worst(data?.issues),
    urls: worst(urls?.issues),
    domains: worst(domainChecks?.issues),
  }), [server, tracking, data, urls, domainChecks, monitors]);

  const allIssues = useMemo(() => [
    ...(monitors?.issues || []), ...(server?.issues || []), ...(tracking?.issues || []),
    ...(data?.issues || []), ...(urls?.issues || []), ...(domainChecks?.issues || []),
  ].sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]), [server, tracking, data, urls, domainChecks, monitors]);

  const overall = worst(allIssues);
  const tz = tracking?.timezone || data?.timezone || server?.server?.reportTimezone;
  const S = LEVEL_STYLE[overall];
  const live = server?.live;
  const points = history?.points || [];
  const peaks = history?.summary?.peaks;

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">System Health</h1>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-40" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Checked {checkedAt ? fmtDateTime(checkedAt, tz) : '—'}{tz ? ` · ${tz}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer">
            <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} className="rounded" />
            Auto-refresh
          </label>
          <button
            onClick={() => { load(); loadHistory(hours); }}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Overall banner */}
      <div className={`rounded-xl border p-5 ${S.bg} ${S.border}`}>
        <div className="flex items-start gap-3">
          <S.Icon size={22} className={S.text} />
          <div className="flex-1">
            <div className={`text-base font-semibold ${S.text}`}>{S.label}</div>
            <div className="text-sm text-gray-600 mt-0.5">
              {allIssues.length
                ? `${allIssues.length} thing${allIssues.length > 1 ? 's' : ''} to look at.`
                : 'Every check passed.'}
            </div>
            {allIssues.length > 0 && <div className="mt-3"><Issues items={allIssues} /></div>}
          </div>
        </div>
      </div>

      {/* ── Uptime monitors ──────────────────────────────────────── */}
      {manager && (
        <Section
          title="Uptime monitors"
          icon={Bell}
          level={levels.uptime}
          note="Checked from this server every few minutes; a Telegram message goes out when a monitor changes state, not on every failed check. This cannot tell you the server itself is gone — for that, keep an external monitor pointed at the same URLs."
          right={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddMonitor(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus size={13} /> Add
              </button>
              <button
                onClick={checkMonitorsNow}
                disabled={uptimeBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw size={13} className={uptimeBusy ? 'animate-spin' : ''} />
                {uptimeBusy ? 'Checking…' : 'Check now'}
              </button>
            </div>
          }
        >
          {!monitors ? (
            <p className="text-sm text-gray-500">Could not load the monitors.</p>
          ) : (
            <>
              {/* Where the alerts go */}
              <div className={`flex items-start gap-2.5 p-3 rounded-lg border mb-5 ${
                monitors.telegram.enabled && monitors.telegram.configured
                  ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
              }`}>
                <Send size={15} className={monitors.telegram.enabled && monitors.telegram.configured ? 'text-emerald-700 mt-0.5' : 'text-amber-700 mt-0.5'} />
                <div className="text-sm">
                  {monitors.telegram.enabled && monitors.telegram.configured ? (
                    <span className="text-emerald-800 font-medium">Telegram alerts are on — down, recovery and SSL-expiry messages will be delivered.</span>
                  ) : !monitors.telegram.configured ? (
                    <span className="text-amber-800">
                      <span className="font-medium">Telegram is not configured.</span>{' '}
                      Monitors are running but nobody is being told. Add the bot token and chat id in Settings → Telegram.
                    </span>
                  ) : (
                    <span className="text-amber-800">
                      <span className="font-medium">Telegram alerts are switched off.</span>{' '}
                      Turn them on in Settings → Telegram, or no message will be sent.
                    </span>
                  )}
                </div>
              </div>

              {/* Add form */}
              {showAddMonitor && (
                <form onSubmit={saveMonitor} className="border border-gray-200 rounded-lg p-4 mb-5 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                      <input
                        value={monitorForm.label}
                        onChange={e => setMonitorForm(f => ({ ...f, label: e.target.value }))}
                        placeholder="Tracking domain"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">URL to check</label>
                      <input
                        value={monitorForm.url}
                        onChange={e => setMonitorForm(f => ({ ...f, url: e.target.value }))}
                        placeholder="https://track.example.com/api/health"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Every (seconds)</label>
                      <input
                        type="number" min={60} step={60}
                        value={monitorForm.intervalSec}
                        onChange={e => setMonitorForm(f => ({ ...f, intervalSec: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Response must contain <span className="font-normal text-gray-400">(optional, but this is the check that matters)</span>
                    </label>
                    <input
                      value={monitorForm.expectBody}
                      onChange={e => setMonitorForm(f => ({ ...f, expectBody: e.target.value }))}
                      placeholder={'"status":"ok"'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Without it, a domain that has been pointed at somebody else&apos;s server still answers 200 and looks perfectly healthy.
                    </p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button type="submit" disabled={uptimeBusy} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                      Add and check
                    </button>
                    <button type="button" onClick={() => setShowAddMonitor(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-white">
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* The monitors */}
              {!monitors.monitors.length ? (
                <p className="text-sm text-gray-500">No monitor yet. Add one above.</p>
              ) : (
                <div className="space-y-4">
                  {monitors.monitors.map(m => (
                    <div key={m.id} className={`border rounded-lg p-4 ${m.enabled ? 'border-gray-200' : 'border-gray-200 bg-gray-50 opacity-70'}`}>
                      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              !m.enabled ? 'bg-gray-200 text-gray-600'
                                : m.up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                            }`}>
                              {!m.enabled ? 'PAUSED' : m.up ? 'UP' : 'DOWN'}
                            </span>
                            <span className="font-medium text-gray-900">{m.label}</span>
                            <span className="text-xs text-gray-400">
                              {m.up ? 'up' : 'down'} for {ago(m.sinceMinutes)?.replace(' ago', '') || '—'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 font-mono mt-1 truncate" title={m.url}>{m.url}</div>
                          {!m.up && m.lastError && (
                            <div className="text-xs text-red-600 mt-1">{m.lastError}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => toggleMonitor(m)}
                            className="px-2.5 py-1 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                          >
                            {m.enabled ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            onClick={() => removeMonitor(m)}
                            className="p-1.5 border border-gray-300 rounded-lg text-gray-400 hover:text-red-600 hover:border-red-200"
                            title="Remove monitor"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-3">
                        <Stat label="Uptime · 24h" value={m.uptime24h === null ? '—' : `${m.uptime24h}%`} sub={`${num(m.checks24h)} checks`} tone={m.uptime24h !== null && m.uptime24h < 99 ? 'text-amber-600' : undefined} />
                        <Stat label="Uptime · 7d" value={m.uptime7d === null ? '—' : `${m.uptime7d}%`} />
                        <Stat label="Response" value={m.lastMs ? `${num(m.lastMs)} ms` : '—'} sub={m.avgMs24h ? `${num(m.avgMs24h)} ms avg` : ''} />
                        <Stat
                          label="SSL expires"
                          value={m.certDaysLeft === null ? '—' : `${m.certDaysLeft} days`}
                          sub={m.certValidTo ? new Date(m.certValidTo).toISOString().slice(0, 10) : ''}
                          tone={m.certDaysLeft !== null && m.certDaysLeft <= 14 ? 'text-red-600' : undefined}
                        />
                        <Stat label="Last check" value={ago(m.minutesSinceCheck)} sub={`every ${Math.round(m.intervalSec / 60)} min`} />
                      </div>

                      <StatusStrip checks={m.recent} tz={tz} />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>oldest</span>
                        <span>alerts after {m.failureThreshold} failed checks in a row</span>
                        <span>now</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Section>
      )}

      {/* ── Tracking ─────────────────────────────────────────────── */}
      <Section
        title="Tracking"
        icon={Radio}
        level={levels.tracking}
        note="When the last click and the last conversion actually arrived. Everything else on this page follows from these two numbers."
      >
        {!tracking ? (
          <p className="text-sm text-gray-500">Could not load tracking health.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
              <Stat
                label="Last click"
                value={ago(tracking.clicks.minutesSinceLast)}
                sub={tracking.clicks.lastOfferName || (tracking.clicks.lastAt ? '' : 'No clicks yet')}
                tone={tracking.clicks.minutesSinceLast > 720 ? 'text-red-600' : undefined}
              />
              <Stat
                label="Last conversion"
                value={ago(tracking.conversions.minutesSinceLast)}
                sub={tracking.conversions.lastOfferName || (tracking.conversions.lastAt ? '' : 'None recorded')}
                tone={tracking.conversions.minutesSinceLast > 1440 ? 'text-amber-600' : undefined}
              />
              <Stat label="Clicks · last hour" value={num(tracking.clicks.last1h)} sub={`${num(tracking.clicks.last24h)} in 24h`} />
              <Stat label="Conversions · 24h" value={num(tracking.conversions.last24h)} sub={`${num(tracking.clicks.blocked24h)} clicks blocked`} />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Postbacks · last 24 hours</h3>
              {tracking.postback24h.total === 0 ? (
                <p className="text-sm text-gray-500">No postback reached the server in the last 24 hours.</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <Bar label="Accepted" value={tracking.postback24h.accepted} total={tracking.postback24h.total} tone="bg-emerald-500" />
                    <Bar label="Rejected" value={tracking.postback24h.rejected} total={tracking.postback24h.total} tone="bg-red-500" />
                  </div>
                  <div>
                    {tracking.postback24h.reasons.length === 0 ? (
                      <p className="text-sm text-emerald-700">Nothing was rejected.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {tracking.postback24h.reasons.map(r => (
                          <li key={r.reason} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{r.label}</span>
                            <span className="font-semibold text-gray-900 ml-4">{num(r.count)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            {tracking.networks.length > 0 && (
              <div className="border-t border-gray-100 pt-4 mt-4 overflow-x-auto">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">By network</h3>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={th}>Network</th><th className={th}>Offers</th>
                      <th className={th}>Clicks 24h</th><th className={th}>Conv 24h</th>
                      <th className={th}>Last conversion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tracking.networks.map(n => (
                      <tr key={n.network}>
                        <td className={`${td} font-medium capitalize`}>{n.network}</td>
                        <td className={td}>{n.activeOffers}/{n.offers} active</td>
                        <td className={td}>{num(n.clicks24h)}</td>
                        <td className={td}>{num(n.conversions24h)}</td>
                        <td className={td}>
                          {n.lastConversionAt ? fmtDateTime(n.lastConversionAt, tz) : <span className="text-gray-400">never</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Section>

      {/* ── Tracking domains ─────────────────────────────────────── */}
      <Section
        title="Tracking domains"
        icon={Globe}
        level={domainChecks ? levels.domains : levels.tracking}
        note="The stored columns are only as fresh as the last time someone pressed Verify. The live check below re-tests DNS, HTTPS, the certificate's expiry date and whether the domain really answers from THIS process."
        right={manager && (
          <button
            onClick={checkDomains}
            disabled={checkingDomains}
            className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <ShieldCheck size={13} className={checkingDomains ? 'animate-pulse' : ''} />
            {checkingDomains ? 'Checking…' : 'Live check'}
          </button>
        )}
      >
        {!tracking?.domains?.length ? (
          <p className="text-sm text-gray-500">No tracking domain has been added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>Domain</th><th className={th}>Status</th>
                  <th className={th}>HTTPS</th><th className={th}>Reaches this server</th>
                  <th className={th}>SSL expires</th><th className={th}>Offers</th>
                  <th className={th}>Last click</th><th className={th}>Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tracking.domains.map(d => {
                  // A live result, when one has been run, always wins over the
                  // stored flags — those are only as fresh as the last Verify.
                  const check = domainChecks?.results?.find(r => r.domain === d.domain);
                  const https = check ? check.httpsOk : d.sslActive;
                  const here = check ? check.pointsHere : d.pointsHere;
                  return (
                    <tr key={d.id}>
                      <td className={`${td} font-medium text-gray-900`}>{d.domain}</td>
                      <td className={td}>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          d.status === 'verified' ? 'bg-emerald-50 text-emerald-700'
                            : d.status === 'failed' ? 'bg-red-50 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}>{d.status}</span>
                      </td>
                      <td className={td}>{https ? <CheckCircle2 size={15} className="text-emerald-600" /> : <XCircle size={15} className="text-red-500" />}</td>
                      <td className={td}>
                        {here
                          ? <CheckCircle2 size={15} className="text-emerald-600" />
                          : <span className="flex items-center gap-1.5">
                            <XCircle size={15} className="text-red-500" />
                            {!check && <span className="text-xs text-gray-400">stored, not checked live</span>}
                          </span>}
                      </td>
                      <td className={td}>
                        {check?.certDaysLeft === null || check?.certDaysLeft === undefined
                          ? <span className="text-gray-400">—</span>
                          : <span className={check.certDaysLeft <= 14 ? 'text-red-600 font-medium' : ''}>
                            {check.certDaysLeft} days
                          </span>}
                      </td>
                      <td className={td}>{d.activeOffers}/{d.offers}</td>
                      <td className={td}>{d.lastClickAt ? fmtDateTime(d.lastClickAt, tz) : <span className="text-gray-400">—</span>}</td>
                      <td className={td}>
                        {d.verifiedAt
                          ? <span className={d.daysSinceVerified > 30 ? 'text-amber-600' : ''}>{d.daysSinceVerified}d ago</span>
                          : <span className="text-gray-400">never</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {domainChecks && (
              <p className="text-xs text-gray-400 mt-3">
                Live check run {fmtDateTime(domainChecks.checkedAt, tz)}
              </p>
            )}
          </div>
        )}
      </Section>

      {/* ── Data ─────────────────────────────────────────────────── */}
      <Section
        title="Data"
        icon={Activity}
        level={levels.data}
        note="Today is compared with the same slice of yesterday — not with the whole of yesterday, which would report a drop every morning."
      >
        {!data ? (
          <p className="text-sm text-gray-500">Could not load data health.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
              <Stat
                label="Clicks today"
                value={num(data.today.clicks)}
                sub={`${data.change.clicksPct >= 0 ? '+' : ''}${data.change.clicksPct}% vs yesterday`}
                tone={data.change.clicksPct <= -50 ? 'text-red-600' : undefined}
              />
              <Stat
                label="Conversions today"
                value={num(data.today.conversions)}
                sub={`${data.change.conversionsPct >= 0 ? '+' : ''}${data.change.conversionsPct}% vs yesterday`}
                tone={data.change.conversionsPct <= -60 ? 'text-amber-600' : undefined}
              />
              <Stat label="CVR today" value={`${data.today.cvr}%`} sub={`${num(data.yesterdaySameTime.conversions)} conv. by now yesterday`} />
              <Stat
                label="Blocked today"
                value={`${data.today.blockedPct}%`}
                sub={`${num(data.today.blocked)} of ${num(data.today.clicks)} clicks`}
                tone={data.today.blockedPct > 50 ? 'text-amber-600' : undefined}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border-t border-gray-100 pt-4">
              <div>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Traffic but no conversions · 7 days</h3>
                {!data.zeroConversionOffers.length ? (
                  <p className="text-sm text-emerald-700">Every offer with real traffic converted at least once.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.zeroConversionOffers.map(o => (
                      <li key={o.offerId} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 truncate mr-3">{o.name}</span>
                        <span className="text-gray-500 shrink-0">{num(o.clicks)} clicks · 0 conv</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Orphan conversions · 7 days</h3>
                {!data.orphanConversions.count7d ? (
                  <p className="text-sm text-emerald-700">Every postback matched a click we recorded.</p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-2">
                      {num(data.orphanConversions.count7d)} postback(s) carried a click id with no matching click.
                    </p>
                    <ul className="space-y-1">
                      {data.orphanConversions.recent.map((o, i) => (
                        <li key={i} className="text-xs font-mono text-gray-500 truncate">
                          {o.clickId || '(no click id)'} · {fmtDateTime(o.at, tz)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </Section>

      {/* ── Offer URLs ───────────────────────────────────────────── */}
      <Section
        title="Offer URLs"
        icon={Link2}
        level={levels.urls}
        note="Makes one real request per active offer, so it runs on demand rather than on every page load. Redirects count as alive — an affiliate landing page answering 302 is normal."
        right={
          <button
            onClick={checkUrls}
            disabled={probing}
            className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={probing ? 'animate-spin' : ''} />
            {probing ? 'Checking…' : 'Check now'}
          </button>
        }
      >
        {!urls ? (
          <p className="text-sm text-gray-500">Not checked yet.</p>
        ) : !urls.checked ? (
          <p className="text-sm text-gray-500">No active offer has a landing page URL.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr><th className={th}>Offer</th><th className={th}>Status</th><th className={th}>Time</th><th className={th}>URL</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {urls.results.map(r => (
                  <tr key={r.offerId}>
                    <td className={`${td} font-medium text-gray-900`}>{r.name}</td>
                    <td className={td}>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {r.status ? `HTTP ${r.status}` : (r.error || 'failed')}
                      </span>
                    </td>
                    <td className={`${td} ${r.ms > 3000 ? 'text-amber-600' : ''}`}>{num(r.ms)} ms</td>
                    <td className={`${td} text-gray-500 max-w-md truncate`} title={r.url}>{r.url}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Server, live ─────────────────────────────────────────── */}
      {manager && (
        <Section
          title="Server · right now"
          icon={Server}
          level={levels.server}
          note="Measured at the moment this page loaded. CPU here is real utilisation over a 250 ms sample, not the load average — the two answer different questions and both are shown."
        >
          {!server ? (
            <p className="text-sm text-gray-500">Could not load server health.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                <Meter
                  label={`CPU · ${live?.cpu?.cores ?? '?'} cores`}
                  pct={live?.cpu?.usedPct}
                  caption={live?.cpu?.loadSupported
                    ? `load ${live.cpu.loadAvg.join(' / ')} · app ${live.cpu.processPct}%`
                    : `app ${live?.cpu?.processPct ?? '—'}% · load average not reported`}
                  warnAt={80} dangerAt={92}
                />
                <Meter
                  label="Memory"
                  pct={live?.memory?.usedPct}
                  caption={`${num(live?.memory?.usedMB)} of ${num(live?.memory?.totalMB)} MB · ${num(live?.memory?.freeMB)} MB free`}
                  warnAt={85} dangerAt={94}
                />
                <Meter
                  label="Swap"
                  pct={live?.memory?.swapTotalMB
                    ? Math.round((live.memory.swapUsedMB / live.memory.swapTotalMB) * 100)
                    : null}
                  caption={live?.memory?.swapTotalMB
                    ? `${num(live.memory.swapUsedMB)} of ${num(live.memory.swapTotalMB)} MB`
                    : 'No swap configured'}
                  warnAt={25} dangerAt={60}
                />
                <Meter
                  label="This app (RSS)"
                  pct={live?.memory?.rssMB ? Math.round((live.memory.rssMB / 500) * 100) : null}
                  caption={`${num(live?.memory?.rssMB)} MB of the 500 MB PM2 restart limit`}
                  warnAt={80} dangerAt={95}
                />
              </div>

              {/* Per-core */}
              {live?.cpu?.perCore?.length > 0 && (
                <div className="border-t border-gray-100 pt-4 mb-5">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Cpu size={13} /> Per core
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                    {live.cpu.perCore.map((p, i) => (
                      <Meter key={i} label={`Core ${i}`} pct={p} warnAt={85} dangerAt={95} />
                    ))}
                  </div>
                  {live.cpu.model && (
                    <p className="text-xs text-gray-400 mt-3">
                      {live.cpu.model}{live.cpu.speedMHz ? ` · ${live.cpu.speedMHz} MHz` : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Disks */}
              <div className="border-t border-gray-100 pt-4 mb-5">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <HardDrive size={13} /> Disks
                </h3>
                {!live?.disks?.length ? (
                  <p className="text-sm text-gray-500">Disk usage could not be read on this platform.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {live.disks.map(d => (
                      <Meter
                        key={d.mount}
                        label={`${d.mount}${live.appDisk && d.mount === live.appDisk.mount ? '  (app)' : ''}`}
                        pct={d.usedPct}
                        caption={`${gb(d.usedGB)} used · ${gb(d.freeGB)} free of ${gb(d.totalGB)} · ${d.filesystem}`}
                        warnAt={85} dangerAt={95}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Node itself */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Gauge size={13} /> Node process
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
                  <Stat label="Uptime" value={uptime(server.server.uptimeSec)} sub={`since ${fmtDateTime(server.server.startedAt, tz)}`} />
                  <Stat
                    label="Event loop delay"
                    value={live?.eventLoop?.meanMs !== null && live?.eventLoop?.meanMs !== undefined ? `${live.eventLoop.meanMs} ms` : '—'}
                    sub={live?.eventLoop?.maxMs !== null && live?.eventLoop?.maxMs !== undefined ? `peak ${live.eventLoop.maxMs} ms` : ''}
                    tone={live?.eventLoop?.meanMs > 100 ? 'text-amber-600' : undefined}
                  />
                  <Stat label="Heap" value={`${num(live?.memory?.heapUsedMB)} MB`} sub={`of ${num(live?.memory?.heapTotalMB)} MB allocated`} />
                  <Stat
                    label="Requests · last hour"
                    value={server.http1h ? num(server.http1h.requests) : '—'}
                    sub={server.http1h ? `${server.http1h.avgMs} ms avg · ${num(server.http1h.errors5xx)} server errors` : 'No samples yet'}
                    tone={server.http1h?.errors5xx > 0 ? 'text-amber-600' : undefined}
                  />
                </div>
                <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-3 text-sm">
                  {[
                    ['Host', live?.host?.hostname],
                    ['OS', live?.host?.osType],
                    ['Machine uptime', uptime(live?.host?.osUptimeSec)],
                    ['Node', server.server.node],
                    ['Environment', server.server.env],
                    ['Port', server.server.port],
                    ['Instance id', server.server.instanceId],
                    ['Report timezone', server.server.reportTimezone],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-gray-500">{k}</dt>
                      <dd className="text-gray-900 font-medium truncate" title={String(v ?? '—')}>{String(v ?? '—')}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </>
          )}
        </Section>
      )}

      {/* ── History ──────────────────────────────────────────────── */}
      {manager && (
        <Section
          title="History"
          icon={Activity}
          level="ok"
          note={`One sample a minute, kept for 14 days. A live reading says whether the CPU is busy now; only this says when it was pinned${history?.bucketMinutes > 1 ? ` — points are ${history.bucketMinutes}-minute averages` : ''}.`}
          right={
            <div className="flex items-center gap-1">
              {RANGES.map(r => (
                <button
                  key={r.hours}
                  onClick={() => setHours(r.hours)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    hours === r.hours ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          }
        >
          {historyLoading && !points.length ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">Loading…</div>
          ) : !points.length ? (
            <div className="text-sm text-gray-500">
              No samples recorded yet. The sampler starts with the server and writes one row a minute —
              give it a few minutes after a restart, then come back.
            </div>
          ) : (
            <>
              {/* Peaks — the reason the history exists */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                <Peak label="CPU peak" peak={peaks?.cpu} tz={tz} tone={peaks?.cpu?.value >= 90 ? 'text-red-600' : undefined} />
                <Peak label="Memory peak" peak={peaks?.memory} tz={tz} tone={peaks?.memory?.value >= 92 ? 'text-red-600' : undefined} />
                <Peak label="Disk peak" peak={peaks?.disk} tz={tz} tone={peaks?.disk?.value >= 90 ? 'text-red-600' : undefined} />
                <Peak label="Event loop peak" peak={peaks?.eventLoop} unit=" ms" tz={tz} tone={peaks?.eventLoop?.value > 200 ? 'text-amber-600' : undefined} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-7">
                <TimeChart
                  title="Utilisation %"
                  data={points}
                  hours={hours}
                  tz={tz}
                  unit="%"
                  domain={[0, 100]}
                  series={[
                    { key: 'cpu', label: 'CPU' },
                    { key: 'mem', label: 'Memory' },
                    { key: 'disk', label: 'Disk' },
                  ]}
                />
                <TimeChart
                  title="Traffic per bucket"
                  data={points}
                  hours={hours}
                  tz={tz}
                  series={[
                    { key: 'req', label: 'HTTP requests' },
                    { key: 'clicks', label: 'Clicks' },
                  ]}
                />
                <TimeChart
                  title="Latency (ms)"
                  data={points}
                  hours={hours}
                  tz={tz}
                  unit=" ms"
                  series={[
                    { key: 'respMs', label: 'Avg response' },
                    { key: 'loopLag', label: 'Event loop delay' },
                  ]}
                />
                <TimeChart
                  title="Process memory (MB)"
                  data={points}
                  hours={hours}
                  tz={tz}
                  unit=" MB"
                  series={[
                    { key: 'rssMB', label: 'RSS' },
                    { key: 'heapMB', label: 'Heap' },
                  ]}
                />
              </div>

              {/* Table view — the relief for the contrast warning on one series
                  colour, and the honest answer to "what exactly was the number". */}
              {history.summary && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-6 pt-4 border-t border-gray-100">
                  <Stat label="Average CPU" value={`${history.summary.avgCpu}%`} sub={`over ${num(history.summary.samples)} samples`} />
                  <Stat label="Average memory" value={`${history.summary.avgMem}%`} />
                  <Stat
                    label="Total requests"
                    value={num(history.summary.totalRequests)}
                    sub={`${num(history.summary.total5xx)} server errors`}
                    tone={history.summary.total5xx > 0 ? 'text-amber-600' : undefined}
                  />
                  <Stat label="Clicks · conversions" value={`${num(history.summary.totalClicks)} · ${num(history.summary.totalConversions)}`} />
                </div>
              )}
            </>
          )}
        </Section>
      )}

      {/* ── Database ─────────────────────────────────────────────── */}
      {manager && server && (
        <Section title="Database" icon={Database} level={server.database.state === 'connected' ? levels.server : 'down'}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <Stat
              label="Connection"
              value={server.database.state}
              sub={server.database.pingMs !== null ? `ping ${server.database.pingMs} ms` : ''}
              tone={server.database.state === 'connected' ? 'text-emerald-700' : 'text-red-600'}
            />
            <Stat label="Database" value={server.database.name || '—'} sub={server.database.host} />
            <Stat
              label="Data size"
              value={server.database.dataSizeMB !== null ? `${num(server.database.dataSizeMB)} MB` : '—'}
              sub={server.database.indexSizeMB !== null ? `${num(server.database.indexSizeMB)} MB indexes` : ''}
            />
            <Stat label="Collections" value={server.database.collections ?? '—'} />
          </div>

          <dl className="grid grid-cols-2 lg:grid-cols-5 gap-5 mt-5 pt-4 border-t border-gray-100">
            {[
              ['Clicks', server.database.counts.clicks],
              ['Conversions', server.database.counts.conversions],
              ['Offers', server.database.counts.offers],
              ['Advertisers', server.database.counts.advertisers],
              ['Postback log', server.database.counts.postbackLogs],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-gray-500">{k}</dt>
                <dd className="text-lg font-semibold text-gray-900">{num(v)}</dd>
              </div>
            ))}
          </dl>

          {server.database.mongo && (
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-5 pt-4 border-t border-gray-100 text-sm">
              {[
                ['MongoDB version', server.database.mongo.version],
                ['MongoDB uptime', uptime(server.database.mongo.uptimeSec)],
                ['Open connections', `${num(server.database.mongo.connectionsCurrent)} of ${num(server.database.mongo.connectionsAvailable)} available`],
                ['Resident memory', server.database.mongo.residentMB !== null ? `${num(server.database.mongo.residentMB)} MB` : '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-gray-500">{k}</dt>
                  <dd className="text-gray-900 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </Section>
      )}

      {/* ── Restarts ─────────────────────────────────────────────── */}
      {manager && server && (
        <Section
          title="Restarts"
          icon={RotateCcw}
          level={server.restarts.last7d >= 5 ? 'warn' : 'ok'}
          note="Counted from the sampler's own boot marker — PM2 does not tell the process it restarted. Two or three a week are deploys; ten is a crash loop."
        >
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-2xl font-bold text-gray-900">{server.restarts.last7d}</span>
            <span className="text-sm text-gray-500">in the last 7 days</span>
          </div>
          {!server.restarts.recent.length ? (
            <p className="text-sm text-gray-500">No restart recorded yet.</p>
          ) : (
            <ul className="space-y-1">
              {server.restarts.recent.map((r, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  {fmtDateTime(r.at, tz)}
                  <span className="text-xs text-gray-400 font-mono">{r.instance?.slice(0, 8)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-400 mt-4">
            Sampling every {server.metrics.intervalSec}s · {num(server.metrics.samples24h)} samples in 24h ·
            {' '}kept {server.metrics.retentionDays} days ·
            {' '}{server.metrics.sampling ? 'running' : 'NOT running'}
          </p>
        </Section>
      )}

      {/* ── Server errors ────────────────────────────────────────── */}
      {manager && (
        <Section
          title="Recent errors"
          icon={Bug}
          level={serverErrors.length ? 'warn' : 'ok'}
          note="The last 50 errors this process handled, newest first. Held in memory, so they are gone after a restart — the PM2 log is the permanent record."
          right={serverErrors.length > 0 && (
            <button
              onClick={() => setShowServerErrors(v => !v)}
              className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              {showServerErrors ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {showServerErrors ? 'Hide' : `Show ${serverErrors.length}`}
            </button>
          )}
        >
          {!serverErrors.length ? (
            <p className="text-sm text-emerald-700">No error since the last restart.</p>
          ) : !showServerErrors ? (
            <p className="text-sm text-gray-600">{serverErrors.length} error(s) since the last restart.</p>
          ) : (
            <ul className="space-y-2">
              {serverErrors.map((e, i) => (
                <li key={i} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">{e.name}</span>
                    {e.fatal && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">uncaught</span>}
                    <span className="text-xs text-gray-500">{fmtDateTime(e.at, tz)}</span>
                    {e.path && <span className="text-xs text-gray-500 font-mono">{e.method} {e.path}</span>}
                  </div>
                  <div className="text-sm text-gray-800">{e.message}</div>
                  {e.stack && (
                    <pre className="text-xs text-gray-500 mt-2 overflow-x-auto whitespace-pre-wrap">{e.stack}</pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* ── Rejected postbacks ───────────────────────────────────── */}
      <Section
        title="Rejected postbacks"
        icon={AlertTriangle}
        level={errors.rows.length ? 'warn' : 'ok'}
        note="Last 7 days. Every refused postback is a conversion that did not book — the reason column says why. Secrets are masked."
        right={
          <button
            onClick={() => setShowErrors(v => !v)}
            className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            {showErrors ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {showErrors ? 'Hide' : `Show ${num(errors.total)}`}
          </button>
        }
      >
        {!errors.rows.length ? (
          <p className="text-sm text-emerald-700">No postback was rejected in the last 7 days.</p>
        ) : !showErrors ? (
          <p className="text-sm text-gray-600">
            {num(errors.total)} rejected postback{errors.total === 1 ? '' : 's'} in the last 7 days.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>When</th><th className={th}>Reason</th><th className={th}>Offer</th>
                  <th className={th}>Network</th><th className={th}>Click id</th><th className={th} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {errors.rows.map(r => (
                  <Fragment key={r.id}>
                    <tr>
                      <td className={td}>{fmtDateTime(r.at, tz)}</td>
                      <td className={td}>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">{r.label}</span>
                      </td>
                      <td className={`${td} max-w-xs truncate`}>{r.offerName || '—'}</td>
                      <td className={`${td} capitalize`}>{r.network || '—'}</td>
                      <td className={`${td} font-mono text-xs max-w-[14rem] truncate`} title={r.clickId}>{r.clickId || '—'}</td>
                      <td className={td}>
                        <button
                          onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {expanded === r.id ? 'Hide' : 'Params'}
                        </button>
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr>
                        <td colSpan={6} className="px-3 pb-3 bg-gray-50">
                          <div className="text-xs text-gray-600 mb-1">
                            {r.method} · HTTP {r.status} · {r.message || 'no message'} · from {r.ip || 'unknown IP'}
                          </div>
                          <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto text-gray-700">
                            {JSON.stringify(r.params, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <p className="text-xs text-gray-400 flex items-center gap-1.5 pb-2">
        <Clock size={12} />
        Server metrics are kept 14 days, postback history 30 days. Nothing on this page changes your data —
        every endpoint behind it is read-only.
      </p>
    </div>
  );
}
