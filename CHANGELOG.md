# Changelog

## 0.1.2

- Keep setup visible in the status bar after dismissal or when an endpoint is already saved.
- Reuse existing configure/connect commands for all setup entry points; centralize endpoint parsing in the user-settings reader.
- Show setup progress and disabled state without claiming OAuth has completed.
- Explicitly wire F5 to the existing npm build script.

## 0.1.1

- Automatically open built-in URL setup once on first eligible activation after installation.
- Start the native MCP connection and OAuth flow immediately after a valid URL is submitted.
- Add Connect and Sign In for retries without re-entering the endpoint.
- Respect cancellation, existing endpoints, disabled configuration and Workspace Trust; retain safe manual fallback on hosts without native startup support.
- Test actual native startup against an isolated local MCP fixture on minimum/current VS Code.

## 0.1.0

- Register a user-configured GenGuardX Streamable HTTP MCP server using stable VS Code APIs.
- Delegate authentication and MCP lifecycle to the editor.
- No default URL, runtime dependencies, telemetry or workspace-level connection overrides.
- Add URL validation, Workspace Trust, cancellation and configuration refresh handling.
- Add unit/extension-host tests, VSIX allowlisting and gated publishing to Visual Studio Marketplace and Open VSX.
