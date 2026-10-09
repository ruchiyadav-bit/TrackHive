/**
 * Timestamp formatting for report data.
 *
 * Every report response carries the timezone its figures were bucketed in
 * (?timezone= → Settings.timezone → UTC). Rendering a row's timestamp with a
 * bare toLocaleString() ignores that and uses the VIEWER's browser timezone
 * instead, so one page showed its totals in one timezone and its rows in
 * another: a conversion the summary counted on Sept 13 Pacific printed as
 * Sept 14 on an IST browser, which is exactly what made the numbers look
 * unmatchable against the advertiser's dashboard. Always pass the timezone the
 * response came back with.
 */

/**
 * The signed-in user's dashboard timezone (their own choice, their owner's
 * for a team member, else the account default). Set by useAuth from
 * /auth/me; used below so "Today" / "Last 7 days" are the user's days, not
 * UTC's — the server buckets reports in the same zone.
 */
let dashboardTz = '';

export function setDashboardTimezone(tz) {
  dashboardTz = isValidTimeZone(tz) ? tz : '';
}

export function getDashboardTimezone() {
  return dashboardTz;
}

/** 'YYYY-MM-DD' for now minus `n` days, in the dashboard timezone. */
export function dashboardDaysAgo(n = 0) {
  const d = new Date(Date.now() - n * 86400000);
  // en-CA formats as YYYY-MM-DD by definition.
  return d.toLocaleDateString('en-CA', withZone(dashboardTz, {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }));
}

/** 'YYYY-MM-DD' for today in the dashboard timezone. */
export function dashboardToday() {
  return dashboardDaysAgo(0);
}

/**
 * [from, to] for a calendar month in the dashboard timezone, as 'YYYY-MM-DD'.
 * offset 0 = this month (1st .. today), -1 = last month (1st .. last day).
 * Plain string/date arithmetic on today's date, so it never drifts by a day
 * the way local-time Date math does near midnight.
 */
export function dashboardMonthRange(offset = 0) {
  const today = dashboardToday();
  const [y, m] = today.split('-').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  if (offset === 0) return [`${y}-${pad(m)}-01`, today];
  // Month index 0-11, shifted by the offset.
  const idx = (y * 12 + (m - 1)) + offset;
  const ty = Math.floor(idx / 12);
  const tm = (idx % 12) + 1;
  // Day 0 of the following month = last day of this one.
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return [`${ty}-${pad(tm)}-01`, `${ty}-${pad(tm)}-${pad(lastDay)}`];
}

/**
 * Every IANA zone the browser knows, for timezone pickers. Falls back to a
 * short list on old browsers without Intl.supportedValuesOf.
 */
export function timezoneOptions() {
  let list = [];
  try {
    if (typeof Intl.supportedValuesOf === 'function') list = Intl.supportedValuesOf('timeZone');
  } catch { /* fall through */ }
  if (!list.length) {
    list = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'Europe/London', 'Europe/Amsterdam', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Kolkata',
      'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'];
  }
  return ['UTC', ...list.filter(z => z !== 'UTC')];
}

/** Is this a timezone identifier the browser's Intl actually knows? */
function isValidTimeZone(tz) {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Merge in `timeZone` only when it is usable. An unknown identifier makes
 * toLocaleString throw a RangeError, which would blank the whole table — a
 * silent fall back to browser-local is the lesser failure.
 */
function withZone(timezone, extra) {
  const o = { ...extra };
  if (isValidTimeZone(timezone)) o.timeZone = timezone;
  return o;
}

/**
 * "9/13/2026, 9:44:15 PM" — date + time in the report's timezone.
 *
 * No timezone label on the row: Intl has no abbreviation that reads well for
 * every zone in one locale — en-US prints "PDT" for Los Angeles but
 * "GMT+5:30" for Kolkata, en-IN prints "IST" for Kolkata but "GMT-7" for
 * Los Angeles. The account has ONE reporting timezone, so repeating it on
 * every row bought noise rather than clarity.
 */
export function fmtDateTime(value, timezone) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', withZone(timezone, {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit',
  }));
}

/** "9:44 PM" — clock time only, in the report's timezone. */
export function fmtTime(value, timezone) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', withZone(timezone, {
    hour: '2-digit', minute: '2-digit',
  }));
}
