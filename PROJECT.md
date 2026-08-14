# TrackHive — Project Documentation

## What is TrackHive?

TrackHive is a self-hosted affiliate/performance marketing offer tracking platform, inspired by Everflow. It lets media buyers, affiliate networks, and performance marketers track clicks, conversions, and revenue across multiple offers, advertisers, and traffic sources — all from a single dashboard.

Think of it as your own private tracking system: you create offers, generate tracking links, send traffic through those links, and the system records every click, fires postbacks on conversions, and gives you real-time reporting with breakdowns by country, device, source, and more.

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
| Cache | Redis (optional — for IP cap dedup) |
| Auth | JWT (jsonwebtoken + bcrypt) |
| Hosting | Render (free tier compatible) |
| Icons | Lucide React |
| Charts | Recharts |

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
│       │   │   ├── Sidebar.jsx      # Navigation — Dashboard, Offers, Advertisers, Reports, Settings
│       │   │   └── TopBar.jsx       # Header — date, user info, logout
│       │   ├── offers/
│       │   │   ├── OfferWizard.jsx  # 5-step offer creation wizard (Everflow-style)
│       │   │   └── OfferForm.jsx    # Legacy form (unused, kept for reference)
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
│       │   ├── Advertisers.jsx      # Advertiser CRUD — name, company, postback secret
│       │   ├── TrackingDomains.jsx  # Tracking domain management with DNS verify
│       │   ├── Reports.jsx          # Report tabs — Offer, Daily, Country, Device, SubID
│       │   ├── ClickReport.jsx      # Click log — individual click records
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
│   │   └── redis.js                 # Redis connection (optional — skips if not configured)
│   ├── middleware/
│   │   ├── auth.js                  # JWT verification + role-based authorization
│   │   └── errorHandler.js          # Global error handler
│   ├── models/
│   │   ├── User.js                  # User — name, email, password (bcrypt), role, status
│   │   ├── Offer.js                 # Offer — 5-step wizard fields, tracking config, totals
│   │   ├── Advertiser.js            # Advertiser — name, company, postbackSecret (auto-generated)
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
│   │   ├── clickController.js       # Click tracking handler + click log API
│   │   ├── postbackController.js    # Conversion postback handler + cap alerts
│   │   ├── dashboardController.js   # Dashboard stats, chart data, top offers, geo
│   │   ├── reportController.js      # Reports — offer, daily, subID, geo, device, CSV export
│   │   ├── userController.js        # User CRUD (admin only)
│   │   ├── settingsController.js    # App settings get/update
│   │   ├── telegramController.js    # Telegram bot integration
│   │   └── ... (other controllers)
│   ├── routes/
│   │   ├── auth.js                  # POST /signup, POST /login, GET /me, PUT /change-password
│   │   ├── offers.js                # CRUD + POST /:id/duplicate
│   │   ├── advertisers.js           # CRUD + POST /:id/regenerate-secret
│   │   ├── trackingDomains.js       # GET /, POST /, POST /:id/verify, DELETE /:id
│   │   ├── click.js                 # GET /click?offer_id=xxx (public — no auth)
│   │   ├── postback.js              # GET /postback?click_id=xxx (public — no auth)
│   │   ├── dashboard.js             # Summary, chart, top offers, recent clicks, geo
│   │   ├── reports.js               # Offer, daily, subID, geo, device reports + CSV
│   │   └── ... (other routes)
│   └── utils/
│       ├── seedAdmin.js             # Seeds Super Admin from ADMIN_EMAIL + ADMIN_PASSWORD env vars
│       ├── clickHelpers.js          # Click ID generation, visitor parsing, bot/VPN detection, macros
│       ├── activityLogger.js        # Activity log utility
│       └── telegram.js              # Telegram bot message sender
│
├── package.json                     # Root — dev scripts, concurrently
├── ecosystem.config.js              # PM2 config for production
├── .gitignore                       # node_modules, .env, dist, logs
├── DEPLOY-GUIDE.md                  # Step-by-step GitHub + Render deployment
└── PROJECT.md                       # This file
```

---

## Core Features

### 1. Authentication & User Management

- **JWT-based auth** — login returns a token, stored in localStorage, sent as `Bearer` header on every API call
- **Self-registration** — anyone can sign up at `/signup`, gets `viewer` role by default
- **Role-based access** — 4 roles: `super_admin`, `admin`, `manager`, `viewer`
- **Super Admin seeding** — on first run, creates a Super Admin using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`
- **Offer-level access control** — users can be restricted to specific offers (`offerAccess: 'specific'`)

**How auth flows:**
```
User → POST /api/auth/login → JWT token → stored in localStorage
Every API call → Axios interceptor adds "Authorization: Bearer <token>"
Server → auth middleware verifies JWT → attaches user to req.user
401 response → Axios interceptor clears token → redirects to /login
```

### 2. Offer Management (5-Step Wizard)

Offers are created through a 5-step Everflow-style wizard:

**Step 1 — General:** Name, status, advertiser (dropdown from Advertiser collection), category, currency, description, expiration date, labels

**Step 2 — Tracking:** Landing page URL, tracking domain (from TrackingDomain collection), linking type (redirect/direct), conversion method (server postback/JS SDK/iframe), session settings, duplicate filtering, redirect mode (301/302/meta/JS), caps (daily click, daily conversion, monthly, total)

**Step 3 — Revenue & Payout:** Revenue model (RPA/RPS/RPC/RPM), revenue amount, payout model (CPA/CPS/percent/CPC/CPM), payout amount, custom events with per-event revenue/payout, manual approval toggle

**Step 4 — Attribution:** Attribution method (last click/first click), throttle rate, click-to-conversion window, email ownership, server-side click tracking

**Step 5 — Targeting:** Device types, operating systems, browsers, brands, connection types, carriers, geo countries (include/exclude), regions, cities, ISP targeting, IP blocklist

**How offer data flows:**
```
OfferWizard.jsx → collects data across 5 steps → POST /api/offers
Server → validates → saves to MongoDB → returns offer with _id
Offer list → GET /api/offers?page=1&limit=25&status=active
Offer detail → GET /api/offers/:id (populated with advertiser name + tracking domain)
```

### 3. Click Tracking

The core tracking engine. When traffic hits a tracking link, the system records everything about the visitor.

**Click flow:**
```
Traffic → GET https://everflow.adslaunchigo.com/click?offer_id=xxx&sub1=campaign1
         ↓
Server receives request
         ↓
1. Find offer by ID (must be active)
2. Parse visitor info: IP, user agent, country (GeoIP), device, OS, browser
3. Generate unique click_id (UUID)
4. Replace macros in offer URL: {click_id}, {sub1}, {country}, {device}, etc.
5. Save Click document to MongoDB
6. Update DailyStat counters (atomic $inc)
7. Increment offer.totalClicks
8. 302 redirect to offer's landing page URL
```

**Tracking URL format:**
```
https://everflow.adslaunchigo.com/click?offer_id=OFFER_ID&sub1=SOURCE&sub2=CAMPAIGN&source=google
```

**Available macros in offer URL:**
`{click_id}`, `{offer_id}`, `{sub1}`-`{sub5}`, `{source}`, `{ip}`, `{country}`, `{device}`, `{os}`, `{browser}`, `{user_agent}`, `{referer}`, `{timestamp}`

### 4. Conversion Postback

When an advertiser's server fires a postback (conversion happened), TrackHive records the conversion and updates all stats.

**Postback flow:**
```
Advertiser server → GET https://everflow.adslaunchigo.com/postback?click_id=xxx&payout=2.50
                    ↓
Server receives postback
                    ↓
1. Find Click by click_id
2. Check if already converted (prevent duplicates)
3. Find the Offer
4. Calculate revenue and payout:
   - Check for matching event (if event param provided)
   - Fall back to offer-level revenue/payout amounts
   - Override with query params if provided
5. Update Click: converted=true, revenue, payout, profit
6. Update Offer totals: totalConversions++, totalRevenue+=, totalPayout+=, totalProfit+=
7. Update DailyStat with conversion data
8. Check caps → create Notification if cap reached → send Telegram alert
9. Return { success: true, conversionId, revenue, payout, profit }
```

**Postback URL format (give this to advertisers):**
```
https://everflow.adslaunchigo.com/postback?click_id={click_id}&payout=2.50&event=signup
```

### 5. Advertiser Management

Advertisers are the companies/networks whose offers you're tracking.

- **CRUD operations** — create, list, update, delete advertisers
- **Postback secret** — auto-generated 32-char hex string per advertiser, can be regenerated
- **Click ID parameter** — configurable per advertiser (default: `click_id`)
- **Contact info** — name, email for each advertiser
- **Linked to offers** — Offer.advertiser is an ObjectId ref to Advertiser

### 6. Tracking Domain Management

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

### 7. Dashboard

Real-time overview of your tracking operation.

- **Summary cards** — total offers, active offers, today's clicks/conversions/revenue/profit, all-time totals
- **Chart** — 30-day trend line (clicks, conversions, revenue — switchable)
- **Top offers** — ranked by revenue, with click/conversion/profit columns
- **Recent clicks** — live feed of last 20 clicks with country, device, conversion status
- **Geo breakdown** — clicks by country (top 50)

### 8. Reports

Detailed analytics with date range filtering and CSV export.

| Report | Groups by | Metrics |
|--------|-----------|---------|
| Offer Report | Offer | Clicks, unique clicks, conversions, revenue, payout, profit, CR, EPC |
| Daily Report | Date | Same metrics, day-by-day |
| Country Report | Country | Clicks, conversions, revenue, payout, profit, CR |
| Device Report | Device/OS/Browser | Clicks, conversions, revenue |
| SubID Report | sub1-sub5 / source | Clicks, conversions, revenue, payout, profit, CR, EPC |
| Click Log | Individual clicks | Full click details — IP, UA, country, device, sub IDs, conversion |

### 9. Settings

- **General** — site name, timezone, currency, default redirect type, click ID param
- **Tracking** — default IP cap, bot detection, VPN detection, global postback URL
- **Telegram** — bot token, chat ID, alert types, test connection
- **Notifications** — email notification preferences, cap alert thresholds

### 10. Smart Links

Vanity/slug-based tracking URLs with advanced traffic filtering.

**Smart Link URL format:**
```
https://everflow.adslaunchigo.com/go/my-offer-slug?sub1=source
```

**Features:**
- **Slug-based routing** — `/go/:slug` maps to an offer with `smartLinkEnabled: true`
- **Bot detection** — 16 user-agent patterns (Googlebot, curl, wget, Selenium, Puppeteer, etc.)
- **VPN/proxy detection** — checks `x-forwarded-for`, `via`, `x-proxy-id`, `proxy-connection` headers
- **IP blocklist** — per-offer IP/CIDR block list, checked on every click
- **GEO targeting** — whitelist/blacklist countries, redirects to fallback URL if blocked
- **Duplicate/IP cap** — Redis-based dedup with configurable windows (24h, 48h, 7d, 30d, forever, custom)
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
7. Duplicate/IP cap check (Redis) → handle based on offer config
8. Replace macros in offer URL
9. Log click to MongoDB + update daily stats
10. Redirect user (302/301/meta/JS based on offer config)
```

### 11. Notification System

In-app notification system for cap alerts, anomalies, and system events.

- **Notification types** — `cap_alert`, `conversion_spike`, `offer_expired`, `offer_paused`, `system`, `anomaly`
- **Severity levels** — `info`, `warning`, `error`, `success`
- **Per-user read tracking** — each notification tracks which users have read it
- **Unread count** — real-time unread badge in UI
- **Auto-generated** — postback handler creates notifications when caps are reached (90% warning + 100% alert)
- **Telegram forwarding** — notifications also sent to Telegram if configured

### 12. Activity Logging (Audit Trail)

Tracks all significant user actions for accountability and debugging.

- **19 action types** — login, login_failed, user/offer/report/template/group CRUD, bulk_import, settings_changed
- **7 entity types** — user, offer, report, settings, template, group, system
- **Field-level change tracking** — stores `{field, from, to}` diffs for edits
- **IP logging** — records the IP address of each action
- **Search & filter** — by action, entity type, user, date range, text search
- **Paginated API** — filterable and sortable activity feed

### 13. Offer Templates

Save and reuse offer configurations as templates.

- **Create from offer** — save any offer's config as a reusable template (strips runtime data like stats, slug, name)
- **Apply to new offer** — load template data to pre-fill the 5-step wizard
- **CRUD operations** — create, list, get, update, delete templates
- **Activity logged** — template creation and deletion tracked in audit trail

### 14. Offer Groups

Group multiple offers together for combined management and reporting.

- **Group creation** — name, description, color tag, min 2 offers per group
- **Group-level caps** — daily and monthly conversion caps across all offers in group
- **Aggregated stats** — combined clicks, conversions, revenue, payout, profit across group
- **Group reports** — date-range reporting with DailyStat aggregation for all offers in group
- **Activity logged** — group CRUD tracked in audit trail

### 15. Telegram Integration

Real-time alerts via Telegram bot.

- **Bot configuration** — bot token + chat ID, stored securely in Settings
- **Masked display** — bot token shown as `••••••XXXX` in UI for security
- **Alert types** — configurable which alert types are sent (cap, spike, etc.)
- **Test connection** — send test message to verify bot setup
- **Auto-alerts** — cap reached, conversion spike, and other notifications forwarded to Telegram
- **Message format** — formatted with Markdown, includes offer name and alert details

---

## Database Schema (MongoDB)

### User
```
name, email, password (bcrypt hashed), role (super_admin|admin|manager|viewer),
status (active|inactive), offerAccess (all|specific), allowedOffers[], lastLogin
```

### Offer
```
// Step 1
name, slug (auto-generated), status, advertiser (→ Advertiser), category, currency, description

// Step 2
landingPageUrl, trackingDomain (→ TrackingDomain), conversionTrackingMethod,
dailyClickCap, dailyConversionCap, monthlyConversionCap, totalCap,
redirectMode (302|301|meta|JS), sessionDuration, duplicateFilter

// Step 3
revenueType (RPA|RPS|RPC|RPM), revenueAmount, payoutType (CPA|CPS|%|CPC|CPM),
payoutAmount, events[{name, revenueAmount, payoutAmount}]

// Step 4
attributionMethod, throttleRate, clickToConversionWindow

// Step 5
deviceTypes[], operatingSystems[], browsers[], geoCountries[], geoMode, ipBlocklist

// Computed totals
totalClicks, totalConversions, totalRevenue, totalPayout, totalProfit
```

### Click
```
clickId (unique), offerId (→ Offer), offerName,
ip, userAgent, country, region, city, device, os, browser,
subId1-5, source,
isBot, isVpn, isDuplicate, isBlocked, blockReason,
converted, conversionId, conversionAt, revenue, payout, profit,
redirectUrl, redirectType, responseTimeMs, clickedAt
```

### DailyStat
```
date (YYYY-MM-DD), offerId (→ Offer), offerName,
clicks, uniqueClicks, conversions, revenue, payout, profit,
blockedClicks, botClicks, duplicateClicks,
byCountry (Map), byDevice (Map), byBrowser (Map), byOs (Map), bySource (Map),
cr, epc, rpc
```

### Advertiser
```
name, company, website, status, postbackSecret (auto-generated hex),
clickIdParam, contactName, contactEmail, notes
```

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

---

## API Endpoints

### Public (no auth required)
```
GET  /click?offer_id=xxx&sub1=...        → Click tracking + redirect
GET  /postback?click_id=xxx&payout=...   → Conversion postback
GET  /go/:slug                           → Smart link redirect
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
GET    /api/advertisers/:id              → Get single
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
GET  /api/reports/offers                 → Offer performance report
GET  /api/reports/daily                  → Daily breakdown
GET  /api/reports/sub-id                 → SubID/source report
GET  /api/reports/geo                    → Country report
GET  /api/reports/device                 → Device/OS/browser report
GET  /api/reports/export                 → CSV download
```

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

---

## Security

- **Helmet** — sets security headers (CSP, HSTS, X-Frame-Options, etc.)
- **Rate limiting** — 200 requests/15min for API, 10 requests/15min for login
- **Mongo sanitize** — prevents NoSQL injection via express-mongo-sanitize
- **Password hashing** — bcrypt with 12 salt rounds
- **JWT expiry** — 24 hours default, 30 days with "remember me"
- **Input validation** — Zod schemas for login/signup
- **Role-based access** — middleware checks `req.user.role` against allowed roles
- **Offer-level ACL** — users with `offerAccess: 'specific'` only see their assigned offers
- **XSS sanitization** — offer name, description, notes sanitized via `xss` library before save
- **Bot detection** — 16 user-agent patterns block automated traffic (Googlebot, curl, Selenium, Puppeteer, etc.)
- **VPN/proxy detection** — checks forwarded headers to flag proxy traffic
- **IP blocklist** — per-offer IP blocking with exact match support
- **GEO targeting** — whitelist/blacklist country filtering on click tracking
- **Duplicate click prevention** — Redis-based IP cap with configurable time windows

---

## Environment Variables

```env
# Required
MONGODB_URI=mongodb://...          # MongoDB connection string
JWT_SECRET=your-secret-key         # JWT signing secret (min 32 chars recommended)
ADMIN_EMAIL=admin@example.com      # Super Admin email (seeded on first run)
ADMIN_PASSWORD=securepassword      # Super Admin password (min 8 chars)

# Optional
NODE_ENV=production                # Enables static file serving
PORT=3050                          # Server port (default: 3050)
CLIENT_URL=https://your-domain.com # CORS origin
REDIS_HOST=redis-hostname          # Redis host (skip for no Redis)
REDIS_PORT=6379                    # Redis port
REDIS_PASSWORD=                    # Redis password
REDIS_URL=redis://...              # Alternative: full Redis URL
VITE_API_URL=https://api-url.com   # Frontend API base URL (only for separate deployments)
```

---

## How to Run Locally

```bash
# 1. Clone
git clone https://github.com/ruchiyadav-bit/TrackHive.git
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
# Terminal 1: cd server && npm run dev
# Terminal 2: cd client && npm run dev

# 5. Open http://localhost:5173
```

---

## Production Deployment (Render)

Single Web Service — backend serves frontend.

- **Build Command:** `cd server && npm install && cd ../client && NODE_ENV=development npm install && npm run build`
- **Start Command:** `cd server && node index.js`
- **Live URL:** https://everflow.adslaunchigo.com

See `DEPLOY-GUIDE.md` for full step-by-step instructions.

---

## How Tracking Works End-to-End

```
1. You create an Offer in TrackHive with a landing page URL
   Example: https://advertiser.com/signup?click_id={click_id}&sub1={sub1}

2. TrackHive generates a tracking link:
   https://everflow.adslaunchigo.com/click?offer_id=abc123&sub1=facebook&sub2=campaign1

3. You send traffic to this link (Facebook ads, Google ads, etc.)

4. User clicks the link → TrackHive:
   - Records the click (IP, country, device, browser, source)
   - Generates a unique click_id
   - Replaces macros in the landing page URL
   - 302 redirects user to: https://advertiser.com/signup?click_id=xyz789&sub1=facebook

5. User converts on advertiser's site (signs up, buys, etc.)

6. Advertiser's server fires postback:
   GET https://everflow.adslaunchigo.com/postback?click_id=xyz789&payout=5.00

7. TrackHive:
   - Finds the click by click_id
   - Records the conversion with revenue/payout
   - Updates offer totals and daily stats
   - Checks caps → sends alerts if needed

8. You see everything in your Dashboard and Reports
```

---

## Integration with Affiliate Networks (Example: Impact.com)

TrackHive connects with affiliate networks via postback URLs. Here's how to integrate with Impact.com:

**Impact.com macros:**
| Data | Impact Macro |
|------|-------------|
| Click ID | `{SubId1}` |
| Revenue/Sale Amount | `{Amount}` |
| Payout | `{Payout}` |
| Currency | `{Currency}` |
| Conversion ID | `{ActionId}` |
| Event Name | `{ActionTrackerName}` |
| Status | `{Status}` |

**Step 1 — Create offer in TrackHive:**
Set the Landing Page URL to Impact's tracking link, passing TrackHive's click_id:
```
https://impact-tracking-link.com/c/XXXXX?subId1={clickId}
```

**Step 2 — Set postback in Impact:**
In Impact dashboard → Settings → Event Notifications → Action Life Cycle Events:
```
https://everflow.adslaunchigo.com/postback?click_id={SubId1}&revenue={Amount}&payout={Payout}&event={ActionTrackerName}
```

**Flow:**
```
1. User clicks TrackHive link → click_id generated (e.g. clk_abc123)
2. User redirected to Impact with subId1=clk_abc123
3. User converts on advertiser site
4. Impact fires postback → /postback?click_id=clk_abc123&revenue=50&payout=30
5. TrackHive records conversion → visible in Dashboard + Reports
```

**Other networks:** Same pattern — pass `{clickId}` in the landing page URL via the network's sub-parameter, then set the network's postback URL to TrackHive's `/postback` endpoint with the click_id macro mapped back.

---

## URL Macros Reference

Available macros for Landing Page URL (replaced at click time):

| Macro | Replaced With |
|-------|--------------|
| `{click_id}` | Unique click identifier |
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
