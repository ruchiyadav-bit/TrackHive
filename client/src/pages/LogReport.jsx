import { useState } from 'react';
import ReportShell, { StatusBadge, fmtCurrency, daysAgo, todayStr } from '../components/reports/ReportShell';
import { fmtDateTime } from '../utils/datetime';
import PnlBadge from '../components/reports/PnlBadge';

const COLUMNS = [
  { key: 'clickedAt', label: 'Timestamp', align: 'left', sortable: true },
  { key: 'clickId', label: 'Click ID', align: 'left', sortable: false },
  { key: 'offerName', label: 'Offer', align: 'left', sortable: true },
  { key: 'status', label: 'Status', align: 'left', sortable: false },
  { key: 'blockReason', label: 'Block Reason', align: 'left', sortable: false },
  { key: 'conversionStatus', label: 'Conv. Status', align: 'left', sortable: false },
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

/**
 * Team view of the click log. Same rows, money removed.
 *
 * Note the two different "status" ideas here: the existing Status column is
 * the CLICK's own state (ok / bot / blocked / converted), while the P&L column
 * is the money badge. They are separate keys on the row for exactly that
 * reason — see server/utils/teamView.js.
 */
const TEAM_COLUMNS = [
  { key: 'clickedAt', label: 'Timestamp', align: 'left', sortable: true },
  { key: 'clickId', label: 'Click ID', align: 'left', sortable: false },
  { key: 'offerName', label: 'Offer', align: 'left', sortable: true },
  { key: 'status', label: 'Status', align: 'left', sortable: false },
  { key: 'blockReason', label: 'Block Reason', align: 'left', sortable: false },
  { key: 'conversionStatus', label: 'Conv. Status', align: 'left', sortable: false },
  { key: 'ip', label: 'IP', align: 'left', sortable: false },
  { key: 'country', label: 'Country', align: 'left', sortable: false, field: 'country' },
  { key: 'device', label: 'Device', align: 'left', sortable: false, field: 'device' },
  { key: 'os', label: 'OS', align: 'left', sortable: false },
  { key: 'browser', label: 'Browser', align: 'left', sortable: false },
  { key: 'source', label: 'Source', align: 'left', sortable: false, field: 'source' },
  { key: 'subId1', label: 'Sub1', align: 'left', sortable: false },
  { key: 'pnl', label: 'Performance', align: 'left', sortable: false, field: 'status' },
];

function renderCell(row, key, timezone) {
  switch (key) {
    case 'clickedAt':
      // Rendered in the report's timezone, not the browser's — see utils/datetime.
      return <span className="text-gray-600 text-xs whitespace-nowrap">{fmtDateTime(row.clickedAt, timezone)}</span>;
    case 'pnl':
      return <PnlBadge status={row.pnlStatus} label={row.pnlLabel} />;
    case 'offerName':
      return <span className="font-medium text-gray-900 truncate max-w-[180px] inline-block text-xs">{row.offerName}</span>;
    case 'status':
      return <StatusBadge row={row} />;
    case 'blockReason':
      return row.blockReason
        ? <code className="text-[11px] bg-gray-100 px-1 py-0.5 rounded text-gray-600">{row.blockReason}</code>
        : <span className="text-gray-300 text-xs">—</span>;
    case 'conversionStatus': {
      if (!row.conversionStatus) return <span className="text-gray-300 text-xs">—</span>;
      const s = row.conversionStatus;
      const tone = s === 'approved' ? 'bg-green-100 text-green-700'
        : s === 'reversed' ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-700';
      return <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${tone}`}>{s}</span>;
    }
    case 'ip':
      return <code className="text-xs bg-gray-100 px-1 py-0.5 rounded text-gray-700">{row.ip}</code>;
    case 'clickId':
      if (!row.clickId) return <span className="text-gray-300 text-xs">—</span>;
      // Click-to-copy: this value gets pasted into a network's postback test
      // form, and selecting a truncated 32-char id by hand is miserable.
      return (
        <button
          onClick={() => navigator.clipboard?.writeText(row.clickId)}
          title={`${row.clickId} — click to copy`}
          className="text-xs text-gray-500 font-mono truncate max-w-[110px] inline-block hover:text-blue-600 cursor-pointer text-left"
        >
          {row.clickId.slice(0, 10)}…
        </button>
      );
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
      teamColumns={TEAM_COLUMNS}
      extraFilters={extraFilters}
      extraParams={{ status: statusFilter, search: searchText }}
      hideChart
    />
  );
}
