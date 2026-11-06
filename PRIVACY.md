# Privacy and data flow

The GenGuardX MCP extension reads its user-level `ggxMcp.url` and `ggxMcp.enabled` settings and registers a server definition with the editor. It does not read source code or files from your workspace, send telemetry, make its own network requests, store tokens, log endpoint values or include a default deployment URL.

The URL is stored in editor user settings, not secret storage. It may reveal a private deployment hostname and may sync if your editor syncs settings. Do not put credentials in it. The extension rejects URL credentials, query strings and fragments.

On first eligible activation, the extension opens built-in URL setup. It stores a local, unsynced onboarding-dismissal flag in the editor profile to avoid repeated dialogs. Once you submit a valid URL, the extension requests native server startup; the **editor** connects to that endpoint, performs OAuth, stores credentials using its own authentication system, and exchanges MCP messages. The same flow can be retried with Connect and Sign In. Cancelling or clearing the URL makes no connection. The editor may provide workspace-root information as part of MCP. Refer to your editor's MCP and privacy settings for details. Disconnecting the extension does not necessarily revoke existing OAuth authorization; use editor account controls or your GGX administrator to revoke it.

Your **GenGuardX deployment** processes tool requests under your account's permissions and may keep operational or audit logs according to your organization's policy. The tools available depend on the deployment and may include write operations and evaluations.

Your **AI assistant/model provider** may receive tool descriptions, arguments and returned GGX data as part of your conversation. The extension does not control that provider's retention or data use. Review your organization's agreements and approvals before connecting sensitive environments.

For service/privacy questions, contact your GGX administrator or use https://genguardx.ai/.
