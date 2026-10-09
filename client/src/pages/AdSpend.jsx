import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Save, Trash2, RefreshCw, Info, ChevronDown } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { isTeam } from '../utils/roles';
import { dashboardDaysAgo, dashboardMonthRange } from '../utils/datetime';
import { useToast } from '../components/ui/Toast';
import PnlBadge from '../components/reports/PnlBadge';

/**
 * Ad Spend.
 *
 * Team member: pick an offer + date, type the day's ad spend, Save. Their own
 * entries are listed below with the performance badge (no revenue, no score).
 *
 * Manager: the Ad Spend report — every entry grouped by offer + day, with
 * revenue, net, score and badge.
 *
 * Score (Profit %) = (Revenue − Ad Spend) ÷ Ad Spend × 100.
 * ≥ 200% V. Good · ≥ 100% Good · ≥ 50% Avg · ≥ 0% Breakeven · below 0 Loss.
 * On a Loss the badge also shows how much was lost.
 * Worked out on the server (server/utils/teamView.js); the panel below the
 * table explains the same thing to whoever is reading the report.
 */

const money = v => `$${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// In the user's dashboard timezone, the same day the server checks against.
function isoDaysAgo(n) {
  return dashboardDaysAgo(n);
}

// Quick date ranges, same set as the reports. Dates are worked out in the
// dashboard timezone, the same days the server uses.
const QUICK_RANGES = [
  { key: 'today', label: 'Today', range: () => [isoDaysAgo(0), isoDaysAgo(0)] },
  { key: 'yesterday', label: 'Yesterday', range: () => [isoDaysAgo(1), isoDaysAgo(1)] },
  { key: 'last7', label: 'Last 7 days', range: () => [isoDaysAgo(6), isoDaysAgo(0)] },
  { key: 'last30', label: 'Last 30 days', range: () => [isoDaysAgo(30), isoDaysAgo(0)] },
  { key: 'thisMonth', label: 'This Month', range: () => dashboardMonthRange(0) },
  { key: 'lastMonth', label: 'Last Month', range: () => dashboardMonthRange(-1) },
];

function rangeKeyFor(from, to) {
  const hit = QUICK_RANGES.find(r => r.range().join() === [from, to].join());
  return hit ? hit.key : 'custom';
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900';

export default function AdSpend() {
  const { user } = useAuth();
  const team = isTeam(user);
  const toast = useToast();

  const [offers, setOffers] = useState([]);
  const [form, setForm] = useState({ offerId: '', date: isoDaysAgo(0), amount: '' });
  const [saving, setSaving] = useState(false);

  const [range, setRange] = useState({ from: isoDaysAgo(30), to: isoDaysAgo(0) });
  const [filterOffer, setFilterOffer] = useState('');
  const [filterMember, setFilterMember] = useState('');
  const [data, setData] = useState({ rows: [], summary: null, members: [] });
  const [loading, setLoading] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    api.get('/ad-spend/offers')
      .then(({ data }) => setOffers(data.offers || []))
      .catch(() => setOffers([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { from: range.from, to: range.to };
      if (filterOffer) params.offer_id = filterOffer;
      if (filterMember && !team) params.member = filterMember;
      const { data } = await api.get('/ad-spend', { params });
      setData({ rows: data.rows || [], summary: data.summary || null, members: data.members || [] });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load ad spend');
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, filterOffer, filterMember, team]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    if (!form.offerId) return toast.error('Select an offer');
    if (!form.date) return toast.error('Select a date');
    if (form.amount === '' || Number(form.amount) < 0) return toast.error('Enter ad spend');
    setSaving(true);
    try {
      await api.post('/ad-spend', { offerId: form.offerId, date: form.date, amount: Number(form.amount) });
      toast.success('Ad spend saved');
      setForm(f => ({ ...f, amount: '' }));
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save ad spend');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this ad spend entry?')) return;
    try {
      await api.delete(`/ad-spend/${id}`);
      toast.success('Entry deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete entry');
    }
  };

  const edit = (row) => {
    setForm({ offerId: String(row.offerId), date: row.date, amount: String(row.amount) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const s = data.summary;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{team ? 'Ad Spend' : 'Ad Spend Report'}</h1>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Entry form — team members (and anyone who wants to log spend) */}
      {team && (
        <form onSubmit={save} className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign size={16} /> Add daily ad spend
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Offer</label>
              <select className={inputCls} value={form.offerId} onChange={e => setForm(f => ({ ...f, offerId: e.target.value }))}>
                <option value="">Select offer</option>
                {offers.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input type="date" className={inputCls} value={form.date} max={isoDaysAgo(0)}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ad Spend (USD)</label>
              <div className="flex gap-2">
                <input type="number" step="0.01" min="0" placeholder="0.00" className={inputCls} value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                <button type="submit" disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                  <Save size={15} /> {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Same offer + same date saved again updates the earlier amount.
          </p>
        </form>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="flex flex-wrap items-center gap-1 mb-3">
        {QUICK_RANGES.map(r => {
          const active = rangeKeyFor(range.from, range.to) === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => { const [f, t] = r.range(); setRange({ from: f, to: t }); }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" className={inputCls} value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" className={inputCls} value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} />
        </div>
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Offer</label>
          <select className={inputCls} value={filterOffer} onChange={e => setFilterOffer(e.target.value)}>
            <option value="">All offers</option>
            {offers.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
          </select>
        </div>
        {!team && (
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Team member</label>
            <select className={inputCls} value={filterMember} onChange={e => setFilterMember(e.target.value)}>
              <option value="">All members</option>
              {data.members.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>
        )}
      </div>
      </div>

      {/* Manager summary */}
      {!team && s && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <Card label="Ad Spend" value={money(s.spend)} />
          <Card label="Revenue" value={money(s.revenue)} />
          <Card label="Net" value={money(s.net)} tone={s.net < 0 ? 'text-red-600' : 'text-gray-900'} />
          <Card label="Score" value={s.score === null || s.score === undefined ? '—' : `${s.score.toFixed(1)}%`} />
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-2">Performance</div>
            <PnlBadge status={s.pnlStatus} label={s.pnlLabel} size="lg" />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200 bg-gray-50">
              <th className="text-left font-medium px-4 py-3">Date</th>
              <th className="text-left font-medium px-4 py-3">Offer</th>
              {!team && <th className="text-left font-medium px-4 py-3">Team Member</th>}
              <th className="text-right font-medium px-4 py-3">Ad Spend</th>
              {!team && <th className="text-right font-medium px-4 py-3">Revenue</th>}
              {!team && <th className="text-right font-medium px-4 py-3">Net</th>}
              {!team && <th className="text-right font-medium px-4 py-3">Score</th>}
              <th className="text-left font-medium px-4 py-3">Performance</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={team ? 5 : 9} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            )}
            {!loading && data.rows.length === 0 && (
              <tr><td colSpan={team ? 5 : 9} className="px-4 py-8 text-center text-gray-400">No ad spend entered for this range</td></tr>
            )}
            {!loading && team && data.rows.map(r => (
              <tr key={r._id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 whitespace-nowrap">{r.date}</td>
                <td className="px-4 py-2.5">{r.offerName}</td>
                <td className="px-4 py-2.5 text-right">{money(r.amount)}</td>
                <td className="px-4 py-2.5"><PnlBadge status={r.pnlStatus} label={r.pnlLabel} /></td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button onClick={() => edit(r)} className="text-blue-600 hover:underline text-xs mr-3">Edit</button>
                  <button onClick={() => remove(r._id)} className="text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
            {!loading && !team && data.rows.map(r => (
              <tr key={`${r.offerId}|${r.date}`} className="hover:bg-gray-50 align-top">
                <td className="px-4 py-2.5 whitespace-nowrap">{r.date}</td>
                <td className="px-4 py-2.5">{r.offerName}</td>
                <td className="px-4 py-2.5">
                  {r.entries.map(e => (
                    <div key={e._id} className="text-gray-700">
                      {e.member}{r.entries.length > 1 && <span className="text-gray-400"> · {money(e.amount)}</span>}
                    </div>
                  ))}
                </td>
                <td className="px-4 py-2.5 text-right">{money(r.spend)}</td>
                <td className="px-4 py-2.5 text-right">{money(r.revenue)}</td>
                <td className={`px-4 py-2.5 text-right ${r.net < 0 ? 'text-red-600' : ''}`}>{money(r.net)}</td>
                <td className="px-4 py-2.5 text-right">{r.score === null ? '—' : `${r.score.toFixed(1)}%`}</td>
                <td className="px-4 py-2.5"><PnlBadge status={r.pnlStatus} label={r.pnlLabel} /></td>
                <td className="px-4 py-2.5 text-right">
                  {r.entries.map(e => (
                    <div key={e._id}>
                      <button onClick={() => remove(e._id)} className="text-gray-400 hover:text-red-600" title={`Delete ${e.member}'s entry`}><Trash2 size={15} /></button>
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* The logic behind this page, always visible. */}
      <div className="mt-4 flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-900">
        <Info size={14} className="mt-0.5 shrink-0 text-blue-600" />
        <div className="space-y-1">
          <div><strong>Logic used:</strong> each row is one offer on one day (dashboard timezone).</div>
          <div>Ad Spend = the amount the team member saved for that offer and date (saving the same offer + date again replaces it).</div>
          <div>Revenue = conversions that offer received that day. Net = Revenue − Ad Spend. Profit % = Net ÷ Ad Spend × 100.</div>
          <div>Status: 200%+ V. Good · 100–199% Good · 50–99% Avg · 0–49% Breakeven · below 0% Loss (the loss amount is shown). Spend not entered yet = Pending.</div>
        </div>
      </div>

      {!team && <ScoreGuide open={guideOpen} onToggle={() => setGuideOpen(o => !o)} />}
    </div>
  );
}

/**
 * The rules, in the manager's own report rather than in a wiki nobody opens.
 *
 * Collapsed by default: somebody reading yesterday's numbers does not need the
 * definition every time, but the one person asking "why is this Low?" should
 * not have to ask anyone.
 *
 * The dollar column is the whole point. "≥ 200%" means nothing at a glance;
 * "spend $50, earn $150" is the same rule and needs no arithmetic.
 */
function ScoreGuide({ open, onToggle }) {
  const tiers = [
    { badge: 'VERY_GOOD', label: 'V. Good', rule: '200% and above', plain: 'Profit is double the spend or more', ex: '$150+' },
    { badge: 'GOOD', label: 'Good', rule: '100% – 199%', plain: 'Profit equals the spend, up to double', ex: '$100 – $149' },
    { badge: 'AVG', label: 'Avg', rule: '50% – 99%', plain: 'Profit is half the spend, up to equal', ex: '$75 – $99' },
    { badge: 'BREAK_EVEN', label: 'Breakeven', rule: '0% – 49%', plain: 'Spend came back, with a small profit', ex: '$50 – $74' },
    { badge: 'LOSS', label: 'Loss −$10.00', rule: 'below 0%', plain: 'Spend was more than revenue — team sees the amount lost', ex: 'under $50' },
  ];
  const states = [
    { badge: 'PENDING', label: 'Pending', when: 'Clicks or revenue exist, but nobody has entered ad spend for that offer and day yet.' },
    { badge: 'NO_DATA', label: 'No data', when: 'Nothing ran — no spend, no revenue, no conversions.' },
  ];

  return (
    <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <Info size={16} className="text-blue-600" />
          How the performance score works
        </span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-5 pt-4 border-t border-gray-100 space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Step 1 — profit or loss</div>
              <div className="font-mono text-sm text-gray-900">Net = Revenue − Ad Spend</div>
              <p className="text-xs text-gray-600 mt-1.5">
                Spend higher than revenue is a <strong>Loss</strong>. On a Loss the team member also sees how much
                was lost (e.g. Loss −$10.00); on profit they see the status only.
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Step 2 — profit %</div>
              <div className="font-mono text-sm text-gray-900">Score = Net ÷ Ad Spend × 100</div>
              <p className="text-xs text-gray-600 mt-1.5">
                Profit measured against the spend. Spend $50, revenue $100 → profit $50 = <strong>100%</strong>;
                revenue $150 → profit $100 = <strong>200%</strong>. A number on a line goes to the higher tier.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <th className="text-left font-medium py-2 pr-4">Badge</th>
                  <th className="text-left font-medium py-2 pr-4">Score</th>
                  <th className="text-left font-medium py-2 pr-4">In plain terms</th>
                  <th className="text-left font-medium py-2">Spend $50 → revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tiers.map(t => (
                  <tr key={t.badge}>
                    <td className="py-2 pr-4"><PnlBadge status={t.badge} label={t.label} /></td>
                    <td className="py-2 pr-4 text-gray-900 whitespace-nowrap">{t.rule}</td>
                    <td className="py-2 pr-4 text-gray-600">{t.plain}</td>
                    <td className="py-2 text-gray-900 font-medium whitespace-nowrap">{t.ex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">When no score applies</div>
            <div className="space-y-2">
              {states.map(st => (
                <div key={st.badge} className="flex items-start gap-3">
                  <div className="pt-0.5 shrink-0 w-24"><PnlBadge status={st.badge} label={st.label} /></div>
                  <p className="text-xs text-gray-600">{st.when}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
            Team members see the badge only — never revenue or the score itself, and the net amount only
            when it is a loss. The tier is worked out on the server.
          </p>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, tone = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${tone}`}>{value}</div>
    </div>
  );
}
