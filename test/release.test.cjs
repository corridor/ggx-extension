const assert = require('node:assert/strict');
const { test } = require('node:test');
const { verifyRelease } = require('../scripts/verify-release.cjs');
const original = require('../package.json');
const fixture = () => ({
  ...structuredClone(original),
  repository: { type: 'git', url: 'https://github.com/test-org/test-extension' },
  bugs: { url: 'https://github.com/test-org/test-extension/issues' },
});
const env = { ref: `refs/tags/v${original.version}`, confirmedPublisher: original.publisher };

test('publication requires version tag, namespace confirmation and real project metadata', () => {
  assert.doesNotThrow(() => verifyRelease(fixture(), env));
  assert.throws(() => verifyRelease(fixture(), { ...env, ref: 'refs/heads/main' }));
  assert.throws(() => verifyRelease(fixture(), { ...env, confirmedPublisher: '' }));
  const manifest = fixture();
  delete manifest.repository;
  assert.throws(() => verifyRelease(manifest, env));
});

test('publication rejects placeholder metadata, credentials, and accidental default endpoints', () => {
  for (const repository of [
    'https://example.com/org/repo',
    'https://user:secret@github.com/org/repo',
    'http://github.com/org/repo',
  ]) {
    const manifest = fixture();
    manifest.repository.url = repository;
    assert.throws(() => verifyRelease(manifest, env));
  }
  const manifest = fixture();
  manifest.contributes.configuration.properties['ggxMcp.url'].default = 'https://example.com/mcp';
  assert.throws(() => verifyRelease(manifest, env));
});
