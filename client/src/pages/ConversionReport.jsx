import ReportShell, { fmtCurrency } from '../components/reports/ReportShell';
import { fmtDateTime } from '../utils/datetime';
import PnlBadge from '../components/reports/PnlBadge';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isTeam } from '../utils/roles';

const COLUMNS = [
  { key: 'conversionAt', label: 'Date', align: 'left', sortable: true },
  { key: 'offerName', label: 'Offer', align: 'left', sortable: true },
  { key: 'conversionEvent', label: 'Event', align: 'left', sortable: false },
  { key: 'clickId', label: 'Click ID', align: 'left', sortable: false },
  { key: 'country', label: 'Country', align: 'left', sortable: false },
  { key: 'device', label: 'Device', align: 'left', sortable: false },
  { key: 'source', label: 'Source', align: 'left', sortable: false },
  // The merchant's order total, not our income — informational only, and
  // never part of revenue, profit or any rate. Team members never receive it.
  { key: 'saleAmount', label: 'Sale Amount', align: 'right', sortable: false },
  { key: 'revenue', label: 'Revenue', align: 'right', sortable: true },
  { key: 'payout', label: 'Payout', align: 'right', sortable: true },
  { key: 'profit', label: 'Profit', align: 'right', sortable: true },
];

/**
 * Team view of the same conversions: who converted, from where — but not for
 * how much. Revenue, payout and profit are gone from the response entirely;
 * the badge is what is left of them.
 */
const TEAM_COLUMNS = [
  { key: 'conversionAt', label: 'Date', align: 'left', sortable: true },
  { key: 'offerName', label: 'Offer', align: 'left', sortable: true },
  { key: 'conversionEvent', label: 'Event', align: 'left', sortable: false },
  { key: 'clickId', label: 'Click ID', align: 'left', sortable: false },
  { key: 'country', label: 'Country', align: 'left', sortable: false, field: 'country' },
  { key: 'device', label: 'Device', align: 'left', sortable: false, field: 'device' },
  { key: 'source', label: 'Source', align: 'left', sortable: false, field: 'source' },
  { key: 'pnl', label: 'Performance', align: 'left', sortable: false, field: 'status' },
];

function renderCell(row, key, timezone, teamView) {
  switch (key) {
    case 'conversionAt':
      // Rendered in the report's timezone, not the browser's — see utils/datetime.
      return <span className="text-gray-600 text-xs whitespace-nowrap">{fmtDateTime(row.conversionAt, timezone)}</span>;
    case 'pnl':
      return <PnlBadge status={row.pnlStatus} label={row.pnlLabel} />;
    case 'offerName':
      // Opens the offer's own page. Not for team members: they do not get the
      // single offer page at all.
      if (row.offerId && !teamView) {
        return (
          <Link to={`/offers/${row.offerId}`} className="font-medium text-blue-600 hover:underline truncate max-w-[200px] inline-block">
            {row.offerName}
          </Link>
        );
      }
      return <span className="font-medium text-gray-900 truncate max-w-[200px] inline-block">{row.offerName}</span>;
    case 'conversionEvent':
      return <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{row.conversionEvent}</span>;
    case 'clickId':
      return <code className="text-xs text-gray-500 truncate max-w-[120px] inline-block">{row.clickId}</code>;
    case 'saleAmount':
      return <span className="text-gray-400">{row.saleAmount ? fmtCurrency(row.saleAmount) : '—'}</span>;
    case 'revenue':
      return <span className="text-blue-600 font-medium">{fmtCurrency(row.revenue)}</span>;
    case 'payout':
      return <span className="text-gray-600">{fmtCurrency(row.payout)}</span>;
    case 'profit':
      return <span className={Number(row.profit) >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{fmtCurrency(row.profit)}</span>;
    default:
      return <span className="text-gray-600 text-xs">{String(row[key] ?? '—')}</span>;
  }
}

export default function ConversionReport() {
  const { user } = useAuth();
  const teamView = isTeam(user);
  return (
    <ReportShell
      title="Conversion Report"
      endpoint="/reports/conversion"
      columns={COLUMNS}
      defaultSort="-conversionAt"
      defaultDays={30}
      renderCell={(row, key, timezone) => renderCell(row, key, timezone, teamView)}
      teamColumns={TEAM_COLUMNS}
    />
  );
}
