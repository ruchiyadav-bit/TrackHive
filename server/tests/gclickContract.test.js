const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const {
  parseGclickQuery,
  isGoogleParallelCallback,
} = require('../controllers/gclickController');
const gclickRouter = require('../routes/gclick');

const OFFER_ID = '6ac38ad36a6b1f7491732bb4';

test('gclick accepts exactly offer_id and url', () => {
  const parsed = parseGclickQuery({
    offer_id: OFFER_ID,
    url: 'https://landing.example/page?campaign=one',
  });

  assert.equal(parsed.error, undefined);
  assert.equal(parsed.offerId, OFFER_ID);
  assert.equal(parsed.target.toString(), 'https://landing.example/page?campaign=one');
});

test('gclick rejects /click-only parameters', () => {
  for (const key of ['sub1', 'sub2', 'sub3', 'sub4', 'sub5', 'subid', 'source', 'oid']) {
    const parsed = parseGclickQuery({
      offer_id: OFFER_ID,
      url: 'https://landing.example/',
      [key]: 'value',
    });
    assert.equal(parsed.error, `Unsupported parameter: ${key}`);
  }
});

test('gclick accepts the exact Google parallel-tracking callback and gb=1', () => {
  const parsed = parseGclickQuery({
    offer_id: OFFER_ID,
    url: 'https://www.google.com/asnc/aHR0cHM6Ly9nby50cmFjaw/',
    gb: '1',
  });

  assert.equal(parsed.error, undefined);
  assert.equal(parsed.googleParallelCallback, true);
  assert.equal(isGoogleParallelCallback(parsed.target), true);
});

test('Google callback exception does not allow arbitrary google.com redirects', () => {
  const arbitrary = new URL('https://www.google.com/search?q=example');
  assert.equal(isGoogleParallelCallback(arbitrary), false);

  const parsed = parseGclickQuery({
    offer_id: OFFER_ID,
    url: arbitrary.toString(),
    gb: '1',
  });
  assert.equal(parsed.error, 'Unsupported parameter: gb');
});

test('gb is rejected on ordinary landing-page requests', () => {
  const parsed = parseGclickQuery({
    offer_id: OFFER_ID,
    url: 'https://landing.example/',
    gb: '1',
  });
  assert.equal(parsed.error, 'Unsupported parameter: gb');
});

test('unknown /gclick paths return an explicit JSON 404', async () => {
  const app = express();
  app.use('/gclick', gclickRouter);
  const server = http.createServer(app);

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/gclick/not-a-real-path`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Not found' });
  } finally {
    await new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
  }
});
