require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Validate required env vars
const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`FATAL: Missing required env var: ${envVar}`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3050;

// Trust proxy — env-driven for Render (1), Nginx reverse proxy, etc.
app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

// ── PUBLIC TRACKING ROUTES ──────────────────────────────────────────
// Mounted FIRST — before body parsers, rate limiters, and any other
// middleware. These handle bare GET requests with zero overhead.
// No auth, no rate limit, no session, no JSON parsing.
// (POST /postback has its own local express.json() inside the router.)
const smartLinkHandler = require('./routes/smartLink');
app.use('/go', smartLinkHandler);

const clickHandler = require('./routes/click');
app.use('/click', clickHandler);

const postbackHandler = require('./routes/postback');
app.use('/postback', postbackHandler);

// ── APP MIDDLEWARE ──────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(mongoSanitize());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Rate limiting (API only — tracking routes are above)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', apiLimiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});
app.use('/api/auth/login', loginLimiter);

// API routes
const authRoutes = require('./routes/auth');
const offerRoutes = require('./routes/offers');
const reportRoutes = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const templateRoutes = require('./routes/templates');
const activityRoutes = require('./routes/activity');
const offerGroupRoutes = require('./routes/offerGroups');
const telegramRoutes = require('./routes/telegram');
const smartLinksRoutes = require('./routes/smartLinks');
const advertiserRoutes = require('./routes/advertisers');
const trackingDomainRoutes = require('./routes/trackingDomains');
const networkPresetRoutes = require('./routes/networkPresets');

app.use('/api/auth', authRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/offer-groups', offerGroupRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/smart-links', smartLinksRoutes);
app.use('/api/advertisers', advertiserRoutes);
app.use('/api/tracking-domains', trackingDomainRoutes);
app.use('/api/network-presets', networkPresetRoutes);

// Health check — includes the deployed git commit (Render sets RENDER_GIT_COMMIT
// automatically on every deploy) so it's easy to confirm a push actually went
// live before re-testing, instead of guessing whether the build finished.
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    commit: process.env.RENDER_GIT_COMMIT || 'unknown',
  });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    // Never serve SPA shell for tracking / API routes
    const p = req.path;
    if (p.startsWith('/click') || p.startsWith('/postback') || p.startsWith('/go/') || p.startsWith('/api')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  // Fail fast on a malformed network preset. A bad click_id macro loses every
  // conversion from that network silently, so this must abort the boot rather
  // than warn into a log nobody reads.
  const { validatePresets } = require('./config/validatePresets');
  validatePresets(require('./config/networkPresets'));

  await connectDB();

  // Seed admin user on first run
  const { seedAdmin } = require('./utils/seedAdmin');
  await seedAdmin();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
};

startServer().catch(console.error);

module.exports = app;
