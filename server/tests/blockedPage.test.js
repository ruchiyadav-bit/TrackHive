const test = require('node:test');
const assert = require('node:assert/strict');

const {
  renderBlockedPage,
  DEFAULT_BLOCKED_MESSAGE,
} = require('../utils/blockedPage');

test('blocked page uses the approved responsive, button-free content', () => {
  const html = renderBlockedPage();

  assert.match(html, /name="viewport"/);
  assert.match(html, /You don\u2019t have access to this page/);
  assert.match(html, new RegExp(DEFAULT_BLOCKED_MESSAGE));
  assert.match(html, /\/click\/access-restricted\.png/);
  assert.doesNotMatch(html, /If you believe this is a mistake/i);
  assert.doesNotMatch(html, /<button|role="button"/i);
});

test('blocked page escapes a custom advertiser message', () => {
  const html = renderBlockedPage('<script>alert("x")</script>');

  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
});
