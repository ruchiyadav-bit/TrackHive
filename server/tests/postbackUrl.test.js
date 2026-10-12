const test = require('node:test');
const assert = require('node:assert/strict');

const Advertiser = require('../models/Advertiser');
const { buildPostbackUrl } = require('../utils/postbackUrl');

test('new advertisers default secret verification to ON', () => {
  const advertiser = new Advertiser({ name: 'Default Test' });
  assert.equal(advertiser.usePostbackSecretVerification, true);
});

test('SaleGains ON URL uses a path secret and no static query parameters', () => {
  const url = buildPostbackUrl({
    trackingDomain: 'growth.trackyoudomain.com',
    network: 'salegains',
    secret: 'advertiser-secret',
    usePostbackSecretVerification: true,
  });
  assert.equal(url, 'https://growth.trackyoudomain.com/postback/salegains/advertiser-secret');
  assert.equal(url.includes('?'), false);
});

test('SaleGains OFF URL is the bare shared postback endpoint', () => {
  const url = buildPostbackUrl({
    trackingDomain: 'growth.trackyoudomain.com',
    network: 'salegains',
    secret: 'advertiser-secret',
    usePostbackSecretVerification: false,
  });
  assert.equal(url, 'https://growth.trackyoudomain.com/postback');
});

test('existing non-SaleGains postback generation remains unchanged', () => {
  const url = buildPostbackUrl({
    trackingDomain: 'growth.trackyoudomain.com',
    network: 'everflow',
    secret: 'advertiser-secret',
    clickIdParam: 'sub1',
  });
  assert.equal(
    url,
    'https://growth.trackyoudomain.com/postback?click_id={sub1}&revenue={payout}&payout=0&event={event_id}&txn_id={transaction_id}&secret=advertiser-secret'
  );
});

test('non-SaleGains OFF URLs keep all network macros and only omit secret', () => {
  const url = buildPostbackUrl({
    trackingDomain: 'growth.trackyoudomain.com',
    network: 'everflow',
    secret: 'advertiser-secret',
    clickIdParam: 'sub1',
    usePostbackSecretVerification: false,
  });
  assert.equal(
    url,
    'https://growth.trackyoudomain.com/postback?click_id={sub1}&revenue={payout}&payout=0&event={event_id}&txn_id={transaction_id}'
  );
});
