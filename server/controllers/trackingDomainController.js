const dns = require('dns');
const https = require('https');
const TrackingDomain = require('../models/TrackingDomain');
const { isManager } = require('../config/roles');

exports.list = async (req, res, next) => {
  try {
    // Partners get a read-only picker: just what they need to choose a domain.
    // The diagnostic fields (resolved IP, CNAME, verification errors, who added
    // it) are the manager's business and are not sent to partners at all.
    const fields = isManager(req.user)
      ? ''
      : 'domain status sslActive';

    const domains = await TrackingDomain.find().select(fields).sort('-createdAt');
    res.json({ domains, readOnly: !isManager(req.user) });
  } catch (error) {
    next(error);
  }
};

exports.add = async (req, res, next) => {
  try {
    let { domain } = req.body;
    if (!domain?.trim()) return res.status(400).json({ error: 'Domain is required' });

    domain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    const existing = await TrackingDomain.findOne({ domain });
    if (existing) return res.status(400).json({ error: 'Domain already exists' });

    const td = new TrackingDomain({ domain, createdBy: req.user._id });
    await td.save();
    res.status(201).json({ domain: td });
  } catch (error) {
    next(error);
  }
};

exports.verify = async (req, res, next) => {
  try {
    const td = await TrackingDomain.findById(req.params.id);
    if (!td) return res.status(404).json({ error: 'Domain not found' });

    const result = { dnsFound: false, resolves: false, ssl: false };

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

    // Check SSL
    if (result.resolves) {
      try {
        await new Promise((resolve, reject) => {
          const req = https.request(
            { hostname: td.domain, port: 443, method: 'HEAD', timeout: 5000 },
            (res) => { resolve(true); }
          );
          req.on('error', () => resolve(false));
          req.on('timeout', () => { req.destroy(); resolve(false); });
          req.end();
        }).then(ok => { result.ssl = ok !== false; });
      } catch (e) {
        result.ssl = false;
      }
    }

    if (result.dnsFound && result.resolves) {
      td.status = 'verified';
      td.sslActive = result.ssl;
      td.verifiedAt = new Date();
      td.verificationError = null;
    } else {
      td.status = 'failed';
      td.verificationError = 'DNS record not found. Make sure CNAME or A record points to your server.';
    }

    await td.save();
    res.json({ domain: td, checks: result });
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
