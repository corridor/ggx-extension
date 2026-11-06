const assert = require('node:assert/strict');
const { test } = require('node:test');
const manifest = require('../package.json');
const launch = require('../.vscode/launch.json');
const tasks = require('../.vscode/tasks.json');

test('F5 uses an explicit task that reuses the existing npm build script', () => {
  const task = tasks.tasks.find((entry) => entry.label === launch.configurations[0].preLaunchTask);
  assert.ok(task);
  assert.equal(task.command, 'npm run build');
  assert.equal(task.options.cwd, `\${workspaceFolder}`);
  assert.ok(manifest.scripts.build);
});

test('marketplace manifest uses stable APIs and has no configured endpoint', () => {
  assert.equal(manifest.contributes.configuration.properties['ggxMcp.url'].default, '');
  assert.equal(manifest.contributes.configuration.properties['ggxMcp.url'].scope, 'application');
  assert.equal(
    manifest.contributes.configuration.properties['ggxMcp.enabled'].scope,
    'application',
  );
  assert.equal(manifest.capabilities.untrustedWorkspaces.supported, false);
  assert.equal(manifest.enabledApiProposals, undefined);
  // First-run setup needs startup activation; provider/commands also activate implicitly.
  assert.deepEqual(manifest.activationEvents, ['onStartupFinished']);
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.extensionDependencies, undefined);
  assert.deepEqual(manifest.contributes.mcpServerDefinitionProviders, [
    { id: 'ggx.mcp', label: 'GenGuardX' },
  ]);
});
