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
      // {Payout} is Impact's "Action Earnings" — what Impact pays US. That is
      // our revenue, and it is what must drive every profit figure.
      //
      // This used to be revenue: '{Amount}' and payout: '{Payout}', which read
      // the two columns backwards: {Amount} is Impact's "Sale Amount", the
      // customer's order total, which belongs to the MERCHANT and never
      // reaches us. On live data that booked $629.92 of revenue against
      // $126.00 of "payout" and reported $503.92 of profit, when the actual
      // earnings were $126.00 — profit overstated five-fold.
      revenue:  '{Payout}',
      // We pay nobody downstream. Kept explicit rather than omitted so the
      // generated postback URL states it and a reader can see it is deliberate.
      payout:   '0',
      event:    '{ActionTrackerName}',
      txn_id:   '{ActionId}',
    },
    // Impact fires the same postback for the whole action life cycle and
    // distinguishes them with {Status}. Without this, a reversed sale stays
    // booked as revenue forever.
    extraParams: {
      conversion_status: '{Status}',
      // The order total, kept for reference only — it never touches revenue,
      // profit or any rate. Managers can see how big the orders are; it is
      // never sent to a team member.
      sale_amount: '{Amount}',
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
      // UNVERIFIED and probably the ORDER TOTAL, not our commission — the same
      // mistake Impact had above. Confirm against a live conversion before
      // running this network; see the impact preset for what the fix looks like.
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
      // UNVERIFIED and probably the ORDER TOTAL, not our commission — the same
      // mistake Impact had above. Confirm against a live conversion before
      // running this network; see the impact preset for what the fix looks like.
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
      // UNVERIFIED and probably the ORDER TOTAL, not our commission — the same
      // mistake Impact had above. Confirm against a live conversion before
      // running this network; see the impact preset for what the fix looks like.
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

  smartadv: {
    label: 'SmartAdv',
    // SmartAdv runs on Everflow. Their own publisher FAQ answers "How do I set
    // a postback?" by linking to Everflow's partner postback docs, and Everflow
    // publishes SmartAdv as one of its network case studies. The tokens below
    // are therefore Everflow's partner-side macros, not SmartAdv-specific ones.
    clickIdParam: 'sub1',
    macros: {
      click_id: '{sub1}',
      // Everflow's partner portal exposes {payout} — what the network pays US,
      // which is our revenue. {sale_amount} also exists but only when the
      // advertiser has enabled sale-amount visibility, so it is not relied on.
      revenue:  '{payout}',
      payout:   '0',
      event:    '{event_id}',
      txn_id:   '{transaction_id}',
    },
    // Everflow publishes NO conversion-status token for partner postbacks, so a
    // reversal on SmartAdv's side never reaches us and revenue stays booked
    // until it is reconciled by hand. If the account manager can add a status
    // parameter, put it in extraParams and add a lifecycle block here.
    verified: false,
    docsUrl: 'https://helpdesk.everflow.io/customer/your-guide-to-parameters-macros',
    instruction: 'Paste in: portal.smartadv.com -> Postbacks -> add a global or per-offer postback. Send the click id out as ?sub1={click_id} on the offer landing page URL so it comes back in {sub1}.',
  },

  oasisads: {
    label: 'Oasis Ads',
    // Macros taken from the "Available URL Variables" list on Oasis Ads' own
    // Create Pixel / Postback screen — NOT from Everflow. An earlier version of
    // this preset used Everflow tokens because oasisads.everflowclient.io
    // resolves; that was circumstantial and wrong. The live panel is the
    // authority.
    //
    // We send our click id out as ?s1=<id> on the landing page URL, so it comes
    // back to us in {s1}. {s1} is the safe choice precisely because WE set its
    // value — it can only ever contain our own click id.
    clickIdParam: 's1',
    macros: {
      click_id: '{s1}',
      // Oasis Ads calls this "Earnings from conversion" — what the NETWORK pays
      // US, i.e. our revenue. Do NOT map it to payout: TrackHive computes
      // profit = revenue - payout, and payout is what WE pay downstream. Put
      // earnings in payout and every conversion books zero revenue and negative
      // profit. ({price} is documented as the same value.)
      revenue:  '{conversion_earnings}',
      payout:   '0',
      event:    '{event_id}',
      // {tid} = "Transaction ID". {conversion_id} also exists; either works,
      // this is reconciliation only and never affects attribution.
      txn_id:   '{tid}',
    },
    // Belt-and-braces on the click id. Oasis Ads also exposes {pub_click_id}
    // ("Publisher Click ID") and it is not documented whether that carries OUR
    // id or the platform's own. postbackController reads
    // `click_id || clickid || cid`, so sending it as cid costs nothing and
    // rescues the conversion if {s1} ever comes back empty. Drop it once a live
    // conversion proves which one populates.
    extraParams: {
      cid: '{pub_click_id}',
    },
    verified: false,
    docsUrl: '',
    instruction: 'LANDING PAGE URL: append ?s1={click_id} to the Oasis Ads offer URL — {click_id} is TrackHive\'s macro, s1 is their parameter. Without it every conversion is unattributable. POSTBACK: Oasis Ads panel -> Postbacks -> Create Pixel / Postback -> Event Type "Conversion", Tracking Method "Postback URL", paste the URL below into Value, set Active.',
  },
  vipresponse: {
    label: 'VIP Response',
    // Macros from VIP Response's own publisher panel ("The following parameters
    // can be used"): [transaction_id] [click_id] [sub_id1] [sub_id2] [sub_id3]
    // [traffic_source] [payout]. Square brackets.
    //
    // [click_id] is VIP Response's OWN click id, so our id travels in sub_id1:
    // we send ?sub_id1=<id> on the offer link and read it back as [sub_id1].
    clickIdParam: 'sub_id1',
    macros: {
      click_id: '[sub_id1]',
      // [payout] = what VIP Response pays US → our revenue.
      revenue:  '[payout]',
      payout:   '0',
      // No event/goal token is offered, so a fixed name.
      event:    'conversion',
      txn_id:   '[transaction_id]',
    },
    // No status token → a rejection on their side never reaches us.
    verified: false,
    docsUrl: '',
    instruction: 'LANDING PAGE URL: add sub_id1={click_id} to the VIP Response offer link. POSTBACK: publisher.vipresponse.nl -> postback settings -> choose the CONVERSION postback (not the click one) and paste the URL below.',
  },

  blueaff: {
    label: 'BlueAff',
    // Macros from BlueAff's "Parameter Mapping" screen (Step 2). BlueAff lets you
    // name each key yourself, so the keys below are TrackHive's own names and
    // the values are BlueAff macros or static values.
    //
    // Our click id goes out as ?sub1=<id> and comes back in {sub1}.
    clickIdParam: 'sub1',
    macros: {
      click_id: '{sub1}',
      // {est_revenue} = "Your commission for this order" → our revenue.
      // {sale_amount} is the customer's order total — NOT our money.
      revenue:  '{est_revenue}',
      payout:   '0',
      event:    'sale',
      txn_id:   '{conversion_id}',
    },
    extraParams: {
      // Pending / Approved / Rejected / Paid. "rejected" is already in the
      // controller's shared reversal list.
      conversion_status: '{status}',
      sale_amount: '{sale_amount}',
    },
    lifecycle: {
      reversed: ['rejected'],
      updated: [],
    },
    verified: false,
    docsUrl: '',
    instruction: 'LANDING PAGE URL: add sub1={click_id} to the BlueAff offer link. POSTBACK: publisher.blueaff.com -> Postback -> Step 1 paste the base URL; Step 2 Parameter Mapping: add each key=value from the URL below exactly (click_id -> {sub1}, revenue -> {est_revenue}, payout -> 0, event -> sale, txn_id -> {conversion_id}, conversion_status -> {status}, sale_amount -> {sale_amount}, secret -> your secret) and remove every other row.',
  },

  salegains: {
    label: 'SaleGains',
    // SaleGains' postback form takes a bare URL; parameters are ticked on the
    // right and their NAMES are editable. Tokens: [id] [clickId] [merchantId]
    // [merchantName] [orderId] [channelId] [uid] [amount] [commission]
    // [quantity] [approveTime] [commissionModel] [note] [updatedAt] [status].
    //
    // CONFIRMED against a live payload, 22 Sep 2026: every macro resolved
    // ([orderId], [status], [commission], [amount]). [uid] carries the id we
    // put on the link and [clickId] is SaleGains' own. The [uid] seen empty in
    // that payload came from the panel's Test button, which has no click
    // behind it to carry an id.
    clickIdParam: 'uid',
    macros: {
      click_id: '[uid]',
      // [commission] = what SaleGains pays us. [amount] is the order total and
      // MUST be renamed — the controller reads a param called "amount" as
      // revenue when "revenue" is missing.
      revenue:  '[commission]',
      payout:   '0',
      event:    'sale',
      txn_id:   '[orderId]',
    },
    extraParams: {
      conversion_status: '[status]',
      sale_amount: '[amount]',
    },
    lifecycle: {
      reversed: ['rejected'],
      // SaleGains fires PENDING first with commission 0.00 and sends the real
      // amount only when the conversion turns APPROVED. Without 'approved'
      // mapped to an update, that second postback hits the duplicate guard,
      // 409s, and the money never books — the conversion sits at $0 for ever.
      // Live payload that proved it:
      //   { conversion_status: "PENDING", revenue: "0.00", event: "Sign Up" }
      updated: ['approved'],
    },
    verified: false,
    docsUrl: '',
    instruction: 'LANDING PAGE URL: add uid={click_id} to the SaleGains link. POSTBACK: SaleGains -> Add postback. Postback Url: only the part up to and including secret (https://DOMAIN/postback?payout=0&event=sale&secret=...). On the right rename: uid -> click_id, commission -> revenue, orderId -> txn_id, status -> conversion_status, amount -> sale_amount; untick every other parameter. Request Type GET. Status: tick Pending, Approved and Rejected.',
  },

  maxbounty: {
    label: 'MaxBounty',
    // From public tracker docs (Voluum, Scaleo) — NOT yet checked against the
    // MaxBounty panel. MaxBounty uses #HASH# macros.
    // Our click id goes out as &s2=<id> and comes back in #S2#.
    clickIdParam: 's2',
    macros: {
      click_id: '#S2#',
      // #RATE# = what MaxBounty pays us for the lead → our revenue.
      revenue:  '#RATE#',
      payout:   '0',
      event:    'lead',
    },
    verified: false,
    docsUrl: 'https://doc.voluum.com/en/adding_maxbounty_offer.html',
    instruction: 'LANDING PAGE URL: add &s2={click_id} to the MaxBounty offer link. POSTBACK: MaxBounty -> Tracking / Postback (global or per campaign) -> paste the URL below. Confirm #S2# and #RATE# against the macro list shown there.',
  },

  maxweb: {
    label: 'MaxWeb',
    // From public tracker docs (Voluum, AnyTrack) — NOT yet checked against the
    // MaxWeb panel. Tokens: {SUBID} {SUBID2}..{SUBID5} {ORDERID}
    // {PRODUCT_CODENAME} {COMMISSION_AMOUNT}.
    // Our click id goes out as &subid2=<id> and comes back in {SUBID2}.
    clickIdParam: 'subid2',
    macros: {
      click_id: '{SUBID2}',
      // {COMMISSION_AMOUNT} = our commission → our revenue.
      revenue:  '{COMMISSION_AMOUNT}',
      payout:   '0',
      event:    'sale',
      txn_id:   '{ORDERID}',
    },
    verified: false,
    docsUrl: 'https://doc.voluum.com/article/maxweb-and-voluum',
    instruction: 'LANDING PAGE URL: add &subid2={click_id} to the MaxWeb offer link. POSTBACK: MaxWeb affiliate backoffice -> Postback / Tracking -> paste the URL below. Confirm {SUBID2}, {COMMISSION_AMOUNT} and {ORDERID} against the macro list shown there.',
  },

  verdeads: {
    label: 'VerdeAds',
    // VerdeAds runs on Everflow - its partner panel is a white-label Everflow
    // instance at verdeads.everflowclient.io - so these are Everflow's
    // partner-side macros, the same ones as the `everflow` preset above.
    // Our click id goes out as &sub1=<id> and comes back in {sub1}.
    clickIdParam: 'sub1',
    macros: {
      click_id: '{sub1}',
      // Partner-side {payout} is what VerdeAds pays US - our revenue. We pay
      // nobody downstream, so payout is 0. Everflow's {transaction_id} is
      // THEIR conversion id, kept as a reference only.
      revenue:  '{payout}',
      payout:   '0',
      event:    '{event_id}',
      txn_id:   '{transaction_id}',
    },
    // Everflow publishes NO conversion-status token for partner postbacks, so a
    // reversal on VerdeAds' side never reaches us and revenue stays booked until
    // it is reconciled by hand. If the AM can add a status parameter, put it in
    // extraParams and add a lifecycle block here.
    verified: false,
    docsUrl: 'https://helpdesk.everflow.io/collaborator/managing-postbacks-as-a-partner',
    instruction: 'LANDING PAGE URL: add &sub1={click_id} to the VerdeAds offer link. POSTBACK: verdeads.everflowclient.io -> Postbacks -> Add Postback -> type "conversion" -> paste the URL below.',
  },

  jb: {
    label: 'JB',
    // Another white-label Everflow partner panel (jb.everflowclient.io), so the
    // macros are identical to `verdeads` and `everflow`. Kept as its own preset
    // so this advertiser carries its own postback secret and instructions.
    clickIdParam: 'sub1',
    macros: {
      click_id: '{sub1}',
      revenue:  '{payout}',
      payout:   '0',
      event:    '{event_id}',
      txn_id:   '{transaction_id}',
    },
    // Same limitation as VerdeAds: no partner-side conversion-status token,
    // so reversals never reach us.
    verified: false,
    docsUrl: 'https://helpdesk.everflow.io/collaborator/managing-postbacks-as-a-partner',
    instruction: 'LANDING PAGE URL: add &sub1={click_id} to the JB offer link. POSTBACK: jb.everflowclient.io -> Postbacks -> Add Postback -> type "conversion" -> paste the URL below.',
  },

  vexio: {
    label: 'Vexio',
    // Another white-label Everflow partner panel (vexio.everflowclient.io), so
    // the macros are identical to `jb`, `verdeads` and `everflow`. Kept as its
    // own preset so this advertiser carries its own postback secret and its own
    // instructions.
    clickIdParam: 'sub1',
    macros: {
      click_id: '{sub1}',
      // Partner-side {payout} is what Vexio pays US - our revenue. We pay
      // nobody downstream, so payout is 0. {transaction_id} is THEIR conversion
      // id, kept as a reference only.
      revenue:  '{payout}',
      payout:   '0',
      event:    '{event_id}',
      txn_id:   '{transaction_id}',
    },
    // Same limitation as VerdeAds and JB: Everflow publishes no partner-side
    // conversion-status token, so a reversal on Vexio's side never reaches us
    // and revenue stays booked until it is reconciled by hand.
    verified: false,
    docsUrl: 'https://helpdesk.everflow.io/collaborator/managing-postbacks-as-a-partner',
    instruction: 'LANDING PAGE URL: add &sub1={click_id} to the Vexio offer link. POSTBACK: vexio.everflowclient.io -> Postbacks -> Add Postback -> type "conversion" -> paste the URL below.',
  },

  flexoffers: {
    label: 'FlexOffers',
    // New FlexOffers publisher dashboard (publisherprobeta.flexoffers.com).
    // FlexOffers uses #HASH# macros, like MaxBounty. Our click id goes out on
    // the tracking link as &fobs=<id> and comes back in #fobs#.
    clickIdParam: 'fobs',
    macros: {
      click_id: '#fobs#',
      // #ca# = commission amount, what FlexOffers pays US -> our revenue.
      revenue:  '#ca#',
      payout:   '0',
      // FlexOffers has no event/goal macro, so a fixed name.
      event:    'sale',
      // #on# = order number, reconciliation only.
      txn_id:   '#on#',
    },
    extraParams: {
      // #sa# = the order total. Kept for reference only - it is the merchant's
      // money, never our revenue.
      sale_amount: '#sa#',
    },
    // No status macro, so a reversal on FlexOffers' side never reaches us and
    // revenue stays booked until it is reconciled by hand.
    verified: false,
    docsUrl: '',
    instruction: 'TRACKING LINK: add &fobs={click_id} to the FlexOffers link so the click id comes back in #fobs#. POSTBACK: publisherprobeta.flexoffers.com -> postback / pixel settings -> paste the URL below.',
  },

  fanfuel: {
    label: 'FanFuel',
    // FanFuel's partner panel (partners.fanfuel.co) runs on Everflow, so these
    // are Everflow's partner-side macros. Our click id goes out as &sub1=<id>
    // and comes back in {sub1}.
    clickIdParam: 'sub1',
    macros: {
      click_id: '{sub1}',
      // {payout_amount} = what FanFuel pays US -> our revenue.
      revenue:  '{payout_amount}',
      payout:   '0',
      event:    '{event_id}',
      // {transaction_id} is THEIR conversion id, kept as a reference only.
      txn_id:   '{transaction_id}',
    },
    extraParams: {
      // "rejected" is already in the controller's shared reversal list.
      conversion_status: '{conversion_status}',
      // The order total, reference only - never revenue.
      sale_amount: '{sale_amount}',
    },
    verified: false,
    docsUrl: 'https://helpdesk.everflow.io/collaborator/managing-postbacks-as-a-partner',
    instruction: 'LANDING PAGE URL: add &sub1={click_id} to the FanFuel offer link. POSTBACK: partners.fanfuel.co -> Postbacks -> Add Postback -> type "conversion" -> paste the URL below.',
  },

  musketeers: {
    label: 'Musketeers (Trackier)',
    // musketeers.trackier.io is a Trackier panel. Trackier's publisher docs:
    // send our click id in p1 and read it back with {p1}; {payout} is the
    // payout to the publisher (us) -> our revenue; {txn_id}, {goal_value}.
    clickIdParam: 'p1',
    macros: {
      click_id: '{p1}',
      revenue:  '{payout}',
      payout:   '0',
      event:    '{goal_value}',
      txn_id:   '{txn_id}',
    },
    // No status macro in Trackier's publisher list, so reversals never reach us.
    verified: false,
    docsUrl: 'https://help.trackier.com/en/articles/8107293-publisher-tracking-link-macro-and-postback-parameter',
    instruction: 'LANDING PAGE URL: add &p1={click_id} to the Musketeers offer link. POSTBACK: musketeers.trackier.io -> Postback -> paste the URL below.',
  },

  somicreative: {
    label: 'Somi Creative (Affise)',
    // somicreative.affise.com is an Affise panel, so the macros are the same
    // as the `affise` preset above. Our click id goes out as &sub1=<id>.
    clickIdParam: 'sub1',
    macros: {
      click_id: '{sub1}',
      revenue:  '{sum}',
      payout:   '0',
      event:    '{goal}',
      txn_id:   '{transactionid}',
    },
    extraParams: {
      conversion_status: '{status}',
    },
    // Affise status: 1=Approved 2=Pending 3=Declined 5=Hold.
    lifecycle: {
      reversed: ['3', 'declined'],
      updated: [],
    },
    verified: false,
    docsUrl: 'https://help-center.affise.com/en/articles/6483741-affiliate-postback-url-macros',
    instruction: 'LANDING PAGE URL: add &sub1={click_id} to the Somi Creative offer link. POSTBACK: somicreative.affise.com -> Offer -> Postbacks -> Add postback -> paste the URL below.',
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
