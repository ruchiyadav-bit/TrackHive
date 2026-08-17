import ReportShell, { fmtCurrency } from '../components/reports/ReportShell';

const COLUMNS = [
  { key: 'conversionAt', label: 'Date', align: 'left', sortable: true },
  { key: 'offerName', label: 'Offer', align: 'left', sortable: true },
  { key: 'conversionEvent', label: 'Event', align: 'left', sortable: false },
  { key: 'clickId', label: 'Click ID', align: 'left', sortable: false },
  { key: 'country', label: 'Country', align: 'left', sortable: false },
  { key: 'device', label: 'Device', align: 'left', sortable: false },
  { key: 'source', label: 'Source', align: 'left', sortable: false },
  { key: 'revenue', label: 'Revenue', align: 'right', sortable: true },
  { key: 'payout', label: 'Payout', align: 'right', sortable: true },
  { key: 'profit', label: 'Profit', align: 'right', sortable: true },
];

function renderCell(row, key) {
  switch (key) {
    case 'conversionAt':
      return <span className="text-gray-600 text-xs">{row.conversionAt ? new Date(row.conversionAt).toLocaleString() : '—'}</span>;
    case 'offerName':
      return <span className="font-medium text-gray-900 truncate max-w-[200px] inline-block">{row.offerName}</span>;
    case 'conversionEvent':
      return <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{row.conversionEvent}</span>;
    case 'clickId':
      return <code className="text-xs text-gray-500 truncate max-w-[120px] inline-block">{row.clickId}</code>;
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
  return (
    <ReportShell
      title="Conversion Report"
      endpoint="/reports/conversion"
      columns={COLUMNS}
      defaultSort="-conversionAt"
      defaultDays={30}
      renderCell={renderCell}
    />
  );
}
