/**
 * Data isolation.
 *
 * A manager sees the whole account. A partner sees ONLY what they created —
 * their own offers, their own advertisers, and the clicks, conversions and
 * reports belonging to those offers. One partner must never be able to tell
 * what another partner is running, or even that they exist.
 *
 * Ownership is `createdBy`, which every relevant model already carries.
 *
 * Rules for anything added later:
 *
 *  1. A list endpoint applies `ownerFilter(req.user)` to its query.
 *  2. A single-document endpoint calls `assertOwned(doc, req.user)` after
 *     loading and BEFORE returning or mutating.
 *  3. Anything aggregating clicks scopes on `offerScopeMatch(await
 *     visibleOfferIds(req.user))`.
 *
 * Skipping any of these leaks another partner's data silently — the response
 * is a valid 200, just with rows that should not be there.
 */

const { isManager } = require('../config/roles');

/**
 * Mongo filter fragment limiting a query to documents the user owns.
 * Managers get `{}` (everything).
 */
function ownerFilter(user) {
  return isManager(user) ? {} : { createdBy: user._id };
}

/**
 * True when the user may see/modify this document.
 * A document with no `createdBy` (created before ownership existed) belongs to
 * managers only — it is never handed to a partner by default.
 */
function ownsDoc(doc, user) {
  if (!doc) return false;
  if (isManager(user)) return true;
  return String(doc.createdBy || '') === String(user._id);
}

/**
 * Uniform 404 for documents the user does not own.
 *
 * Deliberately 404 and not 403: a 403 confirms the id exists, which lets a
 * partner enumerate how many offers or advertisers other partners have.
 */
function denyNotFound(res, label = 'Not found') {
  return res.status(404).json({ error: label });
}

/**
 * Offer ids this user is allowed to see.
 * Returns `null` when unrestricted (a manager with full offer access), so
 * callers can skip adding any filter at all.
 */
async function visibleOfferIds(user) {
  const Offer = require('../models/Offer');

  const byOwner = !isManager(user);
  const byList = user.offerAccess === 'specific';
  if (!byOwner && !byList) return null;

  const filter = { status: { $ne: 'deleted' } };
  if (byOwner) filter.createdBy = user._id;
  if (byList) filter._id = { $in: user.allowedOffers || [] };

  const docs = await Offer.find(filter).select('_id').lean();
  return docs.map(d => d._id);
}

/**
 * Turn the result of visibleOfferIds() into a match fragment for any
 * click/stat collection keyed by `offerId`.
 *
 * An empty array matters: a partner who has created nothing must match NOTHING,
 * not everything. `{ $in: [] }` is what produces that.
 */
function offerScopeMatch(ids, field = 'offerId') {
  if (ids === null) return {};
  return { [field]: { $in: ids } };
}

module.exports = {
  ownerFilter,
  ownsDoc,
  denyNotFound,
  visibleOfferIds,
  offerScopeMatch,
};
