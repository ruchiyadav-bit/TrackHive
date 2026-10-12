const { after, before, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');

const Click = require('../models/Click');
const Offer = require('../models/Offer');
const Advertiser = require('../models/Advertiser');
const DailyStat = require('../models/DailyStat');
const PostbackLog = require('../models/PostbackLog');
const controller = require('../controllers/postbackController');

const originals = {};
let advertiser;
let capturedClickUpdate;
let postbackLogs;

function queryOf(value) {
  return {
    select() { return this; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
}

const click = {
  _id: 'click-document',
  clickId: 'valid-click',
  offerId: 'offer-1',
  offerName: 'Test Offer',
  converted: false,
  conversionEvent: '',
  clickedAt: new Date(),
};

const offer = {
  _id: 'offer-1',
  name: 'Test Offer',
  advertiser: 'advertiser-1',
  createdBy: 'owner-1',
  allowDuplicateConversions: false,
  enableCaps: false,
  enableClickToConversionTime: false,
  events: [],
  revenueType: 'RPA',
  revenueAmount: 0,
  payoutType: 'CPA',
  payoutAmount: 0,
};

before(() => {
  const save = (model, method) => {
    originals[`${model.modelName}.${method}`] = model[method];
  };

  save(Click, 'findOne');
  save(Click, 'findOneAndUpdate');
  save(Offer, 'findById');
  save(Offer, 'updateOne');
  save(Advertiser, 'findById');
  save(DailyStat, 'findOneAndUpdate');
  save(PostbackLog, 'create');

  Click.findOne = () => queryOf(click);
  Click.findOneAndUpdate = async (_filter, update) => {
    capturedClickUpdate = update;
    return { ...click, converted: true, conversionId: 'conversion-1' };
  };
  Offer.findById = () => queryOf(offer);
  Offer.updateOne = async () => ({});
  Advertiser.findById = () => queryOf({ _id: 'advertiser-1', name: 'Test Advertiser', ...advertiser });
  DailyStat.findOneAndUpdate = async () => ({});
  PostbackLog.create = async (row) => { postbackLogs.push(row); return row; };
});

beforeEach(() => {
  advertiser = {
    network: 'salegains',
    postbackSecret: 'saved-secret',
    usePostbackSecretVerification: true,
  };
  capturedClickUpdate = null;
  postbackLogs = [];
});

after(() => {
  Click.findOne = originals['Click.findOne'];
  Click.findOneAndUpdate = originals['Click.findOneAndUpdate'];
  Offer.findById = originals['Offer.findById'];
  Offer.updateOne = originals['Offer.updateOne'];
  Advertiser.findById = originals['Advertiser.findById'];
  DailyStat.findOneAndUpdate = originals['DailyStat.findOneAndUpdate'];
  PostbackLog.create = originals['PostbackLog.create'];
});

async function send({ query = {}, params = {}, salegains = false } = {}) {
  const req = {
    body: {},
    query,
    params,
    method: 'GET',
    ip: '127.0.0.1',
  };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };

  if (salegains) await controller.handleSaleGainsPostback(req, res);
  else await controller.handlePostback(req, res);

  // The audit row is intentionally fire-and-forget; allow that promise chain
  // to complete before the next test changes its fixture.
  await new Promise(resolve => setImmediate(resolve));
  return res;
}

test('accepts a correct query-string secret', async () => {
  advertiser.network = 'everflow';
  const res = await send({ query: { click_id: 'valid-click', secret: 'saved-secret', revenue: '12.50', payout: '0', event: 'lead' } });
  assert.equal(res.body.success, true);
  assert.equal(res.body.revenue, 12.5);
  assert.equal(res.body.event, 'lead');
});

test('rejects an incorrect query-string secret without exposing it', async () => {
  const res = await send({ query: { click_id: 'valid-click', secret: 'wrong-secret', revenue: '12.50' } });
  assert.equal(res.body.success, false);
  assert.equal(res.body.reason, 'invalid_secret');
  assert.doesNotMatch(JSON.stringify(res.body), /wrong-secret|saved-secret/);
  assert.equal(postbackLogs[0].params.secret, '***');
});

test('treats a missing setting field as ON and rejects a missing secret', async () => {
  delete advertiser.usePostbackSecretVerification;
  const res = await send({ query: { click_id: 'valid-click', revenue: '12.50' } });
  assert.equal(res.body.success, false);
  assert.equal(res.body.reason, 'invalid_secret');
});

test('accepts a missing secret only when this advertiser has verification OFF', async () => {
  advertiser.usePostbackSecretVerification = false;
  const res = await send({ query: { click_id: 'valid-click', revenue: '12.50', payout: '0' } });
  assert.equal(res.body.success, true);
});

test('accepts the correct SaleGains path secret', async () => {
  const res = await send({
    salegains: true,
    params: { secret: 'saved-secret' },
    query: { click_id: 'valid-click', revenue: '8.25' },
  });
  assert.equal(res.body.success, true);
  assert.equal(res.body.revenue, 8.25);
});

test('rejects an incorrect SaleGains path secret without logging it', async () => {
  const res = await send({
    salegains: true,
    params: { secret: 'wrong-path-secret' },
    query: { click_id: 'valid-click', revenue: '8.25' },
  });
  assert.equal(res.body.success, false);
  assert.equal(res.body.reason, 'invalid_secret');
  assert.doesNotMatch(JSON.stringify(res.body), /wrong-path-secret|saved-secret/);
  assert.equal(Object.values(postbackLogs[0].params).includes('wrong-path-secret'), false);
});

test('SaleGains path supplies event=sale and payout=0 when omitted', async () => {
  const res = await send({
    salegains: true,
    params: { secret: 'saved-secret' },
    query: { click_id: 'valid-click', revenue: '19.99' },
  });
  assert.equal(res.body.success, true);
  assert.equal(res.body.event, 'sale');
  assert.equal(res.body.payout, 0);
  assert.equal(capturedClickUpdate.$set.conversionEvent, 'sale');
  assert.equal(capturedClickUpdate.$set.payout, 0);
});
