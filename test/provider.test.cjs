const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createHost } = require('./helpers/host.cjs');
const token = { isCancellationRequested: false };

function setup() {
  const host = createHost();
  host.provider = new (host.load('provider').GgxMcpProvider)();
  host.definitions = (cancel = token) => host.provider.provideMcpServerDefinitions(cancel);
  return host;
}

test('fresh install has no server and workspace settings cannot redirect the connection', () => {
  const host = setup();
  host.workspaceSettings.url = 'https://untrusted.example/mcp';
  assert.deepEqual(host.definitions(), []);
  host.settings.url = 'https://example.com/mcp';
  assert.equal(host.definitions()[0].uri.toString(), host.settings.url);
});

test('produces HTTP definition with no credentials and endpoint-dependent tool-cache version', () => {
  const host = setup();
  host.settings.url = 'https://example.com/base/mcp/';
  const first = host.definitions()[0];
  assert.equal(first.label, 'GenGuardX');
  assert.deepEqual(first.headers, {});
  assert.match(first.version, /^[a-f0-9]{64}$/);
  assert.equal(host.definitions()[0].version, first.version);
  host.settings.url = 'https://example.com/other/mcp';
  assert.notEqual(host.definitions()[0].version, first.version);
});

test('invalid settings fail with actionable errors and without leaking input', () => {
  const host = setup();
  host.settings.url = 'https://user:secret@example.com/mcp';
  assert.throws(
    () => host.definitions(),
    (error) => {
      assert.match(error.message, /Configure Server/);
      assert.ok(!error.message.includes('secret'));
      return true;
    },
  );
});

test('disabled, untrusted and cancelled states expose no tools', () => {
  const host = setup();
  host.settings.url = 'https://example.com/mcp';
  host.settings.enabled = false;
  assert.deepEqual(host.definitions(), []);
  host.settings.enabled = true;
  host.vscode.workspace.isTrusted = false;
  assert.deepEqual(host.definitions(), []);
  host.vscode.workspace.isTrusted = true;
  assert.deepEqual(host.definitions({ isCancellationRequested: true }), []);
});

test('resolve refuses stale endpoints, disable, cancellation and trust loss', () => {
  const host = setup();
  host.settings.url = 'https://example.com/mcp';
  const server = host.definitions()[0];
  const resolve = (cancel = token) => host.provider.resolveMcpServerDefinition(server, cancel);
  server.headers.Authorization = 'must-not-be-forwarded';
  assert.deepEqual(resolve().headers, {});
  assert.equal(resolve({ isCancellationRequested: true }), undefined);
  host.settings.url = 'https://example.com/other';
  assert.equal(resolve(), undefined);
  host.settings.url = 'https://example.com/mcp';
  host.settings.enabled = false;
  assert.equal(resolve(), undefined);
  host.settings.enabled = true;
  host.vscode.workspace.isTrusted = false;
  assert.equal(resolve(), undefined);
});

test('configuration and trust changes refresh definitions; disposal removes listeners', () => {
  const host = setup();
  let changes = 0;
  host.provider.onDidChangeMcpServerDefinitions(() => changes++);
  host.configChanged.fire({ affectsConfiguration: () => false });
  assert.equal(changes, 0);
  host.configChanged.fire({ affectsConfiguration: (section) => section === 'ggxMcp' });
  host.trustGranted.fire();
  assert.equal(changes, 2);
  host.provider.dispose();
  assert.equal(host.configChanged.listeners.size, 0);
  assert.equal(host.trustGranted.listeners.size, 0);
});
