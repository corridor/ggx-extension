const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createHost } = require('./helpers/host.cjs');
const key = 'ggxMcp.onboardingShown';

test('first activation automatically requests the URL and starts native OAuth', async () => {
  const host = createHost();
  host.input = 'https://example.com/mcp';
  host.load('extension').activate(host.context);
  await host.flush();
  assert.equal(host.inputCalls, 1);
  assert.equal(host.state.get(key), true);
  assert.equal(host.settings.url, host.input);
  assert.deepEqual(host.executed, [['workbench.mcp.startServer', 'genguardx.ggx-mcp/GenGuardX']]);
});

test('first-run dismissal is remembered without selecting a fallback server', async () => {
  const host = createHost();
  host.load('extension').activate(host.context);
  await host.flush();
  assert.equal(host.inputCalls, 1);
  assert.equal(host.updates.length, 0);
  assert.equal(host.executed.length, 0);
  const reloaded = createHost();
  reloaded.state = host.state;
  reloaded.load('extension').activate(reloaded.context);
  await reloaded.flush();
  assert.equal(reloaded.inputCalls, 0);
  assert.match(reloaded.statusItems[0].text, /GGX: Set Up/);
  assert.equal(reloaded.statusItems[0].command, 'ggxMcp.connect');
  reloaded.input = 'https://example.com/mcp';
  await reloaded.commands.get(reloaded.statusItems[0].command)();
  assert.equal(reloaded.inputCalls, 1);
  assert.equal(reloaded.executed[0][0], 'workbench.mcp.startServer');
});

test('existing endpoints and intentional disable do not trigger surprise prompts or connections', async () => {
  for (const settings of [{ url: 'https://example.com/mcp' }, { enabled: false }]) {
    const host = createHost();
    host.settings = settings;
    host.load('extension').activate(host.context);
    await host.flush();
    assert.equal(host.inputCalls, 0);
    assert.equal(host.executed.length, 0);
    assert.equal(host.statusItems[0].visible, true);
    assert.match(host.statusItems[0].text, settings.enabled === false ? /Disabled/ : /Connect/);
  }
});

test('setup status follows settings and is disposed with the extension', async () => {
  const host = createHost();
  host.state.set(key, true);
  host.load('extension').activate(host.context);
  const status = host.statusItems[0];
  assert.match(status.text, /Set Up/);
  await host.vscode.workspace.getConfiguration().update('url', 'https://example.com/mcp', 1);
  assert.match(status.text, /Connect/);
  await host.commands.get(status.command)();
  assert.match(status.text, /GGX: MCP/);
  assert.ok(!status.tooltip.includes('authenticated successfully'));
  await host.vscode.workspace.getConfiguration().update('enabled', false, 1);
  assert.match(status.text, /Disabled/);
  for (const subscription of host.subscriptions) subscription.dispose();
  assert.equal(status.visible, false);
});

test('automatic setup waits for workspace trust, then runs only once', async () => {
  const host = createHost();
  host.vscode.workspace.isTrusted = false;
  host.input = 'https://example.com/mcp';
  host.load('extension').activate(host.context);
  await host.flush();
  assert.equal(host.inputCalls, 0);
  assert.equal(host.state.get(key), undefined);
  host.vscode.workspace.isTrusted = true;
  host.trustGranted.fire();
  await host.flush();
  assert.equal(host.inputCalls, 1);
  host.trustGranted.fire();
  await host.flush();
  assert.equal(host.inputCalls, 1);
});

test('first-run setup and a simultaneous configure command share one dialog', async () => {
  const host = createHost();
  let submit;
  host.input = new Promise((resolve) => {
    submit = resolve;
  });
  host.load('extension').activate(host.context);
  const configure = host.commands.get('ggxMcp.configure')();
  await host.flush();
  assert.equal(host.inputCalls, 1);
  submit('https://example.com/mcp');
  await configure;
  assert.equal(host.inputCalls, 1);
  assert.equal(host.executed.length, 1);
});

test('disposing while URL input is pending cancels setup without storing or connecting', async () => {
  const host = createHost();
  let submit;
  host.input = new Promise((resolve) => {
    submit = resolve;
  });
  host.load('extension').activate(host.context);
  await host.flush();
  for (const subscription of host.subscriptions) subscription.dispose();
  assert.equal(host.inputToken.isCancellationRequested, true);
  submit('https://example.com/mcp');
  await host.flush();
  assert.equal(host.updates.length, 0);
  assert.equal(host.executed.length, 0);
});
