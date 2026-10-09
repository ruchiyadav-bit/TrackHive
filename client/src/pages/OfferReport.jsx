import ReportShell, { fmtCurrency, fmtNumber, fmtPercent } from '../components/reports/ReportShell';
import PnlBadge from '../components/reports/PnlBadge';

const COLUMNS = [
  { key: 'offerName', label: 'Offer', align: 'left', sortable: true },
  { key: 'grossClicks', label: 'Gross', align: 'right', sortable: true },
  { key: 'clicks', label: 'Clicks', align: 'right', sortable: true },
  { key: 'uniqueClicks', label: 'Uniq', align: 'right', sortable: true },
  { key: 'dupClicks', label: 'Dup', align: 'right', sortable: true },
  { key: 'invalidClicks', label: 'Invalid', align: 'right', sortable: true },
  { key: 'conversions', label: 'CV', align: 'right', sortable: true },
  { key: 'cvr', label: 'CVR', align: 'right', sortable: true },
  { key: 'revenue', label: 'Revenue', align: 'right', sortable: true },
  { key: 'payout', label: 'Payout', align: 'right', sortable: true },
  { key: 'profit', label: 'Profit', align: 'right', sortable: true },
  { key: 'margin', label: 'Margin', align: 'right', sortable: true },
];

/**
 * What a read-only team member sees instead: the same traffic, no money, and
 * one profit/loss badge. The `field` on each column is the manager's per-member
 * toggle — ReportShell drops a column the server says this person may not see.
 */
const TEAM_COLUMNS = [
  { key: 'offerName', label: 'Offer', align: 'left', sortable: true },
  { key: 'grossClicks', label: 'Gross Clicks', align: 'right', sortable: true, field: 'grossClicks' },
  { key: 'clicks', label: 'Clicks', align: 'right', sortable: true, field: 'clicks' },
  { key: 'dupClicks', label: 'Duplicate', align: 'right', sortable: true, field: 'dupClicks' },
  { key: 'invalidClicks', label: 'Invalid', align: 'right', sortable: true, field: 'invalidClicks' },
  { key: 'uniqueClicks', label: 'Unique', align: 'right', sortable: true, field: 'uniqueClicks' },
  { key: 'conversions', label: 'Conversions', align: 'right', sortable: true, field: 'conversions' },
  { key: 'cvr', label: 'CVR', align: 'right', sortable: true, field: 'cvr' },
  // Not sortable: the badge is derived after the query, so the server has
  // nothing to sort on and would silently return an unsorted page.
  { key: 'pnl', label: 'Performance', align: 'left', sortable: false, field: 'status' },
];

function renderCell(row, key) {
  switch (key) {
    case 'pnl':
      return <PnlBadge status={row.pnlStatus} label={row.pnlLabel} />;
    case 'offerName':
      return <span className="font-medium text-gray-900 truncate max-w-[220px] inline-block">{row.offerName}</span>;
    case 'grossClicks':
    case 'clicks':
    case 'uniqueClicks':
      return <span className="text-gray-700">{fmtNumber(row[key])}</span>;
    case 'dupClicks':
      return <span className="text-amber-600">{fmtNumber(row[key])}</span>;
    case 'invalidClicks':
      return <span className="text-red-600">{fmtNumber(row[key])}</span>;
    case 'conversions':
      return <span className="text-gray-700">{fmtNumber(row[key])}</span>;
    case 'cvr':
      return <span className="text-gray-600">{fmtPercent(row.cvr)}</span>;
    case 'revenue':
      return <span className="text-blue-600 font-medium">{fmtCurrency(row.revenue)}</span>;
    case 'payout':
      return <span className="text-gray-600">{fmtCurrency(row.payout)}</span>;
    case 'profit':
      return <span className={Number(row.profit) >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{fmtCurrency(row.profit)}</span>;
    case 'margin':
      return <span className="text-gray-600">{fmtPercent(row.margin)}</span>;
    default:
      return <span className="text-gray-700">{String(row[key] ?? '—')}</span>;
  }
}

function renderExpandRow(row) {
  if (!row.expand) return null;
  const { byCountry = [], byDevice = [] } = row.expand;

  return (
    <div className="px-8 py-3 grid grid-cols-2 gap-6">
      {/* Country breakdown */}
      {byCountry.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">By Country</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left pb-1">Country</th>
                <th className="text-right pb-1">Clicks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {byCountry.map(c => (
                <tr key={c.country}>
                  <td className="py-1 text-gray-700">{c.country || '—'}</td>
                  <td className="py-1 text-right text-gray-600">{fmtNumber(c.clicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Device breakdown */}
      {byDevice.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">By Device</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left pb-1">Device</th>
                <th className="text-right pb-1">Clicks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {byDevice.map(d => (
                <tr key={d.device}>
                  <td className="py-1 text-gray-700">{d.device || '—'}</td>
                  <td className="py-1 text-right text-gray-600">{fmtNumber(d.clicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {byCountry.length === 0 && byDevice.length === 0 && (
        <div className="text-xs text-gray-400 col-span-2">No breakdown data available</div>
      )}
    </div>
  );
}

export default function OfferReport() {
  return (
    <ReportShell
      title="Offer Report"
      endpoint="/reports/offer"
      columns={COLUMNS}
      defaultSort="-revenue"
      defaultDays={30}
      renderCell={renderCell}
      teamColumns={TEAM_COLUMNS}
      renderExpandRow={renderExpandRow}
    />
  );
}
