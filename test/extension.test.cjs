const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createHost } = require('./helpers/host.cjs');

function activate() {
  const host = createHost();
  host.state.set('ggxMcp.onboardingShown', true);
  host.load('extension').activate(host.context);
  return host;
}

test('subsequent activation registers commands/provider without another setup prompt', async () => {
  const host = activate();
  assert.ok(host.providers.has('ggx.mcp'));
  assert.equal(host.inputOptions, undefined);
  await host.commands.get('ggxMcp.openSettings')();
  assert.deepEqual(host.executed, [['workbench.action.openSettings', '@ext:genguardx.ggx-mcp']]);
  for (const subscription of host.subscriptions) subscription.dispose();
  assert.equal(host.commands.size, 0);
  assert.equal(host.providers.size, 0);
});

test('configure saves a validated user setting and immediately starts native MCP/OAuth', async () => {
  const host = activate();
  host.input = ' https://example.com/base/mcp/ ';
  await host.commands.get('ggxMcp.configure')();
  assert.deepEqual(host.updates, [
    { key: 'url', value: 'https://example.com/base/mcp/', target: 1 },
  ]);
  assert.deepEqual(host.executed, [['workbench.mcp.startServer', 'genguardx.ggx-mcp/GenGuardX']]);
  assert.equal(host.inputOptions.validateInput('http://example.com/mcp')?.includes('HTTPS'), true);
});

test('connect retries native OAuth for an existing endpoint without asking for the URL', async () => {
  const host = activate();
  host.settings.url = 'https://example.com/mcp';
  await host.commands.get('ggxMcp.connect')();
  assert.equal(host.inputCalls, 0);
  assert.deepEqual(host.executed, [['workbench.mcp.startServer', 'genguardx.ggx-mcp/GenGuardX']]);
  assert.equal(
    host.information.length,
    0,
    'Do not claim auth succeeded just because start resolved',
  );
});

test('startup retries editor discovery no-ops, then stops once the definition is resolved', async () => {
  const host = activate();
  host.settings.url = 'https://example.com/mcp';
  host.startNoops = 2;
  await host.commands.get('ggxMcp.connect')();
  assert.equal(host.executed.length, 3);
  assert.equal(host.warnings.length, 0);
});

test('connect asks for a missing endpoint before starting', async () => {
  const host = activate();
  host.input = 'https://example.com/mcp';
  await host.commands.get('ggxMcp.connect')();
  assert.equal(host.inputCalls, 1);
  assert.equal(host.executed[0][0], 'workbench.mcp.startServer');
});

test('disabled settings are never silently re-enabled to connect', async () => {
  const host = activate();
  host.settings.enabled = false;
  host.input = 'https://example.com/mcp';
  await host.commands.get('ggxMcp.configure')();
  assert.equal(host.executed.length, 0);
  assert.equal(host.settings.enabled, false);
  assert.match(host.warnings[0], /disabled/);
});

test('untrusted workspaces cannot connect', async () => {
  const host = activate();
  host.vscode.workspace.isTrusted = false;
  host.settings.url = 'https://example.com/mcp';
  await host.commands.get('ggxMcp.connect')();
  assert.equal(host.executed.length, 0);
  assert.match(host.warnings[0], /Trust the workspace/);
});

test('missing native start command preserves the URL and offers safe management fallback', async () => {
  const host = activate();
  host.supportedCommands = ['workbench.mcp.listServer'];
  host.warningAction = 'Open MCP Servers';
  host.input = 'https://example.com/mcp';
  await host.commands.get('ggxMcp.configure')();
  assert.equal(host.settings.url, host.input);
  assert.deepEqual(host.executed, [['workbench.mcp.listServer']]);
});

test('native startup exceptions are handled without leaking auth details', async () => {
  const host = activate();
  host.commandError = true;
  host.settings.url = 'https://example.com/mcp';
  await host.commands.get('ggxMcp.connect')();
  assert.match(host.warnings[0], /could not be started/);
  assert.ok(!JSON.stringify(host.warnings).includes('private auth detail'));
});

test('cancelling extension lifetime before native startup prevents the connection', async () => {
  const host = activate();
  host.settings.url = 'https://example.com/mcp';
  host.vscode.commands.getCommands = async () => {
    for (const subscription of host.subscriptions) subscription.dispose();
    return host.supportedCommands;
  };
  await host.commands.get('ggxMcp.connect')();
  assert.equal(host.executed.length, 0);
});

test('reconfiguration during the provider publication handoff cannot start a stale URL', async () => {
  const host = activate();
  host.settings.url = 'https://example.com/mcp';
  const provider = host.providers.get('ggx.mcp');
  provider.onDidChangeMcpServerDefinitions(() => {
    host.settings.url = 'https://example.com/other';
  });
  await host.commands.get('ggxMcp.connect')();
  assert.equal(host.executed.length, 0);
});

test('cancelling is a no-op; clearing removes the user value instead of choosing a fallback', async () => {
  const host = activate();
  host.settings.url = 'https://example.com/mcp';
  await host.commands.get('ggxMcp.configure')();
  assert.equal(host.updates.length, 0);
  host.input = '  ';
  await host.commands.get('ggxMcp.configure')();
  assert.equal(host.updates[0].value, undefined);
});

test('invalid input and persistence failures are safely reported', async () => {
  const host = activate();
  host.input = 'https://user:secret@example.com/mcp';
  await host.commands.get('ggxMcp.configure')();
  assert.equal(host.updates.length, 0);
  assert.equal(host.errors.length, 1);
  host.input = 'https://example.com/mcp';
  host.saveError = true;
  await host.commands.get('ggxMcp.configure')();
  assert.equal(host.errors.length, 2);
  assert.ok(!host.errors.join('').includes('secret'));
  assert.equal(host.information.length, 0);
});

test('non-MCP Open VSX hosts get a clear warning instead of an activation crash', () => {
  const host = createHost();
  host.vscode.lm = undefined;
  host.load('extension').activate(host.context);
  assert.equal(host.warnings.length, 1);
  assert.ok(host.commands.has('ggxMcp.configure'));
  assert.equal(host.providers.size, 0);
});
