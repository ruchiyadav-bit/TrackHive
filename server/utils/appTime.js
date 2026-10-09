/**
 * Timezone handling for reporting, modelled on Everflow.
 *
 * Everflow keeps every event timestamp in UTC and buckets into days/hours at
 * QUERY time using the timezone the caller asks for (`timezone_id` on the
 * request, falling back to the network's `reporting_timezone_id`). The same
 * date range returns different totals depending on the timezone passed.
 *
 * TrackHive now does the same:
 *   - Click.clickedAt / conversionAt stay in UTC (unchanged)
 *   - reports resolve a timezone per request:
 *       ?timezone=... → the user's own dashboard timezone → Settings.timezone → UTC
 *   - day buckets are produced with $dateToString({ timezone }) at query time
 *
 * Because nothing is baked into stored data, the timezone can be changed at any
 * time and ALL history — including data recorded before this change — is
 * re-bucketed correctly. No migration, no discontinuity.
 */

const Setting = require('../models/Setting');
const { isTeam } = require('../config/roles');

const DEFAULT_TZ = 'UTC';
const CACHE_TTL_MS = 60_000;

let cache = { tz: null, at: 0 };

/** Is this a timezone identifier Node's ICU actually knows? */
function isValidTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * The account-level reporting timezone (Settings → timezone).
 * Cached briefly so report endpoints don't hit the settings collection per call.
 */
async function getReportTimezone() {
  if (cache.tz && Date.now() - cache.at < CACHE_TTL_MS) return cache.tz;
  try {
    const s = await Setting.findOne({ key: 'timezone' });
    const tz = isValidTimezone(s?.value) ? s.value : DEFAULT_TZ;
    cache = { tz, at: Date.now() };
    return tz;
  } catch {
    return cache.tz || DEFAULT_TZ;
  }
}

/** Drop the cache — call after the timezone setting is updated. */
function clearTimezoneCache() {
  cache = { tz: null, at: 0 };
}

/**
 * The dashboard timezone chosen by this user, or null for "account default".
 *
 * A team member never has its own: it reads its OWNER's (loaded onto
 * req.teamOwner by middleware/auth.js), so a partner and the team that
 * partner created always see the same days. Each partner's choice lives on
 * that partner's own User document, so one partner switching zones can never
 * move another partner's numbers.
 */
function userTimezone(req) {
  const user = req?.user;
  if (!user) return null;
  const tz = isTeam(user) ? req.teamOwner?.timezone : user.timezone;
  return isValidTimezone(tz) ? tz : null;
}

/**
 * Resolve the timezone for one request:
 *   explicit ?timezone=  →  the user's own dashboard timezone (owner's, for a
 *   team member)  →  the account default (Settings → timezone)  →  UTC.
 * Mirrors Everflow's per-request timezone_id → user → network default.
 */
async function resolveTimezone(req) {
  const requested = req?.query?.timezone;
  if (isValidTimezone(requested)) return requested;
  const own = userTimezone(req);
  if (own) return own;
  return getReportTimezone();
}

/**
 * Milliseconds to add to a UTC instant to get wall-clock time in `tz`.
 * Uses formatToParts so it is DST-correct for any zone (IST has no DST, but
 * this keeps the helper honest if the account is ever set to e.g. New York).
 */
function tzOffsetMs(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const asUTC = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    p.hour === '24' ? 0 : Number(p.hour), Number(p.minute), Number(p.second)
  );
  return asUTC - date.getTime();
}

/** The UTC instant at which the local day `YYYY-MM-DD` begins in `tz`. */
function zonedStartOfDayUtc(dateStr, tz) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  return new Date(guess - tzOffsetMs(new Date(guess), tz));
}

/** The UTC instant at which the local day `YYYY-MM-DD` ends in `tz`. */
function zonedEndOfDayUtc(dateStr, tz) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  return new Date(guess - tzOffsetMs(new Date(guess), tz));
}

/** 'YYYY-MM-DD' for "now" in `tz`. en-CA formats as ISO-style by definition. */
function todayInTz(tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** 'YYYY-MM-DD' for n days before now, in `tz`. */
function daysAgoInTz(n, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(Date.now() - n * 86400000));
}

/** First day of the current month in `tz`, as 'YYYY-MM-DD'. */
function monthStartInTz(tz = DEFAULT_TZ) {
  return todayInTz(tz).slice(0, 8) + '01';
}

module.exports = {
  DEFAULT_TZ,
  isValidTimezone,
  getReportTimezone,
  clearTimezoneCache,
  resolveTimezone,
  userTimezone,
  zonedStartOfDayUtc,
  zonedEndOfDayUtc,
  todayInTz,
  daysAgoInTz,
  monthStartInTz,
};
