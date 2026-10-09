const dns = require('dns');
const https = require('https');
const TrackingDomain = require('../models/TrackingDomain');
const { isManager } = require('../config/roles');

/**
 * The hostname a tracking domain should be pointed at.
 * DNS_TARGET_CNAME wins so the value can be a vanity/white-label host that does
 * not expose the account's own domain; otherwise the public URL is used.
 */
function targetCname() {
  if (process.env.DNS_TARGET_CNAME) return process.env.DNS_TARGET_CNAME.trim();
  try {
    return new URL(process.env.CLIENT_URL).hostname;
  } catch (e) {
    return '';
  }
}

/** DNS setup the user has to create, ready to display or copy. */
function setupRecord(domain, target) {
  const name = domain.split('.').slice(0, -2).join('.') || '@';
  return {
    type: 'CNAME',
    name,
    value: target,
    ttl: 'Auto',
    alternative: process.env.SERVER_IP
      ? { type: 'A', name, value: process.env.SERVER_IP, ttl: 'Auto' }
      : null,
  };
}

/** Attach target/setup to a domain document for the API response. */
function decorate(doc) {
  const d = doc.toObject ? doc.toObject() : doc;
  const target = d.targetCname || targetCname();
  return { ...d, targetCname: target, setup: setupRecord(d.domain, target) };
}

exports.list = async (req, res, next) => {
  try {
    // Partners get a read-only picker: just what they need to choose a domain.
    // The diagnostic fields (resolved IP, CNAME, verification errors, who added
    // it) are the manager's business and are not sent to partners at all.
    const fields = isManager(req.user)
      ? ''
      : 'domain status sslActive';

    const domains = await TrackingDomain.find().select(fields).sort('-createdAt');
    res.json({
      domains: isManager(req.user) ? domains.map(decorate) : domains,
      target: targetCname(),
      readOnly: !isManager(req.user),
    });
  } catch (error) {
    next(error);
  }
};

exports.add = async (req, res, next) => {
  try {
    let { domain } = req.body;
    if (!domain?.trim()) return res.status(400).json({ error: 'Domain is required' });

    domain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    // A hostname only. Anything else would end up quoted in setup instructions
    // and, once nginx generation is added, in a config file.
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      return res.status(400).json({ error: 'Enter a valid hostname, e.g. track.yourdomain.com' });
    }

    const existing = await TrackingDomain.findOne({ domain });
    if (existing) return res.status(400).json({ error: 'Domain already exists' });

    const td = new TrackingDomain({
      domain,
      targetCname: targetCname(),
      createdBy: req.user._id,
    });
    await td.save();
    res.status(201).json({ domain: decorate(td) });
  } catch (error) {
    next(error);
  }
};

/** GET https://<domain>/api/health and return the parsed body, or null. */
function fetchHealth(hostname) {
  return new Promise((resolve) => {
    const req = https.request(
      { hostname, port: 443, path: '/api/health', method: 'GET', timeout: 10000 },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch (e) { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

exports.verify = async (req, res, next) => {
  try {
    const td = await TrackingDomain.findById(req.params.id);
    if (!td) return res.status(404).json({ error: 'Domain not found' });

    const result = { dnsFound: false, resolves: false, ssl: false, pointsHere: false };

    // Check A records
    try {
      const addresses = await dns.promises.resolve4(td.domain);
      if (addresses.length > 0) {
        result.dnsFound = true;
        result.resolves = true;
        td.resolvedIP = addresses[0];
      }
    } catch (e) {
      // Try CNAME
      try {
        const cnames = await dns.promises.resolveCname(td.domain);
        if (cnames.length > 0) {
          result.dnsFound = true;
          result.resolves = true;
          td.resolvedCname = cnames[0];
        }
      } catch (e2) {
        // no records
      }
    }

    // HTTPS + "is this actually us?" in one request. A 10s timeout rather than
    // 5s because a sleeping origin behind a CDN routinely needs longer, and a
    // slow first byte was being reported as "no HTTPS".
    if (result.resolves) {
      const health = await fetchHealth(td.domain);
      result.ssl = health !== null;
      result.pointsHere = !!(health && health.instance && health.instance === global.__INSTANCE_ID);
    }

    if (result.dnsFound && result.resolves) {
      td.status = 'verified';
      td.sslActive = result.ssl;
      td.pointsHere = result.pointsHere;
      td.verifiedAt = new Date();
      td.verificationError = result.pointsHere
        ? null
        : 'DNS resolves, but the domain does not reach this server. Traffic sent to it will not be tracked here.';
    } else {
      td.status = 'failed';
      td.pointsHere = false;
      td.verificationError = 'DNS record not found. Make sure the CNAME or A record shown above has been created.';
    }

    await td.save();
    res.json({ domain: decorate(td), checks: result });
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const td = await TrackingDomain.findByIdAndDelete(req.params.id);
    if (!td) return res.status(404).json({ error: 'Domain not found' });
    res.json({ message: 'Domain deleted' });
  } catch (error) {
    next(error);
  }
};
