/**
 * One-time migration for the "On duplicate" frequency-cap feature.
 *
 * The Offer schema's `onDuplicate` field defaults to 'block' for any *new*
 * document, but Mongoose applies that default in-memory even to existing
 * documents that don't have the field persisted — which would silently
 * start blocking live traffic on offers that were relying on the old
 * "always redirect" behaviour.
 *
 * This script explicitly persists onDuplicate: 'redirect' on every offer
 * that predates this feature (i.e. doesn't have the field stored in Mongo
 * yet), so existing offers keep their current behaviour. Only brand-new
 * offers created after this migration get the new 'block' default.
 *
 * Usage: node server/scripts/migrateOnDuplicate.js
 * (or: npm run migrate:on-duplicate, from server/)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Offer = require('../models/Offer');

(async () => {
  await connectDB();

  try {
    const result = await Offer.updateMany(
      { onDuplicate: { $exists: false } },
      { $set: { onDuplicate: 'redirect' } }
    );

    console.log(
      `Migration complete: ${result.modifiedCount} offer(s) set to onDuplicate='redirect' ` +
      `(preserving existing behaviour). New offers will default to 'block'.`
    );
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
