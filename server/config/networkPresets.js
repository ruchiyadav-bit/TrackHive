/**
 * Network presets — single source of truth for advertiser macro mappings.
 *
 * THE ONE RULE THAT MATTERS
 * -------------------------
 * `macros.click_id` MUST be the network's token for the SAME parameter named in
 * `clickIdParam`. We send our click id out as `?<clickIdParam>=<id>`; the only
 * way to get it back is for the network to echo that exact parameter.
 *
 *   clickIdParam: 'sub1'  →  macros.click_id: '{sub1}'     ✅
 *   clickIdParam: 'sub1'  →  macros.click_id: '{clickid}'  ❌  network's OWN id,
 *                                                              useless to us
 *
 * Breaking this rule is silent: the postback arrives, the click lookup fails,
 * and every conversion is lost with "click_id is required" / "Click not found".
 * validatePresets.js enforces it at boot.
 *
 * FIELDS
 * ------
 * clickIdParam : query-param name the network expects in the landing-page URL
 *                (outgoing, substituted by the /click handler)
 * macros       : tokens the network substitutes in the postback URL it fires
 *                back to us (incoming). click_id/revenue/payout/event required;
 *                txn_id optional.
 * extraParams  : additional params appended to the postback URL verbatim.
 * lifecycle    : how this network signals reversals and modifications. Values
 *                are compared lowercased against `conversion_status`/`status`.
 *                Omit when the network has no status token.
 * verified     : true only when the macros were checked against the network's
 *                own published docs (docsUrl). Unverified presets render a
 *                warning in the UI — treat them as a starting point.
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
    // Impact fires the same postback for the whole action life cycle and
    // distinguishes them with {Status}. Without this, a reversed sale stays
    // booked as revenue forever.
    extraParams: {
      conversion_status: '{Status}',
    },
    lifecycle: {
      reversed: ['reversed'],
      updated: ['modified'],
    },
    verified: true,
    docsUrl: 'https://help.impact.com/brand/what-would-you-like-to-learn-about/account-administration/account-settings/notifications/enable-event-notification-postbacks-for-brands',
    instruction: 'Paste in: Settings → Event Notifications → Action Life Cycle Events',
  },

  everflow: {
    label: 'Everflow',
    clickIdParam: 'sub1',
    macros: {
      // WAS '{transaction_id}' — that is Everflow's OWN conversion id, which we
      // have never seen and cannot look up. As a partner we get our value back
      // in {sub1}, the same param we sent it out in.
      click_id: '{sub1}',
      // Partner-side postbacks expose {payout} (what Everflow pays us). That is
      // our revenue; we pay nobody downstream, so payout is 0.
      revenue:  '{payout}',
      payout:   '0',
      event:    '{event_id}',
      txn_id:   '{transaction_id}',
    },
    verified: true,
    docsUrl: 'https://helpdesk.everflow.io/collaborator/managing-postbacks-as-a-partner',
    instruction: 'Paste in: Partner UI → Postbacks → Add Postback (or ask your AM to set it on the offer).',
  },

  affise: {
    label: 'Affise',
    clickIdParam: 'sub1',
    macros: {
      // WAS '{clickid}' — not in Affise's affiliate macro list at all, and it
      // would be Affise's id rather than ours.
      click_id: '{sub1}',
      revenue:  '{sum}',
      payout:   '0',
      event:    '{goal}',
      // WAS '{conversion_id}' — the real token has no underscore.
      txn_id:   '{transactionid}',
    },
    extraParams: {
      conversion_status: '{status}',
    },
    // Affise reports status numerically: 1=Approved 2=Pending 3=Declined 5=Hold.
    lifecycle: {
      reversed: ['3', 'declined'],
      updated: [],
    },
    verified: true,
    docsUrl: 'https://help-center.affise.com/en/articles/6483741-affiliate-postback-url-macros',
    instruction: 'Paste in: Offer → Postbacks → Add postback',
  },

  trackier: {
    label: 'Trackier',
    clickIdParam: 'p1',
    macros: {
      // NOTE: click_id must echo clickIdParam ('p1'). Confirm Trackier's exact
      // publisher token before trusting this in production.
      click_id: '{p1}',
      revenue:  '{sale_amount}',
      payout:   '0',
      event:    '{goal_value}',
      txn_id:   '{txn_id}',
    },
    verified: false,
    docsUrl: 'https://help.trackier.com/en/articles/8107293-publisher-tracking-link-parameters-and-postback-macros',
    instruction: 'Paste in: Publisher → Postback URL. Verify macro names against Trackier docs before going live.',
  },

  cellxpert: {
    label: 'Cellxpert',
    clickIdParam: 'xid',
    macros: {
      // Cellxpert uses square brackets. click_id must echo clickIdParam ('xid').
      click_id: '[xid]',
      revenue:  '[amount]',
      payout:   '0',
      event:    '[eventtype]',
      txn_id:   '[transactionid]',
    },
    verified: false,
    docsUrl: '',
    instruction: 'Contact your affiliate manager to set this up, and confirm every macro name with them first.',
  },

  katalys: {
    label: 'Katalys',
    // Katalys runs on TUNE (track.revoffers.com/aff_c?offer_id=..&aff_id=..) but
    // publishes its OWN replacement-token list, which differs from stock TUNE:
    // the sub-id token is {aff_sub1} (not TUNE's {aff_sub}) and there is no
    // {goal_name} — the nearest equivalent is {action_type}.
    clickIdParam: 'aff_sub1',
    macros: {
      click_id: '{aff_sub1}',
      // On Katalys {payout} is "the payout owed to the partner" — i.e. what
      // Katalys pays US. That is our revenue. {cost} and {order_value} exist but
      // are advertiser-only and come back empty for a partner account.
      revenue:  '{payout}',
      payout:   '0',
      event:    '{action_type}',
      txn_id:   '{transaction_id}',
    },
    extraParams: {
      conversion_status: '{conversion_status}',
      postback_operation: '{postback_operation}',
    },
    // Katalys sends postback_operation (create/update/delete) directly, which
    // the controller reads first; these are the status-only fallbacks.
    lifecycle: {
      reversed: ['rejected', 'reversed'],
      updated: [],
    },
    verified: true,
    docsUrl: 'https://kb.katalys.com/kb/postback-replacement-tokens',
    instruction: 'Paste in: app.katalys.com → Postbacks → Add Postback → Webhook Notification. Set "When to Send" to create + update + delete so reversals reach TrackHive.',
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
    verified: true,
    docsUrl: '',
    instruction: 'Paste this in your advertiser\'s postback settings, then replace each {macro} with their equivalent token. The click_id macro MUST be their token for the parameter you send the click id in.',
  },
};
