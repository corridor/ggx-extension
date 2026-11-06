# Security

Do not disclose tokens, private deployment URLs, tool output or customer data in public issues. For sensitive findings, contact the maintainers privately through the GenGuardX organization at https://genguardx.ai/ or your GGX administrator. Once the public repository is configured, maintainers should enable GitHub private vulnerability reporting and add its reporting link here.

Only the latest released extension version is supported. Keep your editor, assistant and GGX deployment updated as well.

Security-sensitive boundaries:

- User-only endpoint configuration; no repository-selected destinations.
- No default deployment, extension-managed credentials or custom headers. Native server startup is requested only after the user submits a valid URL or explicitly selects Connect and Sign In, not on every reload.
- HTTPS except local loopback development; reject URL credentials, queries and fragments.
- Workspace Trust and cancellation checked both at discovery and resolution; stale endpoints are not resolved.
- OAuth, transport, proxy/certificate policy and tool confirmations are owned by the editor. Server authorization remains owned by GGX.
- No runtime dependencies; publishing dependencies are locked, audited and not included in the VSIX.

Review the VSIX allowlist, CI changes and publishing permissions on every release. A trusted MCP server can expose powerful tools; this extension is not an authorization or data-loss-prevention boundary.
