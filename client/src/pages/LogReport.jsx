import { useState } from 'react';
import ReportShell, { StatusBadge, fmtCurrency, daysAgo, todayStr } from '../components/reports/ReportShell';

const COLUMNS = [
  { key: 'clickedAt', label: 'Timestamp', align: 'left', sortable: true },
  { key: 'offerName', label: 'Offer', align: 'left', sortable: true },
  { key: 'status', label: 'Status', align: 'left', sortable: false },
  { key: 'blockReason', label: 'Block Reason', align: 'left', sortable: false },
  { key: 'ip', label: 'IP', align: 'left', sortable: false },
  { key: 'country', label: 'Country', align: 'left', sortable: false },
  { key: 'device', label: 'Device', align: 'left', sortable: false },
  { key: 'os', label: 'OS', align: 'left', sortable: false },
  { key: 'browser', label: 'Browser', align: 'left', sortable: false },
  { key: 'source', label: 'Source', align: 'left', sortable: false },
  { key: 'subId1', label: 'Sub1', align: 'left', sortable: false },
  { key: 'revenue', label: 'Revenue', align: 'right', sortable: true },
  { key: 'payout', label: 'Payout', align: 'right', sortable: true },
  { key: 'profit', label: 'Profit', align: 'right', sortable: true },
];

function renderCell(row, key) {
  switch (key) {
    case 'clickedAt':
      return <span className="text-gray-600 text-xs whitespace-nowrap">{row.clickedAt ? new Date(row.clickedAt).toLocaleString() : '—'}</span>;
    case 'offerName':
      return <span className="font-medium text-gray-900 truncate max-w-[180px] inline-block text-xs">{row.offerName}</span>;
    case 'status':
      return <StatusBadge row={row} />;
    case 'blockReason':
      return row.blockReason
        ? <code className="text-[11px] bg-gray-100 px-1 py-0.5 rounded text-gray-600">{row.blockReason}</code>
        : <span className="text-gray-300 text-xs">—</span>;
    case 'ip':
      return <code className="text-xs bg-gray-100 px-1 py-0.5 rounded text-gray-700">{row.ip}</code>;
    case 'clickId':
      return <code className="text-xs text-gray-500 truncate max-w-[100px] inline-block">{row.clickId}</code>;
    case 'revenue':
      return <span className="text-blue-600 text-xs">{fmtCurrency(row.revenue)}</span>;
    case 'payout':
      return <span className="text-gray-600 text-xs">{fmtCurrency(row.payout)}</span>;
    case 'profit':
      return <span className={`text-xs font-medium ${Number(row.profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtCurrency(row.profit)}</span>;
    default:
      return <span className="text-gray-600 text-xs">{String(row[key] ?? '—')}</span>;
  }
}

export default function LogReport() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');

  const extraFilters = (
    <>
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">Status</label>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 min-w-[120px]"
        >
          <option value="all">All</option>
          <option value="valid">Valid</option>
          <option value="duplicates">Duplicates</option>
          <option value="blocked">Blocked</option>
          <option value="blocked_cap">Blocked by cap</option>
          <option value="bots">Bots</option>
          <option value="converted">Converted</option>
        </select>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">Search</label>
        <input
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="IP or Click ID..."
          className="px-2.5 py-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 min-w-[150px]"
        />
      </div>
    </>
  );

  return (
    <ReportShell
      title="Click Log"
      endpoint="/reports/log"
      columns={COLUMNS}
      defaultSort="-clickedAt"
      defaultDays={0}
      autoRefreshMs={12000}
      renderCell={renderCell}
      extraFilters={extraFilters}
      extraParams={{ status: statusFilter, search: searchText }}
      hideChart
    />
  );
}
