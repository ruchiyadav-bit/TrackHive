# TrackHive — Project Documentation

## What is TrackHive?

TrackHive is a self-hosted affiliate/performance marketing offer tracking platform, inspired by Everflow. It lets media buyers, affiliate networks, and performance marketers track clicks, conversions, and revenue across multiple offers, advertisers, and traffic sources — all from a single dashboard.

Think of it as your own private tracking system: you create offers, generate tracking links, send traffic through those links, and the system records every click, fires postbacks on conversions, and gives you real-time reporting with breakdowns by country, device, source, and more.

Last verified: 2026-08-17

---

## Who is it for?

- Media buyers running paid traffic to CPA/CPS/CPL offers
- Small affiliate networks managing multiple offers and advertisers
- Performance marketing teams who need a lightweight, self-hosted alternative to Everflow, Voluum, or Binom

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Tailwind CSS 4 |
| Backend | Node.js, Express 4 |
| Database | MongoDB Atlas (Mongoose 8) |
| Auth | JWT (jsonwebtoken + bcrypt) |
| Hosting | Render (free tier compatible) |
| Icons | Lucide React |
| Charts | Recharts |

Last verified: 2026-08-17

---

## Project Structure

```
trackhive/
├── client/                          # React frontend (Vite)
│   ├── index.html                   # Entry HTML — title: TrackHive
│   ├── package.json                 # Frontend dependencies
│   ├── vite.config.js               # Vite config with API proxy for dev
│   └── src/
│       ├── main.jsx                 # React entry point
│       ├── App.jsx                  # Router — all routes defined here
│       ├── index.css                # Tailwind base styles
│       ├── api/
│       │   └── client.js            # Axios instance — auto-attaches JWT, handles 401
│       ├── hooks/
│       │   ├── useAuth.jsx          # AuthContext — login, logout, token management
│       │   └── useTheme.jsx         # Theme context (light only)
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Layout.jsx       # Main layout — sidebar + topbar + content
│       │   │   ├── Sidebar.jsx      # Navigation — Dashboard, Offers, Advertisers, Reports (5 sub-items), Settings
│       │   │   └── TopBar.jsx       # Header — date, user info, logout
│       │   ├── offers/
│       │   │   ├── OfferWizard.jsx  # 5-step offer creation wizard (Everflow-style)
│       │   │   └── OfferForm.jsx    # Legacy form (unused, kept for reference)
│       │   ├── reports/
│       │   │   └── ReportShell.jsx  # Shared report layout — filters, summary, chart, table, pagination
│       │   └── ui/
│       │       ├── Toast.jsx        # Toast notification component
│       │       ├── Skeleton.jsx     # Loading skeleton
│       │       ├── ErrorBoundary.jsx # React error boundary
│       │       └── EmptyState.jsx   # Empty state placeholder
│       ├── pages/
│       │   ├── Login.jsx            # Login page
│       │   ├── Signup.jsx           # Self-registration page (new users get 'viewer' role)
│       │   ├── Dashboard.jsx        # Main dashboard — stats cards, chart, top offers, recent clicks
│       │   ├── Offers.jsx           # Offer list — search, filter, paginate
│       │   ├── OfferNew.jsx         # Create offer (renders OfferWizard)
│       │   ├── OfferEdit.jsx        # Edit offer (renders OfferWizard with offerId)
│       │   ├── OfferDetail.jsx      # Single offer view — all details, revenue/payout/profit
│       │   ├── Advertisers.jsx      # Advertiser list + CRUD modal
│       │   ├── AdvertiserDetail.jsx # Single advertiser — postback config, linked offers, stats
│       │   ├── TrackingDomains.jsx  # Tracking domain management with DNS verify
│       │   ├── ConversionReport.jsx # Conversion report — individual conversions
│       │   ├── OfferReport.jsx      # Offer report — grouped by offer with expand rows
│       │   ├── DailyReport.jsx      # Daily report — day-by-day breakdown
│       │   ├── HourlyReport.jsx     # Hourly report — hour-by-hour from Click collection
│       │   ├── LogReport.jsx        # Click log — raw clicks with status badges + filters
│       │   ├── Settings.jsx         # App settings — general, tracking, notifications, users
│       │   └── UserManagement.jsx   # User list — Super Admin can change roles
│       └── utils/
│           ├── constants.js         # Status, category, network enums
│           ├── formatCurrency.js    # Currency formatter
│           └── formatDate.js        # Date formatter
│
├── server/                          # Express backend
│   ├── index.js                     # App entry — middleware, routes, static serving, startup
│   ├── package.json                 # Backend dependencies
│   ├── config/
│   │   ├── db.js                    # MongoDB connection with retry logic
│   │   └── networkPresets.js        # Network macro mappings (Impact, Everflow, Affise, etc.)
│   ├── middleware/
│   │   ├── auth.js                  # JWT verification + role-based authorization
│   │   └── errorHandler.js          # Global error handler
│   ├── models/
│   │   ├── User.js                  # User — name, email, password (bcrypt), role, status
│   │   ├── Offer.js                 # Offer — 5-step wizard fields, tracking config, totals
│   │   ├── Advertiser.js            # Advertiser — name, company, network, postbackSecret
│   │   ├── TrackingDomain.js        # Tracking domain — domain, DNS status, SSL check
│   │   ├── Click.js                 # Click record — visitor info, sub IDs, conversion data
│   │   ├── DailyStat.js             # Aggregated daily stats per offer
│   │   ├── Notification.js          # System notifications (cap alerts, etc.)
│   │   ├── Setting.js               # Key-value settings store
│   │   ├── ActivityLog.js           # Audit trail
│   │   ├── OfferGroup.js            # Offer grouping
│   │   └── OfferTemplate.js         # Saved offer templates
│   ├── controllers/
│   │   ├── authController.js        # Login, signup, change password
│   │   ├── offerController.js       # Offer CRUD + duplicate
│   │   ├── advertiserController.js  # Advertiser CRUD + secret regeneration
│   │   ├── trackingDomainController.js # Add, verify (DNS+SSL), delete domains
│   │   ├── clickController.js       # Click tracking — redirect-first, background DB writes
│   │   ├── smartLinkController.js   # Smart link handler — bot/VPN/geo/IP filtering + redirect
│   │   ├── postbackController.js    # Conversion postback handler + cap alerts
│   │   ├── bulkImportController.js  # CSV bulk import (coming soon — stub)
│   │   ├── dashboardController.js   # Dashboard stats, chart data, top offers, geo
│   │   ├── reportController.js      # Reports — conversion, offer, daily, hourly, log + CSV export
│   │   ├── userController.js        # User CRUD (admin only)
│   │   ├── settingsController.js    # App settings get/update
│   │   ├── activityController.js    # Activity log listing
│   │   ├── notificationController.js # Notification CRUD + unread count
│   │   ├── templateController.js    # Offer template CRUD
│   │   ├── offerGroupController.js  # Offer group CRUD + group reports
│   │   └── telegramController.js    # Telegram bot integration
│   ├── routes/
│   │   ├── auth.js                  # POST /signup, POST /login, GET /me, PUT /change-password
│   │   ├── offers.js                # CRUD + POST /:id/duplicate
│   │   ├── advertisers.js           # CRUD + POST /:id/regenerate-secret
│   │   ├── trackingDomains.js       # GET /, POST /, POST /:id/verify, DELETE /:id
│   │   ├── click.js                 # GET / (public redirect), GET /api/list, GET /api/:clickId
│   │   ├── smartLink.js             # GET /:slug (public redirect)
│   │   ├── postback.js              # GET / and POST / (public — conversion postback)
│   │   ├── networkPresets.js        # GET / — network macro config (public)
│   │   ├── dashboard.js             # Summary, chart, top offers, recent clicks, geo
│   │   ├── reports.js               # Conversion, offer, daily, hourly, log + CSV + bulk import
│   │   ├── users.js                 # User CRUD (admin)
│   │   ├── settings.js              # Settings get/update
│   │   ├── notifications.js         # Notifications CRUD + unread count
│   │   ├── templates.js             # Template CRUD
│   │   ├── activity.js              # Activity log listing
│   │   ├── offerGroups.js           # Group CRUD + group report
│   │   ├── telegram.js              # Telegram settings + test
│   │   └── smartLinks.js            # QR code generation for smart links
│   └── utils/
│       ├── seedAdmin.js             # Seeds Super Admin from ADMIN_EMAIL + ADMIN_PASSWORD env vars
│       ├── clickHelpers.js          # Click ID gen, visitor parsing, frequency cap, bot/VPN detection, macros
│       ├── postbackUrl.js           # Builds postback URL with network-specific macros
│       ├── activityLogger.js        # Activity log utility
│       └── telegram.js              # Telegram bot message sender
│
├── package.json                     # Root — dev scripts, concurrently
├── ecosystem.config.js              # PM2 config for production
├── .gitignore                       # node_modules, .env, dist, logs
├── DEPLOY-GUIDE.md                  # Step-by-step GitHub + Render deployment
└── PROJECT.md                       # This file
```

Last verified: 2026-08-17

---

## Core Features

### 1. Authentication, Roles & Data Isolation

- **JWT-based auth** — login returns a token, stored in localStorage, sent as `Bearer` header on every API call
- **Self-registration** — anyone can sign up at `/signup`; the role is pinned server-side and the form has no role field
- **TWO roles only** — `manager` and `partner`, defined in `server/config/roles.js`
- **Manager seeding** — on first run, creates a manager using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`
- **Offer-level access control** — users can additionally be restricted to specific offers (`offerAccess: 'specific'`), which *narrows* ownership, never widens it

**The role model (changed 2026-08-19 — was 4 roles: super_admin / admin / manager / viewer):**

`manager` is NOT a data permission. Both roles see only what they created; a manager
additionally *administers* the account.

| | manager | partner |
|---|---|---|
| Own offers, advertisers, clicks, reports | ✅ | ✅ |
| **Anyone else's** | ❌ | ❌ |
| User Management (`/api/users`) | ✅ | ❌ |
| Tracking Domains — add / verify / delete | ✅ | ❌ |
| Tracking Domains — read (picker) | ✅ | ✅ (trimmed fields) |
| Settings writes, Telegram | ✅ | ❌ |
| Settings tabs visible | all | General + Security |

**Data isolation — `server/utils/scope.js`**

Ownership is `createdBy`, present on Offer, Advertiser, OfferGroup, OfferTemplate,
TrackingDomain and (since 2026-08-19) Notification.

- `ownerFilter(user)` → `{ createdBy: user._id }` for **everyone**, no role exemption
- `ownsDoc(doc, user)` → strict compare; a doc with no `createdBy` belongs to nobody
- `visibleOfferIds(user)` → always an array; `[]` means "owns nothing" and must match **no** rows
- `offerScopeMatch(ids)` → `{ offerId: { $in: ids } }`; the empty-array case is the whole point
- `denyNotFound(res)` → 404, never 403, so ids cannot be enumerated

Rules when adding an endpoint:
1. List queries spread `ownerFilter(req.user)`.
2. Single-doc endpoints call `ownsDoc()` **and** put `ownerFilter` inside the write query itself.
3. Anything aggregating clicks scopes on `offerScopeMatch(await visibleOfferIds(req.user))`.
4. Any client-supplied ObjectId reference (advertiser, offerGroup) is validated as owned before save.

Exceptions, deliberate: tracking-domain list (shared resource), `/api/network-presets`
(static config), and the unauthenticated tracking endpoints `/click`, `/postback`, `/go/:slug`.

**Role migration** — `server/utils/migrateRoles.js` runs on every boot, BEFORE seeding and
before any login, mapping `super_admin|admin|manager → manager` and `viewer → partner`.
It must run first because login writes `lastLogin` via `save()`, which revalidates the
document — a stale role would fail the new enum and lock the owner out. It also promotes
the oldest account if no manager exists, since User Management is itself manager-only.

**How auth flows:**
```
User → POST /api/auth/login → JWT token → stored in localStorage
Every API call → Axios interceptor adds "Authorization: Bearer <token>"
Server → auth middleware verifies JWT → attaches user to req.user
401 response → Axios interceptor clears token → redirects to /login
```

Last verified: 2026-08-17

### 2. Offer Management (5-Step Wizard)

Offers are created through a 5-step Everflow-style wizard:

**Step 1 — General:** Name, status, advertiser (dropdown from Advertiser collection), category, currency, description, expiration date, labels, channels, app identifier, preview URL, internal notes

**Step 2 — Tracking:** Landing page URL, tracking domain (from TrackingDomain collection), linking type (redirect/direct), conversion method (server postback/JS SDK/iframe), offer visibility (public/requires_approval/private), terms content, frequency cap (ipCap / window / unique identifier), fallback URL, redirect mode (302/301/meta_refresh/javascript), caps (daily click, daily conversion, monthly, total)

**Step 3 — Revenue & Payout:** Base event name, revenue action (conversion/click/impression), revenue model (RPA/RPS/RPC/RPM), revenue amount, payout action, payout model (CPA/CPS/percent_revenue/CPC/CPM), payout amount, custom events with per-event revenue/payout, manual approval toggle, allow duplicate conversions, fire partner postback

**Step 4 — Attribution:** Attribution method (last_click/first_click), throttle rate, click-to-conversion window (value + unit: hours/days/months), email ownership, server-side click tracking

**Step 5 — Targeting:** Device types, operating systems (with min version), browsers, device brands, connection types, carriers, geo countries (include/exclude), regions, cities, ISP targeting, IP blocklist

**How offer data flows:**
```
OfferWizard.jsx → collects data across 5 steps → POST /api/offers
Server → validates → saves to MongoDB → returns offer with _id
Offer list → GET /api/offers?page=1&limit=25&status=active
Offer detail → GET /api/offers/:id (populated with advertiser name + tracking domain)
```

Last verified: 2026-08-17

### 3. Click Tracking

The core tracking engine. When traffic hits a tracking link, the system records everything about the visitor.

**Click flow (redirect-first pattern):**
```
Traffic → GET https://trackhive-ia0a.onrender.com/click?offer_id=xxx&sub1=campaign1
         ↓
Server receives request
         ↓
1. Find offer by ID (must be active)
2. Parse visitor info: IP, user agent, country (GeoIP), device, OS, browser
3. Generate unique click_id (UUID without dashes, 32 chars)
4. Replace macros in landing page URL: {click_id}, {sub1}, {country}, etc.
5. Frequency cap check — if ipCap > 0, check MongoDB for duplicate
   - Duplicate? Use fallbackUrl if set, otherwise redirect normally
6. REDIRECT IMMEDIATELY (302 or 301) — response sent to user in ~20ms
7. setImmediate() — all DB writes happen AFTER the redirect:
   a. Save Click document to MongoDB
   b. Update DailyStat counters (atomic $inc) — runs in parallel
   c. Increment offer.totalClicks — runs in parallel
```

This redirect-first pattern ensures the user never waits for DB writes. Even if MongoDB is slow, the redirect fires instantly.

**Tracking URL format:**
```
https://trackhive-ia0a.onrender.com/click?offer_id=OFFER_ID&sub1=SOURCE&sub2=CAMPAIGN&source=google
```

Or using a custom domain:
```
https://everflow.adslaunchigo.com/click?offer_id=OFFER_ID&sub1=SOURCE&sub2=CAMPAIGN&source=google
```

**Available macros in landing page URL:**
`{click_id}`, `{offer_id}`, `{sub1}`-`{sub5}`, `{source}`, `{ip}`, `{country}`, `{device}`, `{os}`, `{browser}`, `{user_agent}`, `{referer}`, `{timestamp}`

Last verified: 2026-08-17

### 4. Conversion Postback

When an advertiser's server fires a postback (conversion happened), TrackHive records the conversion and updates all stats. Supports both GET and POST methods.

**Postback flow:**
```
Advertiser server → GET /postback?click_id=xxx&revenue=10&payout=5&event=signup&secret=abc123
                   ↓
Server receives postback
                   ↓
1. Find Click by click_id (aliases: clickid, cid)
2. Verify postback secret (if advertiser has one set)
   - Missing or wrong secret → 403 {"error":"Invalid postback secret"}
3. Check click-to-conversion time window (if enabled on offer)
   - Expired → 410 {"error":"Conversion window expired","clickAge":"72 hours","maxWindow":"24 hours"}
4. Check if already converted (prevent duplicates)
   - Already converted → 409 {"error":"Already converted","conversionId":"conv_..."}
   - Exception: allowed if allowDuplicateConversions=true OR different event name
5. Calculate revenue and payout:
   - Check for matching event in offer.events[] (by eventId or name)
   - Fall back to offer-level revenueAmount / payoutAmount
   - Override with query params if provided
6. Update Click: converted=true, revenue, payout, profit, conversionEvent
   - Multi-event: accumulates revenue/payout/profit, appends event as comma-separated
7. Update Offer totals: totalConversions++, totalRevenue+=, totalPayout+=, totalProfit+=
8. Update DailyStat with conversion data
9. Check caps → create Notification if cap reached (90% warning + 100% alert) → send Telegram alert
   - If capBehavior === 'hard', auto-pause the offer on cap hit
10. Return { success: true, conversionId, clickId, event, txnId, revenue, payout, profit }
```

**Postback URL format (give this to advertisers):**
```
https://trackhive-ia0a.onrender.com/postback?click_id={click_id}&revenue={revenue}&payout={payout}&event={event}&secret=<secret>
```

**Parameter aliases accepted:**
| Parameter | Aliases |
|-----------|---------|
| `click_id` | `clickid`, `cid` |
| `revenue` | `amount` |
| `secret` | `token` |
| `event` | `goal` |
| `txn_id` | `transaction_id` |

**Secret verification logic:** Only enforced when the offer's advertiser has a non-empty `postbackSecret`. If no advertiser is linked to the offer, or the advertiser has no secret set, verification is skipped entirely. When enforced, both missing and incorrect secrets return 403.

Last verified: 2026-08-17

### 5. Advertiser Management

Advertisers are the companies/networks whose offers you're tracking.

- **CRUD operations** — create, list, update, delete advertisers
- **Postback secret** — auto-generated 32-char hex string per advertiser, can be regenerated
- **Network presets** — select from Impact, Everflow, Affise, Trackier, Cellxpert, or Custom — auto-sets click ID param and postback macros
- **Click ID parameter** — configurable per advertiser, determined by network preset (e.g. `subId1` for Impact, `sub1` for Everflow, `p1` for Trackier)
- **Contact info** — name, email for each advertiser
- **Linked to offers** — `Offer.advertiser` is an ObjectId ref to Advertiser
- **Detail page** — `/advertisers/:id` shows postback config, all linked offers with stats, and performance summary

Last verified: 2026-08-17

### 6. Advertiser Detail Page

Route: `/advertisers/:id`

API calls: `GET /api/advertisers/:id`, `GET /api/settings`, `GET /api/network-presets`

**What it shows:**
- **Header** — advertiser name, company, status badge, Edit and Delete buttons
- **General section** — Company/Brand, Network (color-coded badge like Impact=purple, Everflow=blue), Website (clickable link), Status, Contact Name, Contact Email, Notes
- **Postback Configuration** — Network badge, Click ID Param name, full Postback URL (built from tracking domain + network macros, with copy button), Postback Secret (show/hide toggle + copy + regenerate button)
- **Offers table** — all linked offers with columns: Name (link to offer detail), Status, Clicks, Conversions, Revenue, Payout, Profit
- **Performance sidebar** — Total Offers, Active Offers, Total Clicks, Total Conversions, Revenue, Payout, Profit, CR%
- **Details sidebar** — Advertiser ID (copyable), Created date, Updated date
- **Notes sidebar** — yellow card with advertiser notes if any
- **Edit modal** — inline editing for all advertiser fields

Last verified: 2026-08-17

### 7. Network Preset System

Single source of truth: `server/config/networkPresets.js`

Each preset defines `clickIdParam` (outgoing — the query param name used in the landing page URL when sending traffic to the advertiser) and `macros` (incoming — the macro tokens the advertiser substitutes in the postback URL they fire back to TrackHive).

**Outgoing — clickIdParam (in landing page URL):**
| Network | clickIdParam | Landing Page URL Example |
|---------|-------------|--------------------------|
| Impact | `subId1` | `https://tracking.impact.com/c/XXX?subId1={click_id}` |
| Everflow | `sub1` | `https://tracking.everflow.io/c/XXX?sub1={click_id}` |
| Affise | `sub1` | `https://offer.affise.com/c/XXX?sub1={click_id}` |
| Trackier | `p1` | `https://tracking.trackier.com/c/XXX?p1={click_id}` |
| Cellxpert | `xid` | `https://tracking.cellxpert.com/c/XXX?xid={click_id}` |
| Custom | `click_id` | `https://advertiser.com/lp?click_id={click_id}` |

**Incoming — postback macros (in postback URL the network fires back):**
| Network | click_id | revenue | payout | event | txn_id |
|---------|----------|---------|--------|-------|--------|
| Impact | `{SubId1}` | `{Amount}` | `{Payout}` | `{ActionTrackerName}` | `{ActionId}` |
| Everflow | `{transaction_id}` | `{sale_amount}` | `{payout}` | `{offer_id}` | `{conversion_id}` |
| Affise | `{clickid}` | `{sum}` | `{sum}` | `{goal}` | `{conversion_id}` |
| Trackier | `{click_id}` | `{sale_amount}` | `{payout}` | `{goal_value}` | `{txn_id}` |
| Cellxpert | `[clickid]` | `[amount]` | `[commission]` | `[eventtype]` | `[transactionid]` |
| Custom | `{click_id}` | `{revenue}` | `{payout}` | `{event}` | `{txn_id}` |

**Note:** Cellxpert uses **square brackets** `[ ]`, not curly braces `{ }`. Always use the values from this config — never hardcode macro syntax.

**Where to paste (per network):**
- Impact: Settings → Event Notifications → Action Life Cycle Events
- Everflow: Offer → Tracking → Postback URL
- Affise: Offer → Postbacks → Add postback
- Trackier: Publisher → Postback URL
- Cellxpert: Contact your affiliate manager
- Custom: Your advertiser's postback settings (verify macros match their docs)

`server/utils/postbackUrl.js` provides `buildPostbackUrl({ trackingDomain, network, secret })` which assembles the full postback URL using the correct macros for the advertiser's network.

Last verified: 2026-08-17

### 8. Frequency Cap (Per-IP Click Limiting)

MongoDB-based per-IP click cap — no Redis required.

**How it works:**
- `ipCap` on the Offer model: default `0` = unlimited (fast path — no DB query at all)
- When `ipCap > 0`, the system calls `checkDuplicate(Click, offer, visitor)` which runs `Click.countDocuments()` against a compound index `{ offerId: 1, ip: 1, clickedAt: -1 }`
- If the count of non-duplicate clicks within the time window >= cap, the click is marked as duplicate

**Configuration fields on Offer:**
| Field | Default | Description |
|-------|---------|-------------|
| `ipCap` | `0` | Max clicks per IP. 0 = unlimited |
| `ipCapWindow` | `'24h'` | Time window: `24h`, `48h`, `7d`, `30d`, `custom`, `forever` |
| `ipCapWindowHours` | `24` | Custom window in hours (used when ipCapWindow = `'custom'`) |
| `uniqueIdentifier` | `'ip_ua'` | How to identify unique visitors: `ip`, `ip_ua`, `ip_ua_ref` |
| `fallbackUrl` | (empty) | Used when `onDuplicate` is `fallback` |
| `onDuplicate` | `'block'` (new offers) | What happens once the cap is hit: `block`, `fallback`, or `redirect` |

**Why `ip_ua` is the default:** Mobile carriers like Jio and Airtel use CGNAT, where thousands of users share the same IP address. Using IP alone would falsely cap legitimate users. `ip_ua` (IP + User Agent) dramatically reduces false positives because each phone has a unique UA string.

**On-duplicate behaviour (`onDuplicate`):** Configurable per offer, in `server/utils/clickHelpers.js` (`resolveDuplicateAction`) and used by both `/click` (`clickController.js`) and `/go/:slug` (`smartLinkController.js`):
- `block` (default for new offers) — the visitor sees the shared "Access Restricted" page (`server/utils/blockedPage.js`), `HTTP 429`, `Cache-Control: no-store`, no TrackHive branding and no mention of *why* they were blocked. No redirect happens. The click is still logged (`isDuplicate: true, isBlocked: true, blockReason: 'frequency_cap'`) so blocks are visible in reporting.
- `fallback` — the click redirects to `offer.fallbackUrl`. If `onDuplicate` is `fallback` but `fallbackUrl` is empty, the system falls back to `block` and logs a console warning (`resolveDuplicateAction`).
- `redirect` — legacy behaviour: the click redirects to the normal offer URL, only marked `isDuplicate: true`.

**Dup vs. Invalid accounting:** A frequency-cap block is both `isDuplicate: true` and `isBlocked: true` on the Click document, but it counts **only** in **Dup. Clicks** in reporting — never in **Invalid Clicks**. Invalid Clicks stays reserved for bot/geo/device/IP blocks (the ones that set `isBlocked: true` for a reason other than `frequency_cap`). This is enforced in `server/utils/clickHelpers.js#updateDailyStats` (skips `blockedClicks` increment when `blockReason === 'frequency_cap'`) and in the raw-Click report aggregations in `reportController.js` (`INVALID_CLICKS_EXPR` excludes `blockReason: 'frequency_cap'`), so a block is never counted in both buckets at once. **Unique Clicks** excludes both — any duplicate (frequency-cap) AND any blocked click (bot/geo/device/ip/frequency-cap) are excluded from `uniqueClicks`, since a blocked visitor was never actually delivered to the offer (`UNIQUE_CLICKS_EXPR` in `reportController.js`, and the `!data.isDuplicate && !data.isBlocked` check in `updateDailyStats`).

**Migration:** Offers created before this feature don't have `onDuplicate` stored in Mongo. Run `npm run migrate:on-duplicate` (from `server/`) once after deploying — it sets `onDuplicate: 'redirect'` on every offer missing the field, preserving the pre-existing "always redirect" behaviour so live traffic isn't suddenly blocked. Only offers created after the migration default to `block`.

**Previous implementation removed:** The old `enableDuplicateFilter`, `uniqueSessionIdentifier`, `sessionDuration`, and `sessionDurationUnit` fields have been removed and replaced by this frequency cap system.

Last verified: 2026-08-17

### 9. Tracking Domain Management

Custom domains for tracking links, with DNS verification.

**Verification flow:**
```
User adds "everflow.adslaunchigo.com"
         ↓
User clicks "Verify"
         ↓
Server performs:
1. DNS A record lookup → get resolved IP
2. If no A record → try CNAME lookup → get resolved CNAME
3. HTTPS check → fetch https://domain → check if SSL works
4. Update TrackingDomain: status=verified/failed, sslActive, resolvedIP/CNAME
```

Last verified: 2026-08-17

### 10. Dashboard

Real-time overview of your tracking operation.

- **Summary cards** — total offers, active offers, today's clicks/conversions/revenue/profit, all-time totals
- **Chart** — 30-day trend line (clicks, conversions, revenue — switchable)
- **Top offers** — ranked by revenue, with click/conversion/profit columns
- **Recent clicks** — live feed of last 20 clicks with country, device, conversion status
- **Geo breakdown** — clicks by country (top 50)

Last verified: 2026-08-17

### 11. Reports (Everflow-Style)

Five dedicated report pages, each using a shared `ReportShell.jsx` component. Reports do **not** auto-load — the user sets filters and clicks **"Run Report"**. All endpoints return a unified response shape.

**Shared ReportShell layout:**
- Breadcrumb header ("Reports / Offer Report")
- Filter bar: date range (from/to), offer dropdown, per-report extras (status filter on Logs, search on Logs)
- **Run Report** button (blue, right-aligned) — nothing loads until clicked
- Collapsible summary cards grid (15 metrics, default open)
- Collapsible performance chart (Recharts LineChart — clicks, conversions, revenue, profit — default **closed**)
- Data table with sortable columns, expandable rows (Offer Report), sticky header, page number pagination
- CSV export button (appears after first run)

**Unified API response shape:**
```json
{
  "summary": {
    "grossClicks": 1000, "clicks": 950, "uniqueClicks": 800,
    "dupClicks": 100, "invalidClicks": 50, "totalCv": 25, "cv": 25,
    "cvr": "2.632", "cpc": "0.42", "cpa": "16.00",
    "rpc": "0.21", "rpa": "8.00",
    "revenue": "400.00", "payout": "200.00", "profit": "200.00",
    "margin": "50.000"
  },
  "chart": [{ "date": "2026-08-01", "clicks": 100, "conversions": 5, "revenue": 50.00, "profit": 25.00 }],
  "rows": [...],
  "pagination": { "page": 1, "limit": 50, "total": 150, "pages": 3 }
}
```

**Metric definitions:**
| Metric | Formula | Format |
|--------|---------|--------|
| Gross Clicks | All clicks including dup/blocked/bot | Number |
| Clicks | grossClicks − invalidClicks | Number |
| Unique | Non-duplicate clicks | Number |
| Dup | Duplicate clicks | Number |
| Invalid | Blocked clicks (bot + VPN + other blocks) | Number |
| CV | Conversion count | Number |
| CVR | conversions / clicks × 100 | 3 decimals % |
| CPC | revenue / clicks | 2 decimals $ |
| CPA | revenue / conversions | 2 decimals $ |
| RPC | profit / clicks | 2 decimals $ |
| RPA | profit / conversions | 2 decimals $ |
| Profit | revenue − payout | 2 decimals $ |
| Margin | profit / revenue × 100 | 3 decimals % |

Zero division = 0 for all rate metrics.

**Five reports:**

| Report | Route | Data Source | Key Columns | Special |
|--------|-------|-------------|-------------|---------|
| Conversion | `/reports/conversion` | Click (converted:true) | Timestamp, Offer, Event, Click ID, Country, Device, Source, Revenue, Payout, Profit | Individual conversion rows |
| Offer | `/reports/offer` | DailyStat grouped by offerId | Offer, Gross, Clicks, Uniq, Dup, Invalid, CV, CVR, Revenue, Payout, Profit, Margin | **Expandable rows** with byCountry + byDevice sub-tables |
| Daily | `/reports/daily` | DailyStat grouped by date | Date, Gross, Clicks, Uniq, Dup, Invalid, CV, CVR, Revenue, Payout, Profit, Margin | Standard day-by-day |
| Hourly | `/reports/hourly` | Click collection $group by hour | Hour, Gross, Clicks, Uniq, Dup, Invalid, CV, CVR, Revenue, Payout, Profit | **Max 7-day range**, timezone-aware via `$dateToString` |
| Logs | `/reports/logs` | Click collection (raw) | Timestamp, Offer, Status, Block Reason, IP, Country, Device, OS, Browser, Source, Sub1, Revenue, Payout, Profit | Status column shows **all** applicable badges together (e.g. BLOCKED + DUP for a frequency-cap block), status filter dropdown (All/Valid/Duplicates/Blocked/**Blocked by cap**/Bots/Converted), search by IP or Click ID |

**Sidebar navigation:** Reports dropdown shows exactly 5 items: Conversion, Offer, Daily, Hourly, Logs (icons: ArrowRightLeft, FileText, Calendar, Clock, ScrollText).

**CSV export:** Filename format: `<type>_<from>_to_<to>.csv`. Columns match the visible report columns. Export endpoint: `GET /api/reports/export?type=<conversion|offer|daily|hourly|log>&from=&to=&offer_id=`

Last verified: 2026-08-17

### 12. Smart Links

Vanity/slug-based tracking URLs with advanced traffic filtering.

**Smart Link URL format:**
```
https://trackhive-ia0a.onrender.com/go/my-offer-slug?sub1=source
```

Or with custom domain:
```
https://everflow.adslaunchigo.com/go/my-offer-slug?sub1=source
```

**Features:**
- **Slug-based routing** — `/go/:slug` maps to an offer with `smartLinkEnabled: true`
- **Bot detection** — 16 user-agent patterns (Googlebot, curl, wget, Selenium, Puppeteer, etc.)
- **VPN/proxy detection** — checks `x-forwarded-for`, `via`, `x-proxy-id`, `proxy-connection` headers
- **IP blocklist** — per-offer IP block list, checked on every click
- **GEO targeting** — whitelist/blacklist countries, redirects to fallback URL if blocked
- **Frequency cap** — MongoDB-based per-IP cap with configurable windows (24h, 48h, 7d, 30d, forever, custom)
- **Multiple redirect modes** — 302, 301, meta refresh, JavaScript redirect
- **Blocked page** — custom "Access Restricted" page when traffic is filtered
- **Fallback URL** — redirect duplicates/blocked traffic to a different URL
- **QR Code generation** — PNG, SVG, and data URL formats for smart link URLs

**Smart link flow:**
```
Traffic → GET /go/my-slug?sub1=facebook
         ↓
1. Find offer by smartLinkSlug (must be active + smartLinkEnabled)
2. Parse visitor info (IP, GeoIP, device, OS, browser)
3. Bot detection → block if detected
4. VPN detection → flag if detected
5. IP blocklist check → block if matched
6. GEO targeting check → fallback redirect if restricted
7. Frequency cap check (MongoDB) → handle based on offer config
8. Replace macros in landing page URL
9. Log click to MongoDB + update daily stats
10. Redirect user (302/301/meta/JS based on offer config)
```

Last verified: 2026-08-17

### 13. Middleware Order (Important)

Public tracking routes are mounted **before** all middleware in `server/index.js`. This is critical and must not be changed.

```
// FIRST — public tracking routes (no middleware)
app.use('/go',       smartLinkHandler);    // Smart link redirect
app.use('/click',    clickHandler);         // Click tracking + redirect
app.use('/postback', postbackHandler);      // Conversion postback (GET + POST)

// THEN — middleware stack
app.use(helmet(...));
app.use(cors(...));
app.use(mongoSanitize());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// THEN — rate-limited API routes
app.use('/api', apiLimiter);               // 200 req / 15 min
app.use('/api/auth/login', loginLimiter);   // 10 req / 15 min
app.use('/api/auth', authRoutes);
app.use('/api/offers', offerRoutes);
// ... other /api routes ...

// LAST — SPA catch-all (production only)
if (NODE_ENV === 'production') {
  app.use(express.static('client/dist'));
  app.get('*', (req, res) => {
    // Explicitly excludes /click, /postback, /go, /api from SPA shell
    if (p.startsWith('/click') || p.startsWith('/postback') || p.startsWith('/go/') || p.startsWith('/api'))
      return res.status(404).json({ error: 'Not found' });
    res.sendFile('client/dist/index.html');
  });
}
```

**Why this matters:** If tracking routes are placed after `helmet`, `cors`, `express.json`, or the rate limiter, two things break: (1) the rate limiter would throttle click/postback traffic from networks, and (2) the SPA catch-all in production would serve `index.html` for `/click` and `/postback`, causing tracking to silently fail and redirect to the login page. This has happened before — do not change the mount order.

The postback route (`routes/postback.js`) has its own local `express.json()` middleware on the POST handler, since the global body parser is mounted after it.

Last verified: 2026-08-17

### 14. Settings

- **General** — site name, timezone, currency, default redirect type, click ID param
- **Tracking** — default IP cap, bot detection, VPN detection, global postback URL
- **Telegram** — bot token, chat ID, alert types, test connection
- **Notifications** — email notification preferences, cap alert thresholds

Last verified: 2026-08-17

### 15. Notification System

In-app notification system for cap alerts, anomalies, and system events.

- **Notification types** — `cap_alert`, `conversion_spike`, `offer_expired`, `offer_paused`, `system`, `anomaly`
- **Severity levels** — `info`, `warning`, `error`, `success`
- **Per-user read tracking** — each notification tracks which users have read it
- **Unread count** — real-time unread badge in UI
- **Auto-generated** — postback handler creates notifications when caps are reached (90% warning + 100% alert)
- **Telegram forwarding** — notifications also sent to Telegram if configured

Last verified: 2026-08-17

### 16. Activity Logging (Audit Trail)

Tracks all significant user actions for accountability and debugging.

- **19 action types** — login, login_failed, user/offer/report/template/group CRUD, bulk_import, settings_changed
- **7 entity types** — user, offer, report, settings, template, group, system
- **Field-level change tracking** — stores `{field, from, to}` diffs for edits
- **IP logging** — records the IP address of each action
- **Search & filter** — by action, entity type, user, date range, text search
- **Paginated API** — filterable and sortable activity feed

Last verified: 2026-08-17

### 17. Offer Templates

Save and reuse offer configurations as templates.

- **Create from offer** — save any offer's config as a reusable template (strips runtime data like stats, slug, name)
- **Apply to new offer** — load template data to pre-fill the 5-step wizard
- **CRUD operations** — create, list, get, update, delete templates
- **Activity logged** — template creation and deletion tracked in audit trail

Last verified: 2026-08-17

### 18. Offer Groups

Group multiple offers together for combined management and reporting.

- **Group creation** — name, description, color tag, min 2 offers per group
- **Group-level caps** — daily and monthly conversion caps across all offers in group
- **Aggregated stats** — combined clicks, conversions, revenue, payout, profit across group
- **Group reports** — date-range reporting with DailyStat aggregation for all offers in group
- **Activity logged** — group CRUD tracked in audit trail

Last verified: 2026-08-17

### 19. Telegram Integration

Real-time alerts via Telegram bot.

- **Bot configuration** — bot token + chat ID, stored securely in Settings
- **Masked display** — bot token shown as `••••••XXXX` in UI for security
- **Alert types** — configurable which alert types are sent (cap, spike, etc.)
- **Test connection** — send test message to verify bot setup
- **Auto-alerts** — cap reached, conversion spike, and other notifications forwarded to Telegram
- **Message format** — formatted with Markdown, includes offer name and alert details

Last verified: 2026-08-17

---

## Database Schema (MongoDB)

### User
```
name, email (unique, lowercase), password (bcrypt hashed, min 8 chars),
role (super_admin|admin|manager|viewer, default: viewer),
status (active|inactive, default: active),
offerAccess (all|specific, default: all), allowedOffers [→ Offer],
notificationPrefs { emailOnNewReport, emailOnCapAlert, emailOnOfferChange },
lastLogin, createdBy (→ User)
```
Indexes: `{ role: 1, status: 1 }`

### Offer
```
// Step 1 — General
name (required, trimmed), slug (unique, auto-generated from name),
status (active|paused|draft|expired|deleted, default: draft),
advertiser (→ Advertiser), category, currency (USD|EUR|GBP|INR|AUD|CAD|BRL|NZD),
thumbnail, offerGroup (→ OfferGroup), labels[], appIdentifier, previewUrl,
internalNotes, channels[], hasExpiration, expirationDate, description

// Step 2 — Tracking
landingPageUrl, trackingDomain (→ TrackingDomain),
linkingType (redirect|direct), conversionTrackingMethod (server_postback|javascript_sdk|iframe_pixel),
supportDeepLinks, enableCaps, dailyClickCap, dailyConversionCap, monthlyConversionCap, totalCap,
offerVisibility (public|requires_approval|private), enableTerms, termsContent,
ipCap (default 0, min 0), ipCapWindow (24h|48h|7d|30d|custom|forever),
ipCapWindowHours (default 24), uniqueIdentifier (ip|ip_ua|ip_ua_ref, default: ip_ua),
fallbackUrl, redirectMode (302|301|meta_refresh|javascript)

// Step 3 — Revenue & Payout
baseEventName, firePartnerPostback, manualApproveConversions, allowDuplicateConversions,
revenueAction (conversion|click|impression), revenueType (RPA|RPS|RPC|RPM), revenueAmount,
revenuePricePerProduct,
payoutAction (conversion|click|impression), payoutType (CPA|CPS|percent_revenue|CPC|CPM), payoutAmount,
payoutPricePerProduct, events [{name, revenueType, revenueAmount, payoutType, payoutAmount}]

// Step 4 — Attribution
attributionMethod (last_click|first_click), enableThrottle, throttleRate,
enableClickToConversionTime, clickToConversionValue (default: 24),
clickToConversionUnit (hours|days|months), enableEmailOwnership, enableServerSideClick

// Step 5 — Targeting
deviceTypes[], operatingSystems[], osVersionMin, browsers[], deviceBrands[],
connectionTypes[], carriers[],
geoCountries[], geoMode (include|exclude), geoRegions[], geoCities[], geoISP[],
enableIPBlock, ipBlocklist (newline-separated IPs)

// Legacy compat
offerUrl, affiliateUrl, network

// Computed totals
totalClicks, totalConversions, totalRevenue, totalPayout, totalProfit

// Meta
createdBy (→ User), timestamps (createdAt, updatedAt)
```
Indexes: `{ status: 1 }`, `{ category: 1, status: 1 }`, `{ advertiser: 1 }`, `{ geoCountries: 1 }`, `{ labels: 1 }`, `{ createdAt: -1 }`, text index on `{ name, description }`

### Click
```
clickId (unique), offerId (→ Offer), offerName,
ip, userAgent, referer, country, region, city, device, os, browser, connectionType, isp,
subId1 (indexed), subId2, subId3, subId4, subId5, source,
isSmartLink, smartLinkSlug, uniqueHash,
isBot, isVpn, isDuplicate, isBlocked, blockReason,
converted, conversionId, conversionAt, revenue, payout, profit, conversionEvent,
redirectUrl, redirectType, responseTimeMs,
clickedAt (default: Date.now)
```
Indexes: `{ clickId: 1 }` (unique), `{ offerId: 1 }`, `{ ip: 1 }`, `{ subId1: 1 }`, `{ clickedAt: 1 }`, `{ offerId: 1, clickedAt: -1 }`, `{ offerId: 1, ip: 1, clickedAt: -1 }`, `{ clickedAt: -1 }`, `{ converted: 1, conversionAt: -1 }`

### DailyStat
```
date (String, YYYY-MM-DD), offerId (→ Offer), offerName,
clicks, uniqueClicks, conversions, revenue, payout, profit,
blockedClicks, botClicks, duplicateClicks,
byCountry (Map), byDevice (Map), byBrowser (Map), byOs (Map), bySource (Map), bySubId (Map),
cr (conversion rate), epc (earnings per click), rpc (revenue per click)
```
Indexes: `{ date: 1, offerId: 1 }` (unique compound), `{ offerId: 1, date: -1 }`, `{ date: -1 }`

### Advertiser
```
name (required, trimmed), company, website,
status (active|inactive, default: active),
postbackSecret (auto-generated: crypto.randomBytes(16).toString('hex')),
network (impact|everflow|affise|trackier|cellxpert|custom, default: custom),
clickIdParam (default: 'click_id', trimmed),
contactName, contactEmail, notes,
createdBy (→ User)
```
Indexes: `{ name: 1 }`, `{ status: 1 }`

### TrackingDomain
```
domain (unique), status (pending|verified|failed), sslActive,
verifiedAt, verificationError, resolvedIP, resolvedCname
```

### Notification
```
type (cap_alert|conversion_spike|offer_expired|offer_paused|system|anomaly),
title, message, severity (info|warning|error|success),
offerId (→ Offer), offerName, data (mixed),
readBy [→ User], createdAt
```

### ActivityLog
```
userId (→ User), userName,
action (19 enum values: user_login, offer_created, settings_changed, etc.),
entityType (user|offer|report|settings|template|group|system),
entityId, entityName,
details (mixed), changes [{field, from, to}], ip
```

### OfferGroup
```
name, description, offers [→ Offer], color (#hex),
dailyCap, monthlyCap, createdBy (→ User)
```

### OfferTemplate
```
name, description, templateData (mixed — offer config without runtime fields),
createdBy (→ User)
```

Last verified: 2026-08-17

---

## API Endpoints

### Public (no auth required)
```
GET  /click?offer_id=xxx&sub1=...             → Click tracking + redirect
GET  /click/api/list?offer_id=&from=&to=      → Click list (auth required)
GET  /click/api/:clickId                       → Single click detail (auth required)
GET  /postback?click_id=xxx&revenue=...        → Conversion postback (S2S)
POST /postback                                 → Conversion postback (POST — for Impact, etc.)
GET  /go/:slug                                 → Smart link redirect
```

### Auth
```
POST /api/auth/signup                    → Register new user (viewer role)
POST /api/auth/login                     → Login → returns JWT
GET  /api/auth/me                        → Get current user
PUT  /api/auth/change-password           → Change password
```

### Offers
```
GET    /api/offers                       → List (paginated, filterable)
GET    /api/offers/:id                   → Get single offer
POST   /api/offers                       → Create offer
PUT    /api/offers/:id                   → Update offer
DELETE /api/offers/:id                   → Delete offer
POST   /api/offers/:id/duplicate         → Duplicate offer
```

### Advertisers
```
GET    /api/advertisers                  → List all
GET    /api/advertisers/:id              → Get single (with linked offers + stats)
POST   /api/advertisers                  → Create
PUT    /api/advertisers/:id              → Update
DELETE /api/advertisers/:id              → Delete
POST   /api/advertisers/:id/regenerate-secret → New postback secret
```

### Tracking Domains
```
GET    /api/tracking-domains             → List all
POST   /api/tracking-domains             → Add domain
POST   /api/tracking-domains/:id/verify  → DNS + SSL verification
DELETE /api/tracking-domains/:id         → Remove domain
```

### Network Presets
```
GET    /api/network-presets              → Get all network macro configs (public — no auth)
```

### Dashboard
```
GET  /api/dashboard/summary              → Stats overview
GET  /api/dashboard/chart                → Chart data (30 days)
GET  /api/dashboard/top-offers           → Top offers by revenue
GET  /api/dashboard/recent-clicks        → Last 20 clicks
GET  /api/dashboard/geo                  → Geo breakdown
```

### Reports
```
GET  /api/reports/conversion             → Conversion report (individual conversions)
GET  /api/reports/offer                  → Offer report (grouped by offer, with expand data)
GET  /api/reports/daily                  → Daily report (day-by-day breakdown)
GET  /api/reports/hourly                 → Hourly report (from Click, max 7 days, timezone-aware)
GET  /api/reports/log                    → Log report (raw clicks with status filters)
GET  /api/reports/export?type=<type>     → CSV download (type: conversion|offer|daily|hourly|log)
POST /api/reports/bulk-import            → CSV bulk import (stub — coming soon)
POST /api/reports/bulk-confirm           → Confirm bulk import
GET  /api/reports/import-template        → Download import template CSV
```

**Common query params for all report endpoints:**
| Param | Default | Description |
|-------|---------|-------------|
| `from` | 30 days ago | Start date (YYYY-MM-DD) |
| `to` | today | End date (YYYY-MM-DD) |
| `offer_id` | (all) | Filter by offer |
| `sort` | varies | Sort field, prefix `-` for descending |
| `page` | 1 | Page number |
| `limit` | 50 | Rows per page (max 200, hourly max 500) |

**Hourly-specific params:** `timezone` (default: UTC) — passed to `$dateToString` for proper hour grouping.
**Log-specific params:** `status` (all|valid|duplicates|blocked|bots|converted), `search` (IP or clickId regex).

### Users (admin only)
```
GET    /api/users                        → List users
POST   /api/users                        → Create user
PUT    /api/users/:id                    → Update user (change role, status)
DELETE /api/users/:id                    → Delete user
```

### Settings
```
GET  /api/settings                       → Get all settings
PUT  /api/settings/:key                  → Update single setting
PUT  /api/settings/bulk                  → Update multiple settings
```

### Smart Links
```
GET  /go/:slug                           → Public smart link redirect (with filtering)
GET  /api/smart-links/:offerId/qr        → Generate QR code (PNG/SVG)
GET  /api/smart-links/:offerId/qr/dataurl → QR as base64 data URL
```

### Notifications
```
GET    /api/notifications                → List notifications (paginated, filterable)
GET    /api/notifications/unread-count   → Get unread count
PUT    /api/notifications/:id/read       → Mark single as read
PUT    /api/notifications/read-all       → Mark all as read
DELETE /api/notifications/:id            → Delete notification
```

### Activity Log
```
GET  /api/activity                       → List activity logs (filterable by action, entity, user, date, search)
```

### Offer Templates
```
GET    /api/templates                    → List all templates
GET    /api/templates/:id                → Get single template
POST   /api/templates                    → Create template from offer config
PUT    /api/templates/:id                → Update template
DELETE /api/templates/:id                → Delete template
```

### Offer Groups
```
GET    /api/offer-groups                 → List all groups (with offer names)
GET    /api/offer-groups/:id             → Get group with aggregated stats
POST   /api/offer-groups                 → Create group (min 2 offers)
PUT    /api/offer-groups/:id             → Update group
DELETE /api/offer-groups/:id             → Delete group
GET    /api/offer-groups/:id/report      → Group performance report (date range)
```

### Telegram
```
GET  /api/telegram/settings              → Get Telegram config (token masked)
PUT  /api/telegram/settings              → Save bot token, chat ID, alert types
POST /api/telegram/test                  → Send test message
```

Last verified: 2026-08-17

---

## Security

- **Helmet** — sets security headers (CSP, HSTS, X-Frame-Options, etc.)
- **Rate limiting** — 200 requests/15min for API, 10 requests/15min for login
- **Mongo sanitize** — prevents NoSQL injection via express-mongo-sanitize
- **Password hashing** — bcrypt with 12 salt rounds
- **JWT expiry** — 24 hours default, 30 days with "remember me"
- **Input validation** — Zod schemas for login/signup
- **Role-based access** — `authorize()` normalizes the stored role first, so a pre-migration
  role string resolves instead of failing every check; `requireManager` guards the admin routes
- **Per-owner data isolation** — every authenticated endpoint is scoped by `createdBy` via
  `server/utils/scope.js`; no role sees another user's offers, advertisers, clicks or reports
- **404 over 403** — a document you do not own returns "not found", so ids cannot be enumerated
- **Reference validation** — an offer cannot point at an advertiser or offer group you do not own
  (`assertRefsOwned`), which otherwise leaked the advertiser's `postbackSecret` and enabled
  forged conversions
- **Settings allow-list** — `PARTNER_WRITABLE_SETTING_KEYS` (currently empty). Settings are one
  account-wide document, so a deny-list was unsafe: it let a partner rewrite `timezone`,
  `globalPostbackUrl` and the `default*` offer seeds
- **Offer-level ACL** — users with `offerAccess: 'specific'` are narrowed further within their own offers
- **XSS sanitization** — offer name, description, notes sanitized via `xss` library before save
- **Postback secret** — per-advertiser secret required for conversion postbacks (when configured)
- **Bot detection** — 16 user-agent patterns block automated traffic on smart links (Googlebot, curl, Selenium, Puppeteer, etc.)
- **VPN/proxy detection** — checks forwarded headers to flag proxy traffic on smart links
- **IP blocklist** — per-offer IP blocking with exact match support on smart links
- **GEO targeting** — whitelist/blacklist country filtering on smart links
- **Frequency cap** — per-IP click limiting via MongoDB (configurable window + unique identifier)

Last verified: 2026-08-17

---

## Environment Variables

```env
# Required
MONGODB_URI=mongodb+srv://...          # MongoDB Atlas connection string
JWT_SECRET=your-secret-key             # JWT signing secret (min 32 chars recommended)
ADMIN_EMAIL=admin@example.com          # Super Admin email (seeded on first run)
ADMIN_PASSWORD=securepassword          # Super Admin password (min 8 chars)

# Optional
NODE_ENV=production                    # Enables static file serving from client/dist
PORT=3050                              # Server port (default: 3050)
CLIENT_URL=https://your-domain.com     # CORS origin (default: http://localhost:5173)
TRUST_PROXY=1                          # Trust proxy level for Render/Nginx (default: 1)
VITE_API_URL=https://api-url.com       # Frontend API base URL (only for separate deployments)
```

**Note on TRUST_PROXY:** `app.set('trust proxy', Number(process.env.TRUST_PROXY || 1))` is set in `index.js`. This is required when running behind Render's load balancer or an Nginx reverse proxy — without it, `req.ip` returns the proxy's IP instead of the visitor's real IP, breaking GeoIP lookup and frequency cap.

Last verified: 2026-08-17

---

## How to Run Locally

```bash
# 1. Clone
git clone https://github.com/AdsLaunchIGo/TrackHive.git
cd TrackHive

# 2. Create .env in root
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=any-random-string-32-chars
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin@123

# 3. Install dependencies
cd server && npm install
cd ../client && npm install

# 4. Run both
cd .. && npm run dev
# Or separately:
# Terminal 1: cd server && npm run dev:server
# Terminal 2: cd client && npm run dev:client

# 5. Open http://localhost:5173
```

Last verified: 2026-08-17

---

## Production Deployment (Render)

Single Web Service — backend serves frontend.

- **Build Command:** `cd server && npm install && cd ../client && NODE_ENV=development npm install && npm run build`
- **Start Command:** `cd server && node index.js`
- **Render URL:** https://trackhive-ia0a.onrender.com
- **Custom Domain:** https://everflow.adslaunchigo.com (CNAME pointing to Render)

Both URLs work — the custom domain is just a vanity alias. Use whichever in tracking links, but be consistent per advertiser because cookies and CORS are domain-scoped.

See `DEPLOY-GUIDE.md` for full step-by-step instructions.

Last verified: 2026-08-17

---

## How Tracking Works End-to-End

```
1. You create an Offer in TrackHive with a landing page URL
   Example: https://advertiser.com/signup?click_id={click_id}&sub1={sub1}

2. TrackHive generates a tracking link:
   https://trackhive-ia0a.onrender.com/click?offer_id=abc123&sub1=facebook&sub2=campaign1

3. You send traffic to this link (Facebook ads, Google ads, etc.)

4. User clicks the link → TrackHive:
   - Parses visitor info (IP, country, device, browser, source)
   - Generates a unique click_id (32-char hex)
   - Checks frequency cap (if ipCap > 0)
   - Replaces macros in the landing page URL
   - 302 redirects IMMEDIATELY to: https://advertiser.com/signup?click_id=xyz789&sub1=facebook
   - DB writes happen in background via setImmediate()

5. User converts on advertiser's site (signs up, buys, etc.)

6. Advertiser's server fires postback:
   GET https://trackhive-ia0a.onrender.com/postback?click_id=xyz789&revenue=10&payout=5&event=signup&secret=<secret>

7. TrackHive:
   - Verifies postback secret (if advertiser has one)
   - Checks click-to-conversion window (if enabled)
   - Finds the click by click_id
   - Records the conversion with revenue/payout/profit
   - Updates offer totals and daily stats
   - Checks caps → sends alerts if needed

8. You see everything in your Dashboard and Reports
```

Last verified: 2026-08-17

---

## Integration with Affiliate Networks

TrackHive connects with affiliate networks via postback URLs. Network presets in `server/config/networkPresets.js` handle the macro mapping automatically.

### Example: Impact.com

**Step 1 — Create advertiser in TrackHive:**
Set network to "Impact". The system auto-sets `clickIdParam: 'subId1'` and configures Impact-specific macros.

**Step 2 — Create offer in TrackHive:**
Set the Landing Page URL to Impact's tracking link, passing TrackHive's click_id via the correct param:
```
https://impact-tracking-link.com/c/XXXXX?subId1={click_id}
```

**Step 3 — Set postback in Impact:**
Copy the postback URL from the Advertiser Detail page (it's auto-built with correct macros), or manually construct:
```
https://trackhive-ia0a.onrender.com/postback?click_id={SubId1}&revenue={Amount}&payout={Payout}&event={ActionTrackerName}&secret=<secret>
```
In Impact dashboard → Settings → Event Notifications → Action Life Cycle Events.

**Flow:**
```
1. User clicks TrackHive link → click_id generated (e.g. abc123def456...)
2. User redirected to Impact with subId1=abc123def456
3. User converts on advertiser site
4. Impact fires postback → /postback?click_id=abc123def456&revenue=50&payout=30&secret=<secret>
5. TrackHive verifies secret, records conversion → visible in Dashboard + Reports
```

**Other networks:** Same pattern — the Advertiser Detail page shows the complete postback URL with the correct macros for the selected network. See the Network Preset table above for per-network macro mappings.

Last verified: 2026-08-17

---

## URL Macros Reference

Available macros for Landing Page URL (replaced at click time):

| Macro | Replaced With |
|-------|--------------|
| `{click_id}` | Unique click identifier (32-char hex) |
| `{offer_id}` | Offer's MongoDB ObjectId |
| `{sub1}` - `{sub5}` | Sub ID tracking parameters |
| `{source}` | Traffic source |
| `{ip}` | Visitor's IP address |
| `{country}` | 2-letter country code (GeoIP) |
| `{device}` | Device type (desktop/mobile/tablet) |
| `{os}` | Operating system name |
| `{browser}` | Browser name |
| `{user_agent}` | URL-encoded user agent string |
| `{referer}` | URL-encoded referrer |
| `{timestamp}` | Unix timestamp (milliseconds) |

Last verified: 2026-08-17

---

## Testing the Tracking Flow

Run these 7 tests after every deploy to verify the tracking pipeline is working. Each test builds on the previous one. Use a real offer ID and secret from your instance.

**Setup:** Create a test offer with this landing page URL so you can see replaced macros:
```
https://httpbin.org/get?click_id={click_id}&sub1={sub1}&country={country}
```
(If httpbin returns 503, the replaced macros are still visible in the browser URL bar — the page doesn't need to load.)

**Test 1 — Click tracking:**
```
GET /click?offer_id=<offer_id>&sub1=test_campaign
```
Expected: 302 redirect to httpbin with macros replaced — `click_id` is a 32-char hex string, `sub1=test_campaign`, `country` is your 2-letter code. Copy the `click_id` from the URL for the next tests.

**Test 2 — Successful conversion:**
```
GET /postback?click_id=<click_id>&revenue=10&payout=5&event=signup&secret=<secret>
```
Expected: `{"success":true,"conversionId":"conv_...","clickId":"...","event":"signup","revenue":10,"payout":5,"profit":5}`

**Test 3 — Wrong secret:**
```
GET /postback?click_id=<click_id>&revenue=10&payout=5&secret=wrong_secret
```
Expected: `{"error":"Invalid postback secret"}`

**Test 4 — Missing secret:**
```
GET /postback?click_id=<click_id>&revenue=10&payout=5
```
Expected: `{"error":"Invalid postback secret"}` (same error — empty string doesn't match the stored secret)

**Test 5 — Amount alias:**
```
GET /postback?click_id=<click_id>&amount=15&payout=8&secret=<secret>
```
Expected: `{"success":true,...,"revenue":15,...}` — `amount` maps to the `revenue` field.

**Test 6 — Duplicate conversion:**
```
GET /postback?click_id=<click_id>&revenue=10&payout=5&secret=<secret>
```
(Use the same click_id that was already converted in Test 2)
Expected: `{"error":"Already converted","conversionId":"conv_..."}`

**Test 7 — Fake click_id:**
```
GET /postback?click_id=does_not_exist&revenue=10&payout=5&secret=<secret>
```
Expected: `{"error":"Click not found"}`

**Important notes:**
- Tests 3, 4, 5, and 7 each need a fresh click (run Test 1 again) because a click can only convert once (Test 6 is the exception — it intentionally reuses a converted click).
- Secret verification only applies when the offer's advertiser has a `postbackSecret` set. If no advertiser is linked, tests 3 and 4 will succeed instead of failing.
- The `txn_id` / `transaction_id` parameter is accepted and echoed back in the response but not stored on the Click document.

Last verified: 2026-08-17

---

## Known Limitations

### 1. One click = one conversion
The Click model stores conversion data directly on the click document (single `converted`, `revenue`, `payout`, `profit` fields). In iGaming, one user might register → make a first-time deposit → redeposit — three conversions from one click. Currently the second event with the same name returns `"Already converted"`. Multi-event works only if each event has a *different* name (events accumulate as comma-separated `conversionEvent`). **Fix:** A separate Conversion collection with unique `(clickId, event)` compound key would properly support multiple conversions per click.

### 2. Render free tier cold starts
Render's free tier spins down the service after inactivity. The first request after sleep takes 30-50 seconds. Affiliate networks typically timeout postbacks in 5-10 seconds, so conversions will be silently dropped during cold starts. **Before going to production:** upgrade to a paid Render instance, or set up a keep-alive cron that pings `/api/health` every 10 minutes.

### 3. Bot/VPN/geo/IP-blocklist/device targeting — FIXED, now shared between /click and /go/:slug
Previously only `/go/:slug` applied Step 5 targeting; `/click` ignored all of it. Both entry points now run the same synchronous filter chain via `server/utils/trafficFilter.js#applyFilters(offer, visitor, req)`:
1. Bot detection (`detectBot`) → `blockReason: 'bot'`
2. IP blocklist (`isIpBlocked`) → `blockReason: 'ip_blocked'`
3. Geo targeting (`checkGeoTarget`) → `blockReason: 'geo'`
4. Device/OS/Browser targeting (`checkDeviceTarget`, new — case-insensitive, empty array = no restriction on that dimension) → `blockReason: 'device'`
5. VPN (`detectVpn`) — flagged only (`isVpn`), never blocks. Behind Render's proxy/CDN, `x-forwarded-for` routinely has multiple IPs, so treating VPN as a hard block would false-positive on legitimate traffic.
6. Frequency cap — last, the only check that hits the DB (see Section 8).

A targeting block redirects to `offer.fallbackUrl` if set, otherwise shows the shared "Access Restricted" page (`403`). Either way it's logged `isBlocked: true` with the specific `blockReason`, and counts in **Invalid Clicks** (never in Unique Clicks) — see Section 8's Dup vs. Invalid accounting for how this differs from a frequency-cap block.

### 4. Click-to-conversion window — validated on postback
The `enableClickToConversionTime`, `clickToConversionValue`, and `clickToConversionUnit` fields on the Offer model are checked in `postbackController.handlePostback`. If the elapsed time between the click and the postback exceeds the configured window, the postback returns `410 {"error":"Conversion window expired"}`. This works correctly.

### 5. VPN detection false positives behind proxies
`detectVpn()` flags a request as VPN if `x-forwarded-for` contains a comma (multiple IPs) or if headers like `via`, `x-proxy-id`, `proxy-connection` are present. Behind a CDN or reverse proxy (which Render uses), these headers are routinely present. This means legitimate traffic through CDNs or corporate proxies may be falsely flagged as VPN on smart links.

### 6. checkGeoTarget field name mismatch — FIXED
`checkGeoTarget()` in `clickHelpers.js` used to read `offer.geoTargets` and check `geoMode === 'blacklist'`, neither of which exist on the Offer model (`geoCountries` / `'include'`|`'exclude'`), so geo targeting silently never applied on either `/click` or `/go/:slug`. Now reads the correct fields.

### 7. SubID/Country/Device standalone reports removed
The old SubID, Country, and Device standalone reports have been removed. Country and device breakdowns are now available as expand rows inside the Offer Report (per-offer byCountry + byDevice sub-tables from DailyStat Maps). The `bySubId`, `byCountry`, `byDevice`, `byBrowser`, `byOs`, `bySource` Maps in DailyStat are still populated by `updateDailyStats()` and available for future use.

Last verified: 2026-08-17

---

## Changelog — 2026-08-19

### Postback URL generation — was producing incomplete URLs
The URL was assembled by hand in four places (`server/utils/postbackUrl.js`,
`OfferDetail.jsx`, `AdvertiserDetail.jsx`, `Advertisers.jsx`) and the three the user
actually copies from all dropped `txn_id` and the preset's `extraParams`. A Katalys URL
therefore shipped without `{conversion_status}` and `{postback_operation}`, so refunds and
amount corrections never reached TrackHive. Now a single shared builder
(`client/src/utils/postbackUrl.js`) feeds all three pages, and the server builder emits
`txn_id`.

### Network presets — four latent click_id bugs
**The rule:** `macros.click_id` MUST be the network's token for the same parameter named in
`clickIdParam`. We send our id out as `?<clickIdParam>=<id>`; the only way to get it back is
for the network to echo that exact parameter. Breaking it is silent — the postback arrives,
the click lookup fails, and every conversion is lost with "click_id is required".

Four of seven presets broke it and were fixed against each network's published docs:

| Network | was | now |
|---|---|---|
| Everflow | `{transaction_id}` (Everflow's own id) | `{sub1}` |
| Affise | `{clickid}` (not a real Affise macro) | `{sub1}` |
| Trackier | `{click_id}` | `{p1}` |
| Cellxpert | `[clickid]` | `[xid]` |

Also added: `{Status}` (Impact) and `{status}` (Affise) so reversals are detected; a
per-network `lifecycle` block mapping each network's vocabulary (Katalys `delete`, Impact
`MODIFIED`, Affise numeric `3`) so adding a network never means editing the postback
controller; and `verified` / `docsUrl` flags — Trackier and Cellxpert are `verified: false`
and render an amber warning in the UI.

`server/config/validatePresets.js` enforces all of this at boot. A malformed preset aborts
startup rather than silently losing that network's conversions.

### Per-advertiser tracking domain
`Advertiser.trackingDomain` (optional ObjectId → TrackingDomain). The postback is registered
once per advertiser on the network side, so the domain in that URL has to be a deliberate
property of the advertiser — not an account default that drifts, and not "whichever verified
domain sorts first" once there are several. Resolution order lives in
`resolveAdvertiserDomain()`: advertiser's own → account default → first verified. Empty
falls back, so existing advertisers are unaffected.

This also fixed a live inconsistency: AdvertiserDetail read only `settings.trackingDomain`
while OfferDetail used the *offer's* domain for the postback URL, so the same advertiser
showed different URLs on different pages — and the Offer page's was wrong, because the
postback belongs to the advertiser.

### UI
- Reports: quick date ranges (Today / Yesterday / Last 2 days / Last 7 days / Custom).
  Picking one applies immediately; the calendar shows only under Custom; the highlight
  re-derives from the dates so manual edits stay honest.
- Refresh button on Reports, Manage Offers and Advertisers — reloads the list in place.
  The Reports one also reloads the Offer dropdown so a new offer appears without an F5.
- Logs: Click ID column, click-to-copy (needed for network postback test forms).
- Advertisers table: single-line names, sticky header, vertical scroll.

### Katalys — findings from live testing
- Test Connection lives at **Postbacks → open the postback → Test Connection**; it posts
  dummy data to the saved Target URL. Only `sub1` (→ `click_id`) and `Value` (→ `revenue`)
  matter to us.
- `{conversion_status}` returns a **number**, not `approved`/`success`. The numeric mapping
  is not published. Reversal detection therefore relies on `{postback_operation}`
  (`create`/`update`/`delete`), which is documented and reliable.
- `{sub1}` is **not** a Katalys token — the payload field must use `{aff_sub1}`.
- "Limit to Programs" left empty means the postback fires for **every** approved program,
  producing constant failures from conversions that never carried our click id. Repeated
  failures move the postback to Failed status and Katalys stops sending it.

### Known gap
A real end-to-end Katalys conversion has still not been verified. The `$7.19` attempt failed
with `400 click_id is required` because `{aff_sub1}` resolved empty. Everything downstream of
that (secret, POST body handling, revenue parsing, reversal) is confirmed working.

Last verified: 2026-08-19
