TrackHive - new performance status rules (mam's note)          24 Sep 2026
==========================================================================

FORMULA
  Profit   = Revenue - Ad Spend
  Profit % = Profit / Ad Spend x 100

  Spend $50, revenue $150 -> profit $100 -> 200%  V. Good
  Spend $50, revenue $100 -> profit $50  -> 100%  Good
  Spend $50, revenue $75  -> profit $25  ->  50%  Avg
  Spend $50, revenue $60  -> profit $10  ->  20%  Breakeven
  Spend $50, revenue $40  -> loss  $10   -> -20%  Loss -$10.00

RULES
  200% and above   V. Good     team sees status only
  100% - 199%      Good        team sees status only
  50%  - 99%       Avg         team sees status only
  0%   - 49%       Breakeven   team sees status only
  below 0%         Loss        team sees status + amount lost ("Loss -$10.00")

  A number exactly on a line goes to the higher tier (exactly 100% = Good).
  No spend entered -> Pending / No data (unchanged).
  Manager's Ad Spend report still shows spend, revenue, net and Profit %.

FILES (status rules)
  server/utils/teamView.js                    formula, tiers, loss amount
  server/controllers/adSpendController.js     comment only
  client/src/components/reports/PnlBadge.jsx  names + colours (AVG added)
  client/src/pages/AdSpend.jsx                "How the score works" panel
  client/src/utils/roles.js                   toggle label

ALSO INCLUDED (unchanged, from trackhive-postback-retry-fix.zip)
  server/controllers/postbackController.js
  server/utils/email.js

DEPLOY
  cd client && npm run build && cd .. && pm2 restart trackhive
  (client build needed this time - PnlBadge / AdSpend / roles changed)

Backup of the 5 files before this change:
  Claude outputs\pre-status-rules-backup\
