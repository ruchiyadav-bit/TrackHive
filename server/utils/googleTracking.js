/**
 * The ONE Google Ads tracking domain (e.g. go.trackscales.com).
 *
 * Managed from the dashboard (Settings > Tracking > Google Ads Tracking Domain),
 * stored as its own Setting key, and deliberately NOT part of the normal
 * Tracking Domains list: it is the host submitted for Google certification and
 * is only ever used by /gclick. GCLICK_HOST in .env is a fallback when nothing
 * has been saved yet. Empty = /gclick is off.
 */
const Setting = require('../models/Setting');

const KEY = 'googleTrackingDomain';
let cache = { value: null, at: 0 };
const TTL_MS = 30 * 1000;

function normalizeHost(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '');
}

function isValidHost(host) {
  return /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(host);
}

async function getGoogleHost() {
  if (cache.value !== null && Date.now() - cache.at < TTL_MS) return cache.value;
  let value = '';
  try {
    value = normalizeHost(await Setting.getValue(KEY, ''));
  } catch (e) {
    value = '';
  }
  if (!value) value = normalizeHost(process.env.GCLICK_HOST || '');
  cache = { value, at: Date.now() };
  return value;
}

async function setGoogleHost(value) {
  const host = normalizeHost(value);
  await Setting.setValue(KEY, host);
  cache = { value: null, at: 0 };
  return getGoogleHost();
}

module.exports = { KEY, getGoogleHost, setGoogleHost, normalizeHost, isValidHost };
