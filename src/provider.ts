import { createHash } from 'node:crypto';
import * as vscode from 'vscode';
import { type EndpointResult, parseEndpoint } from './endpoint';

export const CONFIG_SECTION = 'ggxMcp';
export const PROVIDER_ID = 'ggx.mcp';
export const SERVER_LABEL = 'GenGuardX';

/** Read user settings explicitly; a repository must never redirect an authenticated connection. */
export function readUserSettings(): { url: unknown; endpoint: EndpointResult; enabled: boolean } {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const url = config.inspect<unknown>('url')?.globalValue;
  return {
    url,
    endpoint: parseEndpoint(url),
    enabled: (config.inspect<unknown>('enabled')?.globalValue ?? true) === true,
  };
}

export class GgxMcpProvider
  implements vscode.McpServerDefinitionProvider<vscode.McpHttpServerDefinition>, vscode.Disposable
{
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeMcpServerDefinitions = this.changed.event;
  private readonly subscriptions: vscode.Disposable[];
  private resolvedVersion: string | undefined;

  constructor() {
    this.subscriptions = [
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(CONFIG_SECTION)) this.changed.fire();
      }),
      vscode.workspace.onDidGrantWorkspaceTrust(() => this.changed.fire()),
    ];
  }

  refresh(): void {
    this.changed.fire();
  }

  hasResolvedDefinition(version: string | undefined): boolean {
    return version !== undefined && this.resolvedVersion === version;
  }

  provideMcpServerDefinitions(token: vscode.CancellationToken): vscode.McpHttpServerDefinition[] {
    if (token.isCancellationRequested || !vscode.workspace.isTrusted) return [];
    const settings = readUserSettings();
    if (!settings.enabled) return [];
    const endpoint = settings.endpoint;
    if (endpoint.kind === 'invalid') {
      // Safe message, without the potentially sensitive configuration value.
      throw new Error(`GenGuardX MCP: ${endpoint.message} Run GenGuardX MCP: Configure Server.`);
    }
    if (endpoint.kind === 'missing') return [];

    // Changing deployments invalidates the tool cache without exposing the URL as a version.
    const version = createHash('sha256').update(endpoint.url).digest('hex');
    return [
      new vscode.McpHttpServerDefinition(
        SERVER_LABEL,
        vscode.Uri.parse(endpoint.url, true),
        {},
        version,
      ),
    ];
  }

  resolveMcpServerDefinition(
    server: vscode.McpHttpServerDefinition,
    token: vscode.CancellationToken,
  ): vscode.McpHttpServerDefinition | undefined {
    // Reject stale definitions after disable/reconfigure/trust changes. Return a fresh
    // definition so no headers mutated on an old instance can be forwarded.
    const current = this.provideMcpServerDefinitions(token)[0];
    if (!current || current.uri.toString() !== server.uri.toString()) return undefined;
    this.resolvedVersion = current.version;
    return current;
  }

  dispose(): void {
    for (const subscription of this.subscriptions) subscription.dispose();
    this.changed.dispose();
  }
}
