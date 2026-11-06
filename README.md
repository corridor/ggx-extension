# GenGuardX MCP

Connect your editor's AI assistant to **your GenGuardX deployment** using the Model Context Protocol (MCP). Discover GGX tools for inspecting and authoring objects, running evaluations, reviewing feedback, and searching documentation without leaving your editor.

**No server URL is preconfigured.** You choose the deployment. The extension registers an existing remote server; it does not install or run GGX.

## Requirements

- VS Code **1.102 or newer**, or a compatible desktop editor implementing VS Code's stable MCP server definition provider API.
- An MCP-capable AI assistant, such as GitHub Copilot Chat in Agent mode. This extension does not require or install Copilot; assistant availability, subscription and organizational policies are separate.
- Access to a running GenGuardX MCP deployment and an account authorized to use it.
- A trusted workspace. Restricted Mode does not expose GGX tools.

Distribution through Open VSX does **not** guarantee that an editor or assistant supports this API. Generic MCP support in an assistant is not sufficient: it must consume editor-registered MCP servers. Browser-only editors are not supported by this desktop extension.

## Get started

1. Install **GenGuardX MCP** from your editor's marketplace, or use **Extensions: Install from VSIX** with a release artifact.
2. On first activation in a trusted workspace, the extension automatically opens its built-in URL setup. No command or LLM prompt is required.
3. Enter the **full Streamable HTTP MCP endpoint** supplied by your GGX administrator. Include its MCP path and any deployment base path. Nothing is appended or guessed.
4. Submitting the URL saves it and immediately asks the editor to start **GenGuardX**, beginning native OAuth when authentication is needed. Complete the browser sign-in and consent prompts; these permissions cannot be bypassed.
5. Open your assistant in Agent mode and enable the GGX tools in its tool picker.

For a first check, ask your assistant to use the GGX health tool. Then try asking it to list objects you can access or search GGX documentation. Available tools and permissions come from the connected deployment, not this extension.

If the same server is already configured in `mcp.json`, disable or remove the duplicate entry so tools do not appear twice.

The setup dialog appears once per editor profile and remembers cancellation. **The status bar always exposes setup:** click **GGX: Set Up** to enter a URL, or **GGX: Connect** to use your saved endpoint. These buttons reuse the same setup/connect commands, not a separate implementation. Existing valid endpoints and intentionally disabled configuration do not trigger surprise dialogs or connections on reload. Restricted Mode defers onboarding until the workspace is trusted. **GGX: MCP** means startup was handed to the editor, not that authentication has succeeded; use MCP: List Servers to inspect the actual connection.

Automatic startup uses the editor's built-in MCP start command because there is no stable public MCP lifecycle API. It is integration-tested on the minimum/current VS Code versions. Hosts without that command get a safe fallback to **MCP: List Servers → GenGuardX → Start**. OAuth state and completion remain owned by the editor; a submitted URL is not proof that sign-in succeeded.

This configures the editor's native MCP client. Assistants such as Codex with their own MCP configuration still need to be connected separately; editor OAuth credentials are not copied to them.

## Settings

Open **GenGuardX MCP: Open Settings**, or edit your **User** settings:

| Setting          | Default | Description                                                     |
| ---------------- | ------- | --------------------------------------------------------------- |
| `ggxMcp.url`     | Empty   | Full deployment MCP endpoint. No fallback URL.                  |
| `ggxMcp.enabled` | `true`  | Advertise a configured server to the editor. Does not start it. |

- Only user-level values are read. Repository/workspace settings cannot redirect the connection.
- HTTPS is required, except HTTP on `localhost`, `127.0.0.1` or `[::1]` for local development.
- URLs must not contain usernames, passwords, query strings or fragments. OAuth is managed by the editor; there are no token or custom-header settings.
- Configuration changes refresh the server definition. Restart the server through **MCP: List Servers** after changing deployment. To disconnect an already running session immediately, stop it there; then clear the URL or disable the setting. Remove OAuth authorization using the editor's account/authentication controls if required.

### Local development and remote windows

Run your GGX API from `ggx-platform` separately, and configure its actual MCP endpoint. The extension does not read your repository, run a shell command or start the API.

This is a UI extension: configuration lives with the editor's local user profile, including Remote SSH, WSL and container windows. The editor manages MCP transport and OAuth. Ensure the configured address is reachable from the editor's MCP host; forward the API port if needed. `localhost` means the machine making the connection, not automatically a container or SSH host.

## Security and privacy

- No runtime dependencies, telemetry, analytics or extension-originated network requests.
- No credentials are stored or logged by the extension. The endpoint itself is a user setting and may sync according to your editor's Settings Sync preferences.
- The editor owns OAuth, token storage, server startup, transport and tool approvals. Never paste access tokens into the URL.
- GGX tools can read **and modify** data and run evaluations under your account's permissions. Review tool calls and your AI provider's data-handling policy. Tool results can enter the assistant's model context.
- Workspace Trust is an additional safeguard, not server-side authorization. Trust only servers and workspaces you control.

The packaged `PRIVACY.md` describes the data flow in more detail.

## Troubleshooting

| Symptom                  | What to check                                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server missing           | Configure a valid user URL, enable `ggxMcp.enabled`, trust the workspace, and verify your editor implements the MCP provider API.                        |
| Invalid URL error        | Use Configure Server to correct the full endpoint. Remote HTTP, credentials, queries and fragments are rejected.                                         |
| Sign-in fails / HTTP 401 | Check account access and the deployment's OAuth discovery/registration setup with your administrator. Restart the server to retry editor authentication. |
| HTTP 404                 | Use the actual MCP path, including any deployment prefix. A web UI URL alone is not the MCP endpoint.                                                    |
| Tools missing or stale   | Restart the server and refresh its tools in the editor; check your GGX permissions and deployment version.                                               |
| Connection failure       | Check VPN, proxy, TLS certificates, port forwarding and reachability from the MCP host. Do not disable certificate verification.                         |

Use **MCP: List Servers → GenGuardX → Show Output** for transport diagnostics. Redact credentials, private URLs and tool data before sharing logs. For GGX service help, contact your administrator or use the [GenGuardX website](https://genguardx.ai/).

## Developing and publishing

Use Node.js **22.15+** and npm:

```sh
npm ci --ignore-scripts
npm run check
npm run test:integration
npm run package
```

On headless Linux, use `xvfb-run -a npm run test:integration`. Press **F5** to open an Extension Development Host. The generated `ggx-mcp-0.1.2.vsix` can be installed in a compatible editor. If the profile already dismissed setup, use **GGX: Set Up** in the status bar; reinstalling does not reset profile state.

Maintainers: see `PUBLISHING.md` in the source checkout for publisher setup, required public repository metadata, release checks, and publishing the **same VSIX** to Visual Studio Marketplace and Open VSX. The `genguardx` publisher is provisional until ownership is confirmed. Marketplace publication is not automatic.

## Design references

The discover-configure-start flow follows the [Datadog MCP extension](https://github.com/bhayanak/datadog-mcp-server/tree/main/packages/datadog-vscode-extension) and [Datadog's OAuth setup guidance](https://docs.datadoghq.com/mcp_server/setup/). Unlike the local Datadog sample, this extension connects to GGX's existing remote HTTP server and does not place API keys in settings. It uses the [stable VS Code MCP provider API](https://code.visualstudio.com/api/extension-guides/ai/mcp). No Datadog code or assets are bundled.
