const assert = require('node:assert/strict');
const http = require('node:http');
const vscode = require('vscode');
const manifest = require('../../package.json');
const { GgxMcpProvider } = require('../../out/provider');

exports.run = async () => {
  // Isolated profile; only a synthetic loopback MCP fixture is ever started.
  const extension = vscode.extensions.getExtension(`${manifest.publisher}.${manifest.name}`);
  assert.ok(extension, 'Extension was discovered by the actual VS Code host');
  await extension.activate();
  assert.ok(extension.isActive);
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes('ggxMcp.configure'));
  assert.ok(commands.includes('ggxMcp.connect'));
  assert.ok(commands.includes('ggxMcp.openSettings'));
  assert.equal(typeof vscode.lm.registerMcpServerDefinitionProvider, 'function');

  const source = new vscode.CancellationTokenSource();
  const provider = new GgxMcpProvider();
  const config = vscode.workspace.getConfiguration('ggxMcp');
  try {
    assert.deepEqual(provider.provideMcpServerDefinitions(source.token), []);
    await config.update('enabled', true, vscode.ConfigurationTarget.Global);
    await config.update(
      'url',
      'https://example.invalid/base/mcp',
      vscode.ConfigurationTarget.Global,
    );
    const server = provider.provideMcpServerDefinitions(source.token)[0];
    assert.ok(server instanceof vscode.McpHttpServerDefinition);
    assert.equal(server.uri.toString(), 'https://example.invalid/base/mcp');
    assert.deepEqual(server.headers, {});
    assert.ok(provider.resolveMcpServerDefinition(server, source.token));
    await config.update('enabled', false, vscode.ConfigurationTarget.Global);
    assert.deepEqual(provider.provideMcpServerDefinitions(source.token), []);
    assert.equal(provider.resolveMcpServerDefinition(server, source.token), undefined);
    await config.update('enabled', true, vscode.ConfigurationTarget.Global);
    source.cancel();
    assert.deepEqual(provider.provideMcpServerDefinitions(source.token), []);
    await testNativeStartup(config);
  } finally {
    provider.dispose();
    source.dispose();
    await config.update('url', undefined, vscode.ConfigurationTarget.Global);
    await config.update('enabled', undefined, vscode.ConfigurationTarget.Global);
  }
  console.log(`GenGuardX extension-host integration passed on VS Code ${vscode.version}`);
};

async function testNativeStartup(config) {
  let initialized;
  const initialization = new Promise((resolve) => {
    initialized = resolve;
  });
  const fixture = http.createServer(async (request, response) => {
    if (request.method !== 'POST') {
      response.writeHead(405).end();
      return;
    }
    let body = '';
    for await (const chunk of request) body += chunk;
    const message = JSON.parse(body);
    if (message.id === undefined) {
      response.writeHead(202).end();
      return;
    }
    let result = {};
    if (message.method === 'initialize') {
      initialized(message);
      result = {
        protocolVersion: message.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: 'ggx-extension-fixture', version: '1.0.0' },
      };
    } else if (message.method === 'tools/list') result = { tools: [] };
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
  });
  const serverId = `${`${manifest.publisher}.${manifest.name}`.toLowerCase()}/GenGuardX`;
  let timeout;
  try {
    await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve));
    const endpoint = `http://127.0.0.1:${fixture.address().port}/mcp`;
    await config.update('url', endpoint, vscode.ConfigurationTarget.Global);
    await config.update('enabled', true, vscode.ConfigurationTarget.Global);
    const received = Promise.race([
      initialization,
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Native MCP startup never reached the configured fixture.')),
          10000,
        );
      }),
    ]);
    // Start waiting before executing so a failed fixture cannot leave an unhandled rejection.
    const [message] = await Promise.all([
      received,
      vscode.commands.executeCommand('ggxMcp.connect'),
    ]);
    assert.equal(message.method, 'initialize');
    console.log('Native editor MCP startup reached the configured HTTP fixture.');
  } finally {
    clearTimeout(timeout);
    try {
      await vscode.commands.executeCommand('workbench.mcp.stopServer', serverId);
    } finally {
      fixture.closeAllConnections();
      await new Promise((resolve) => fixture.close(resolve));
    }
  }
}
