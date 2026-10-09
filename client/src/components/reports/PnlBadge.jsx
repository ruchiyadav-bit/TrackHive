/**
 * The performance badge a team member sees in place of revenue and payout.
 *
 * The tier is decided on the SERVER (server/utils/teamView.js) from
 * Profit % = (Revenue − Ad Spend) ÷ Ad Spend × 100. This component only paints
 * it. That matters: if it worked the tier out here, the earnings would have to
 * be in the response — which is exactly what the team view exists to prevent.
 *
 * Ladder: V. Good (dark green) → Good (green) → Avg (amber) → Breakeven (grey)
 * → Loss (red). A Loss label carries the amount lost, e.g. "Loss −$10.00".
 */

const TONES = {
  VERY_GOOD: 'bg-emerald-600 text-white ring-emerald-700/20',
  GOOD: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  AVG: 'bg-amber-100 text-amber-700 ring-amber-600/20',
  // Money came back, but little over the spend. Neither green nor red.
  BREAK_EVEN: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  PENDING: 'bg-sky-100 text-sky-700 ring-sky-600/20',
  // Distinct from every earning tier on purpose. Most offers have no
  // conversion on most days; painting those amber would say the offer
  // performed badly when in fact it never ran.
  NO_DATA: 'bg-gray-100 text-gray-500 ring-gray-400/20',
  // Ad spend exceeded revenue. A real loss, so it is allowed to look like one.
  LOSS: 'bg-red-100 text-red-700 ring-red-600/20',
};

export default function PnlBadge({ status, label, size = 'sm' }) {
  if (!status) return <span className="text-gray-300 text-xs">—</span>;
  const tone = TONES[status] || TONES.NO_DATA;
  const pad = size === 'lg' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ring-1 ring-inset ${tone} ${pad}`}
    >
      {label || status}
    </span>
  );
}
