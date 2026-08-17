import ReportShell, { fmtCurrency, fmtNumber, fmtPercent } from '../components/reports/ReportShell';

const COLUMNS = [
  { key: 'hour', label: 'Hour', align: 'left', sortable: true },
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
];

function renderCell(row, key) {
  switch (key) {
    case 'hour':
      return <span className="font-medium text-gray-900 text-xs">{row.hour}</span>;
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
    default:
      return <span className="text-gray-700">{String(row[key] ?? '—')}</span>;
  }
}

export default function HourlyReport() {
  return (
    <ReportShell
      title="Hourly Report"
      endpoint="/reports/hourly"
      columns={COLUMNS}
      defaultSort="-hour"
      defaultDays={1}
    renderCell={renderCell}
    />
  );
}
