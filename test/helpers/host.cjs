const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Emitter {
  listeners = new Set();
  event = (callback) => {
    this.listeners.add(callback);
    return { dispose: () => this.listeners.delete(callback) };
  };
  fire(value) {
    for (const callback of this.listeners) callback(value);
  }
  dispose() {
    this.listeners.clear();
  }
}

/** Isolated VS Code boundary per test; no process-wide require monkeypatches. */
exports.createHost = () => {
  const configChanged = new Emitter();
  const trustGranted = new Emitter();
  const host = {
    settings: {},
    workspaceSettings: {},
    commands: new Map(),
    subscriptions: [],
    errors: [],
    warnings: [],
    information: [],
    executed: [],
    updates: [],
    providers: new Map(),
    input: undefined,
    saveError: false,
    state: new Map(),
    inputCalls: 0,
    supportedCommands: ['workbench.mcp.startServer', 'workbench.mcp.listServer'],
    commandError: false,
    startNoops: 0,
    warningAction: undefined,
    statusItems: [],
  };
  const vscode = {
    EventEmitter: Emitter,
    CancellationTokenSource: class {
      changed = new Emitter();
      token = { isCancellationRequested: false, onCancellationRequested: this.changed.event };
      cancel() {
        this.token.isCancellationRequested = true;
        this.changed.fire();
      }
      dispose() {
        this.changed.dispose();
      }
    },
    Uri: { parse: (url) => ({ toString: () => url }) },
    McpHttpServerDefinition: class {
      constructor(label, uri, headers, version) {
        Object.assign(this, { label, uri, headers, version });
      }
    },
    ConfigurationTarget: { Global: 1 },
    StatusBarAlignment: { Left: 1 },
    workspace: {
      isTrusted: true,
      onDidChangeConfiguration: configChanged.event,
      onDidGrantWorkspaceTrust: trustGranted.event,
      getConfiguration: () => ({
        inspect: (key) => ({
          globalValue: host.settings[key],
          workspaceValue: host.workspaceSettings[key],
        }),
        update: async (key, value, target) => {
          if (host.saveError) throw new Error('secret error data');
          host.updates.push({ key, value, target });
          host.settings[key] = value;
          configChanged.fire({ affectsConfiguration: (section) => section === 'ggxMcp' });
        },
      }),
    },
    commands: {
      registerCommand: (id, handler) => {
        host.commands.set(id, handler);
        return { dispose: () => host.commands.delete(id) };
      },
      getCommands: async () => host.supportedCommands,
      executeCommand: async (...args) => {
        host.executed.push(args);
        if (args[0] === 'workbench.mcp.startServer') {
          const provider = host.providers.get('ggx.mcp');
          const token = { isCancellationRequested: false };
          const server = provider?.provideMcpServerDefinitions(token)[0];
          if (host.startNoops > 0) host.startNoops--;
          else if (server) provider.resolveMcpServerDefinition(server, token);
        }
        if (host.commandError) throw new Error('private auth detail');
      },
    },
    window: {
      createStatusBarItem: () => {
        const item = {
          show() {
            this.visible = true;
          },
          dispose() {
            this.visible = false;
          },
        };
        host.statusItems.push(item);
        return item;
      },
      showInputBox: async (options, token) => {
        host.inputOptions = options;
        host.inputToken = token;
        host.inputCalls++;
        return host.input;
      },
      showErrorMessage: async (message) => host.errors.push(message),
      showWarningMessage: async (message) => {
        host.warnings.push(message);
        return host.warningAction;
      },
      showInformationMessage: async (message) => host.information.push(message),
    },
    lm: {
      registerMcpServerDefinitionProvider: (id, provider) => {
        host.providers.set(id, provider);
        return { dispose: () => host.providers.delete(id) };
      },
    },
  };
  const cache = new Map();
  function load(name) {
    const filename = path.resolve(__dirname, '../../out', `${name}.js`);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const wrapper = vm.runInThisContext(
      `(function(require, module, exports) {\n${fs.readFileSync(filename, 'utf8')}\n})`,
      { filename },
    );
    wrapper(
      (id) => (id === 'vscode' ? vscode : id.startsWith('./') ? load(id.slice(2)) : require(id)),
      module,
      module.exports,
    );
    return module.exports;
  }
  return Object.assign(host, {
    vscode,
    load,
    configChanged,
    trustGranted,
    context: {
      subscriptions: host.subscriptions,
      extension: { id: 'genguardx.ggx-mcp' },
      globalState: {
        get: (key) => host.state.get(key),
        update: async (key, value) => {
          host.state.set(key, value);
        },
      },
    },
    flush: async () => {
      await new Promise(setImmediate);
      await new Promise(setImmediate);
    },
  });
};
