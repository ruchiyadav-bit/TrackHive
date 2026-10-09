/**
 * Data isolation.
 *
 * EVERY user — manager included — sees only the offers, advertisers, groups,
 * templates, clicks, conversions, reports and alerts they created themselves.
 * A manager running the account alongside their team is still just another
 * operator with their own book of business; being a manager is about
 * ADMINISTRATION, not visibility.
 *
 * What `manager` actually grants (see config/roles.js — none of it is data):
 *   - User Management: create, edit, deactivate accounts
 *   - Tracking Domains: add, verify, delete
 *   - Account settings and Telegram configuration
 *
 * Ownership is `createdBy`, which every relevant model already carries.
 *
 * Rules for anything added later:
 *
 *  1. A list endpoint applies `ownerFilter(req.user)` to its query.
 *  2. A single-document endpoint calls `ownsDoc(doc, req.user)` after loading
 *     and BEFORE returning or mutating — and puts `ownerFilter` inside the
 *     write query itself, not in a separate pre-check.
 *  3. Anything aggregating clicks scopes on `offerScopeMatch(await
 *     visibleOfferIds(req.user))`.
 *
 * Skipping any of these leaks another user's data silently — the response is a
 * valid 200, just with rows that should not be there.
 */

const mongoose = require('mongoose');
const { isTeam } = require('../config/roles');

/**
 * Whose rows this request may read.
 *
 * For manager and partner that is themselves. A `team` account owns nothing —
 * it was created by a manager or partner to look at THAT creator's book — so it reads the
 * owner recorded on the account.
 *
 * The unset case matters: a team account with no `teamOwner` must see NOTHING.
 * Returning `user._id` would show it its own (empty) data, which is harmless;
 * returning null or undefined would make `{ createdBy: undefined }` match
 * EVERY row in the account. So we hand back a fresh ObjectId, which by
 * construction matches nothing that exists.
 */
function dataOwnerId(user) {
  if (!isTeam(user)) return user._id;
  if (user.teamOwner) return user.teamOwner;
  return new mongoose.Types.ObjectId();
}

/**
 * Mongo filter fragment limiting a query to documents this user may read.
 * The only role exemption is `team`, and it is expressed entirely through
 * dataOwnerId() above — never add a second one here.
 */
function ownerFilter(user) {
  return { createdBy: dataOwnerId(user) };
}

/**
 * True when the user may see/modify this document.
 *
 * A document with no `createdBy` predates ownership and belongs to nobody, so
 * it is returned to nobody — better a missing row than a leaked one.
 */
function ownsDoc(doc, user) {
  if (!doc) return false;
  return String(doc.createdBy || '') === String(dataOwnerId(user));
}

/**
 * Uniform 404 for documents the user does not own.
 *
 * Deliberately 404 and not 403: a 403 confirms the id exists, which lets
 * someone enumerate how many offers or advertisers their colleagues have.
 */
function denyNotFound(res, label = 'Not found') {
  return res.status(404).json({ error: label });
}

/**
 * Offer ids this user is allowed to see. ALWAYS an array — a user who owns
 * nothing gets `[]`, which must match no rows.
 *
 * (Callers still tolerate `null` for "unrestricted". Nothing produces that any
 * more, and the guards are kept only so a future change cannot silently turn a
 * missing scope into a full-table read.)
 */
async function visibleOfferIds(user) {
  const Offer = require('../models/Offer');

  const filter = { status: { $ne: 'deleted' }, ...ownerFilter(user) };
  if (user.offerAccess === 'specific') {
    filter._id = { $in: user.allowedOffers || [] };
  }

  const docs = await Offer.find(filter).select('_id').lean();
  return docs.map(d => d._id);
}

/**
 * Turn the result of visibleOfferIds() into a match fragment for any
 * click/stat collection keyed by `offerId`.
 *
 * The empty array matters: someone who has created nothing must match NOTHING,
 * not everything. `{ $in: [] }` is what produces that.
 */
function offerScopeMatch(ids, field = 'offerId') {
  if (ids === null) return {};
  return { [field]: { $in: ids } };
}

module.exports = {
  dataOwnerId,
  ownerFilter,
  ownsDoc,
  denyNotFound,
  visibleOfferIds,
  offerScopeMatch,
};
