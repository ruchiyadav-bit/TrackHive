/**
 * Which money columns the reports show.
 *
 * Revenue and Payout stay visible: they are the two raw figures the networks
 * actually send, and right now they are the only way to tell which mapping a
 * row was booked under — rows from before the Impact fix carry the ORDER TOTAL
 * in revenue and the earnings in payout, rows from after carry the earnings in
 * revenue and 0 in payout.
 *
 * Everything DERIVED from the pair is hidden, because the derivation is only
 * as good as the pair and the pair is currently inconsistent:
 *
 *   Profit = revenue − payout  → mixes the two mappings into one wrong number
 *   Margin = profit / revenue  → same, as a percentage
 *   CPC    = payout / clicks   → $0.00 on every row booked the new way
 *   CPA    = payout / conv     → same
 *
 * A column that is wrong on half the rows is worse than no column: it invites
 * a total nobody can reconcile against Impact.
 *
 * Nothing is deleted — the server still computes and stores all of it. Flip
 * PROFIT_TRACKING to true once the old rows are migrated and payout means one
 * thing again (ad spend, or nothing), and every column comes straight back.
 */
export const PROFIT_TRACKING = false;

/** Column keys and summary-card labels derived from the revenue/payout pair. */
export const PROFIT_DEPENDENT_COLUMNS = ['profit', 'margin', 'cpc', 'cpa'];
export const PROFIT_DEPENDENT_CARDS = ['Profit', 'Margin', 'CPC', 'CPA'];

/** Drop the derived entries unless profit tracking is switched on. */
export function withoutDeadMoneyColumns(columns) {
  if (PROFIT_TRACKING) return columns;
  return columns.filter(c => !PROFIT_DEPENDENT_COLUMNS.includes(c.key));
}

export function withoutDeadMoneyCards(cards) {
  if (PROFIT_TRACKING) return cards;
  return cards.filter(c => !PROFIT_DEPENDENT_CARDS.includes(c.label));
}
