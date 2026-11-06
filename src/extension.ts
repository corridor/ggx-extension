import * as vscode from 'vscode';
import { parseEndpoint } from './endpoint';
import {
  CONFIG_SECTION,
  GgxMcpProvider,
  PROVIDER_ID,
  readUserSettings,
  SERVER_LABEL,
} from './provider';

const ONBOARDING_KEY = 'ggxMcp.onboardingShown';
const START_COMMAND = 'workbench.mcp.startServer';
const LIST_COMMAND = 'workbench.mcp.listServer';

async function configureServer(token: vscode.CancellationToken): Promise<boolean> {
  if (token.isCancellationRequested) return false;
  const current = readUserSettings().endpoint;
  const value = await vscode.window.showInputBox(
    {
      title: 'Configure GenGuardX MCP',
      prompt:
        'Enter your full MCP endpoint to connect and sign in. No default server is configured. Clear to remove it.',
      placeHolder: 'Full MCP endpoint URL (no default)',
      value: current.kind === 'valid' ? current.url : '',
      ignoreFocusOut: true,
      validateInput: (input) => {
        const endpoint = parseEndpoint(input);
        return endpoint.kind === 'invalid' ? endpoint.message : undefined;
      },
    },
    token,
  );
  if (value === undefined || token.isCancellationRequested) return false;
  // Revalidate at the persistence boundary, not just in the input box.
  const endpoint = parseEndpoint(value);
  if (endpoint.kind === 'invalid') {
    await vscode.window.showErrorMessage(`GenGuardX MCP: ${endpoint.message}`);
    return false;
  }
  try {
    await vscode.workspace
      .getConfiguration(CONFIG_SECTION)
      .update(
        'url',
        endpoint.kind === 'valid' ? endpoint.url : undefined,
        vscode.ConfigurationTarget.Global,
      );
  } catch {
    await vscode.window.showErrorMessage(
      'GenGuardX MCP: Could not save user settings. Check that your settings file is writable and valid.',
    );
    return false;
  }
  if (endpoint.kind === 'missing') {
    await vscode.window.showInformationMessage('GenGuardX MCP endpoint removed.');
    return false;
  }
  return !token.isCancellationRequested;
}

export function activate(context: vscode.ExtensionContext): void {
  const cancellation = new vscode.CancellationTokenSource();
  const token = cancellation.token;
  context.subscriptions.push({
    dispose: () => {
      cancellation.cancel();
      cancellation.dispose();
    },
  });

  let provider: GgxMcpProvider | undefined;
  let pending: Promise<void> | undefined;
  let handedOffUrl: string | undefined;
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 20);
  status.name = 'GenGuardX MCP Setup';
  context.subscriptions.push(status);

  function renderSetup(): void {
    if (token.isCancellationRequested) return;
    const settings = readUserSettings();
    const endpoint = settings.endpoint;
    status.command = 'ggxMcp.connect';
    if (!settings.enabled || !vscode.workspace.isTrusted) {
      status.text = '$(plug) GGX: Disabled';
      status.tooltip = 'Enable GenGuardX MCP in User Settings and trust the workspace to connect.';
      status.command = 'ggxMcp.openSettings';
    } else if (pending) {
      status.text = '$(sync~spin) GGX: Setting Up';
      status.tooltip =
        'Complete the URL entry or native OAuth prompts. Click to resume the same setup.';
    } else if (endpoint.kind !== 'valid') {
      status.text = '$(plug) GGX: Set Up';
      status.tooltip =
        'Click to enter your MCP URL and start sign-in. No default URL is configured.';
    } else {
      const handedOff = handedOffUrl === endpoint.url;
      status.text = handedOff ? '$(plug) GGX: MCP' : '$(plug) GGX: Connect';
      status.tooltip = handedOff
        ? 'Startup handed to the editor. Check MCP: List Servers for actual connection/authentication status. Click to retry.'
        : 'Click to connect to your saved MCP endpoint and start native sign-in.';
    }
    status.show();
  }

  async function openServerManagement(): Promise<void> {
    if (token.isCancellationRequested) return;
    const action = await vscode.window.showWarningMessage(
      'GenGuardX MCP: Automatic connection is unavailable or could not be started. Your endpoint is saved. Use MCP: List Servers → GenGuardX → Start to connect and sign in.',
      'Open MCP Servers',
    );
    if (action === 'Open MCP Servers' && !token.isCancellationRequested) {
      const commands = await vscode.commands.getCommands(true);
      if (commands.includes(LIST_COMMAND)) await vscode.commands.executeCommand(LIST_COMMAND);
    }
  }

  async function connect(): Promise<void> {
    if (token.isCancellationRequested) return;
    if (!vscode.workspace.isTrusted) {
      await vscode.window.showWarningMessage(
        'GenGuardX MCP: Trust the workspace before connecting.',
      );
      return;
    }
    const settings = readUserSettings();
    if (!settings.enabled) {
      await vscode.window.showWarningMessage(
        'GenGuardX MCP is disabled. Enable ggxMcp.enabled in User Settings before connecting.',
      );
      return;
    }
    if (settings.endpoint.kind !== 'valid') return;
    if (!provider) {
      await openServerManagement();
      return;
    }
    const commands = await vscode.commands.getCommands(true);
    if (token.isCancellationRequested) return;
    if (!commands.includes(START_COMMAND)) {
      await openServerManagement();
      return;
    }

    // There is no public MCP lifecycle API. Keep this verified workbench-command
    // compatibility boundary isolated; unsupported hosts retain manual management.
    // Native collection discovery is debounced (500ms in VS Code 1.102), and its
    // start command silently does nothing before discovery. Retry that no-op only
    // until native startup resolves the current definition, never retrying OAuth.
    provider.refresh();
    const version = provider.provideMcpServerDefinitions(token)[0]?.version;
    for (let attempt = 0; attempt < 20; attempt++) {
      if (token.isCancellationRequested || !vscode.workspace.isTrusted) return;
      const latest = readUserSettings();
      if (!latest.enabled || latest.url !== settings.url) return;
      try {
        await vscode.commands.executeCommand(
          START_COMMAND,
          `${context.extension.id.toLowerCase()}/${SERVER_LABEL}`,
        );
      } catch {
        await openServerManagement();
        return;
      }
      // Resolution confirms discovery, not successful authentication. The editor
      // owns auth/error UI; do not repeat a cancelled OAuth flow or claim success.
      if (provider.hasResolvedDefinition(version)) {
        handedOffUrl = settings.endpoint.url;
        return;
      }
      if (token.isCancellationRequested) return;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(finish, 100);
        const subscription = token.onCancellationRequested(finish);
        function finish(): void {
          clearTimeout(timer);
          subscription.dispose();
          resolve();
        }
      });
    }
    await openServerManagement();
  }

  function runSetup(mode: 'automatic' | 'configure' | 'connect'): Promise<void> {
    const settings = readUserSettings();
    if (
      mode === 'automatic' &&
      (!vscode.workspace.isTrusted ||
        !settings.enabled ||
        context.globalState.get<boolean>(ONBOARDING_KEY) ||
        settings.endpoint.kind === 'valid')
    )
      return Promise.resolve();
    // Automatic activation and explicit commands must never open competing dialogs.
    if (pending) return pending;
    pending = (async () => {
      if (token.isCancellationRequested) return;
      if (mode === 'automatic') {
        // Remember dismissal locally, without syncing it or repeating on every reload.
        await context.globalState.update(ONBOARDING_KEY, true);
        if (readUserSettings().endpoint.kind === 'valid') return;
      }
      if (token.isCancellationRequested) return;
      const needsInput = mode === 'configure' || readUserSettings().endpoint.kind !== 'valid';
      if (needsInput && !(await configureServer(token))) return;
      await connect();
    })()
      .catch(async () => {
        if (!token.isCancellationRequested) {
          await vscode.window.showErrorMessage(
            'GenGuardX MCP: Setup could not be completed. Retry with GenGuardX MCP: Configure Server.',
          );
        }
      })
      .finally(() => {
        pending = undefined;
        renderSetup();
      });
    renderSetup();
    return pending;
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('ggxMcp.configure', () => runSetup('configure')),
    vscode.commands.registerCommand('ggxMcp.connect', () => runSetup('connect')),
    vscode.commands.registerCommand('ggxMcp.openSettings', () =>
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        `@ext:${context.extension.id}`,
      ),
    ),
  );

  if (typeof vscode.lm?.registerMcpServerDefinitionProvider !== 'function') {
    // Some Open VSX clients advertise VS Code compatibility without implementing MCP.
    // Keep configuration commands working and explain the missing host capability.
    void vscode.window.showWarningMessage(
      'GenGuardX MCP requires an editor implementing the VS Code MCP server provider API (VS Code 1.102+). Installing from Open VSX does not add MCP support to an editor.',
    );
    return;
  }
  provider = new GgxMcpProvider();
  context.subscriptions.push(provider);
  context.subscriptions.push(provider.onDidChangeMcpServerDefinitions(renderSetup));
  context.subscriptions.push(vscode.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, provider));
  context.subscriptions.push(
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      void runSetup('automatic');
    }),
  );
  // Startup activation is contributed in package.json. Do not block extension
  // activation on URL input or OAuth: the registered provider must remain available.
  renderSetup();
  void runSetup('automatic');
}
