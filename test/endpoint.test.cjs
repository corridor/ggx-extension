const assert = require('node:assert/strict');
const { test } = require('node:test');
const { parseEndpoint } = require('../out/endpoint');

for (const value of [undefined, '', ' \t ']) {
  test(`missing endpoint: ${JSON.stringify(value)}`, () => {
    assert.equal(parseEndpoint(value).kind, 'missing');
  });
}

for (const url of [
  'https://example.com/mcp',
  'https://example.com/ggx/mcp/',
  'https://example.com:8443/custom%20path/mcp',
  'http://localhost:8000/mcp',
  'http://127.0.0.1:8000/mcp',
  'http://[::1]:8000/mcp',
]) {
  test(`accept endpoint: ${url}`, () => {
    assert.deepEqual(parseEndpoint(url), { kind: 'valid', url });
  });
}

test('trims input, normalizes host, and never appends a path', () => {
  assert.deepEqual(parseEndpoint('  HTTPS://EXAMPLE.COM/deployment/mcp/  '), {
    kind: 'valid',
    url: 'https://example.com/deployment/mcp/',
  });
});

for (const value of [
  null,
  42,
  false,
  {},
  [],
  'not a url',
  '/mcp',
  'example.com/mcp',
  'https:example.com',
  'file:///mcp',
  'ftp://example.com/mcp',
  'https://',
  'https:///mcp',
  'http://example.com/mcp',
  'http://192.168.1.1/mcp',
  'http://localhost.example.com/mcp',
  'http://127.0.0.1.example.com/mcp',
  'http://[::ffff:192.168.1.1]/mcp',
  'https://user:secret@example.com/mcp',
  'https://@example.com/mcp',
  'https://example.com/mcp?token=secret',
  'https://example.com/mcp?',
  'https://example.com/mcp#secret',
  'https://example.com/mcp#',
  'https://exa\nmple.com/mcp',
  'https://example.com/with space',
  'https://example.com/\u0000mcp',
  'https://example.com\\@evil.com/mcp',
  'https://example.com/%xx',
]) {
  test(`reject unsafe endpoint: ${JSON.stringify(value)}`, () => {
    assert.equal(parseEndpoint(value).kind, 'invalid');
  });
}

test('errors do not expose configuration values', () => {
  for (const url of ['https://user:secret@example.com/mcp', 'https://example.com/?token=secret']) {
    assert.ok(!JSON.stringify(parseEndpoint(url)).includes('secret'));
  }
});
