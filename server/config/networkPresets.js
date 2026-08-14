/**
 * Network presets — single source of truth for advertiser macro mappings.
 *
 * clickIdParam : the query-param name the advertiser expects in the
 *                landing-page URL  (outgoing, added by /click handler)
 * macros       : the macro tokens the advertiser will substitute in the
 *                postback URL they fire back to us  (incoming)
 *
 * NOTE: Cellxpert uses square brackets, NOT curly braces.
 *       Always read from this config — never hardcode macro syntax.
 */

module.exports = {
  impact: {
    label: 'Impact.com',
    clickIdParam: 'subId1',
    macros: {
      click_id: '{SubId1}',
      revenue:  '{Amount}',
      payout:   '{Payout}',
      event:    '{ActionTrackerName}',
      txn_id:   '{ActionId}',
    },
    instruction: 'Paste in: Settings → Event Notifications → Action Life Cycle Events',
  },
  everflow: {
    label: 'Everflow',
    clickIdParam: 'sub1',
    macros: {
      click_id: '{transaction_id}',
      revenue:  '{sale_amount}',
      payout:   '{payout}',
      event:    '{offer_id}',
      txn_id:   '{conversion_id}',
    },
    instruction: 'Paste in: Offer → Tracking → Postback URL',
  },
  affise: {
    label: 'Affise',
    clickIdParam: 'sub1',
    macros: {
      click_id: '{clickid}',
      revenue:  '{sum}',
      payout:   '{sum}',
      event:    '{goal}',
      txn_id:   '{conversion_id}',
    },
    instruction: 'Paste in: Offer → Postbacks → Add postback',
  },
  trackier: {
    label: 'Trackier',
    clickIdParam: 'p1',
    macros: {
      click_id: '{click_id}',
      revenue:  '{sale_amount}',
      payout:   '{payout}',
      event:    '{goal_value}',
      txn_id:   '{txn_id}',
    },
    instruction: 'Paste in: Publisher → Postback URL',
  },
  cellxpert: {
    label: 'Cellxpert',
    clickIdParam: 'xid',
    macros: {
      click_id: '[clickid]',
      revenue:  '[amount]',
      payout:   '[commission]',
      event:    '[eventtype]',
      txn_id:   '[transactionid]',
    },
    instruction: 'Contact your affiliate manager to set this up',
  },
  custom: {
    label: 'Custom / Other',
    clickIdParam: 'click_id',
    macros: {
      click_id: '{click_id}',
      revenue:  '{revenue}',
      payout:   '{payout}',
      event:    '{event}',
      txn_id:   '{txn_id}',
    },
    instruction: 'Paste this in your advertiser\'s postback settings. Verify macros match their documentation.',
  },
};
