# Publishing GenGuardX MCP

One platform-independent VSIX is used for **Visual Studio Marketplace** and **Open VSX**. No server URL, publisher credentials, or deployment secrets belong in the package.

## One-time preparation

1. Confirm that the organization approves the extension name, MIT license, icon, public documentation and ownership. The included icon is an original placeholder; replace it with an approved PNG if desired. Its SVG source is in `media/icon.svg`.
2. Confirm ownership of publisher **`genguardx`** on **both** registries. This ID is provisional, not a claim that the accounts exist or are owned. If unavailable, change `package.json`'s `publisher` before the first release. The extension identity is `<publisher>.ggx-mcp`; changing it after release creates a different extension.
3. Source is hosted at https://github.com/corridor/ggx-extension, with issues at https://github.com/corridor/ggx-extension/issues. The manifest includes these public repository links. Push reviewed release sources to `main` before tagging a release.
4. For [Visual Studio Marketplace](https://code.visualstudio.com/api/working-with-extensions/publishing-extension), create the publisher and a narrowly scoped Marketplace **Manage** publishing token for its owning account. Keep it in a secret store, never Git or a command argument. Follow Microsoft's current token requirements and organization policy.
5. For [Open VSX](https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions), link your Eclipse/GitHub accounts, sign the Publisher Agreement and own the verified **`CorridorPlatforms`** namespace (the case must match `package.json`). Publishing uses [trusted publishing](https://github.com/eclipse-openvsx/openvsx/wiki/Trusted-Publishing): the workflow exchanges its GitHub OIDC token for a short-lived one, so no access token is stored. Open VSX only accepts a trusted publisher for an extension that already has a version, so the **first** Open VSX version is uploaded once by hand (see [First Open VSX version](#first-open-vsx-version)). Then, as a namespace owner, open Settings → Trusted Publishers and register GitHub Actions with organization `corridor`, repository `ggx-extension`, workflow `publish.yml` and environment `marketplace`.

## Verify a release

```sh
npm ci --ignore-scripts
npm run check
npm audit --audit-level=moderate
xvfb-run -a npm run test:integration
VSCODE_TEST_VERSION=stable xvfb-run -a npm run test:integration
npm run package
python3 scripts/check-vsix.py
```

On desktop systems, omit `xvfb-run -a`. Integration tests download VS Code, use isolated profiles and start only a synthetic loopback HTTP MCP fixture; they do not contact a GGX deployment or require an account. They verify that the built-in start command actually reaches the configured server, not merely that it returns without error. CI runs the minimum supported version and current stable version. Review packaging warnings rather than suppressing them blindly. Local packaging allows missing repository metadata only to make an initial installable artifact; **publication does not**.

Manually smoke-test the packaged VSIX on VS Code and any Open VSX client you intend to support:

- Fresh installation in a trusted workspace opens built-in URL setup, without any default endpoint or connection before submission. Dismissing it does not repeat on reload.
- Submitting a real full deployment URL immediately starts the native server/OAuth flow; complete consent and run `health` and an authorized read-only tool. Test Connect and Sign In as a retry action.
- Existing valid URLs and disabled settings must not trigger unsolicited prompts or connections on reload. Hosts lacking the native start command must retain the documented manual fallback.
- Check a prefixed deployment URL, an expired/revoked OAuth session, cancellation and sign-out.
- Check empty, malformed and insecure URLs; disable/reconfigure and restart; verify tools refresh.
- Restricted Mode exposes no tools; workspace settings cannot override the user endpoint.
- A compatible Open VSX host discovers the provider; an unsupported host explains the missing API without crashing. Open VSX availability alone is not a compatibility guarantee.

Never run write/delete tools against production just to validate installation. A real OAuth flow needs a running authorized GGX deployment and is not asserted by the offline tests.

Update `version` and `CHANGELOG.md` together. Remove or refresh the development-only `@vscode/vsce → minimatch` override when upstream fixes its dependency: it pins `11.0.5` to address GHSA-g3hv-75wg-m249. Packaging/allowlist tests check compatibility; there is no shipped runtime dependency tree.

## GitHub Actions publication (recommended)

1. Create a protected GitHub environment named **`marketplace`** with required reviewers and deployment rules permitting only release tags. Protect release tags against moving or deletion; keep the workflow on the default branch.
2. Set environment variable **`CONFIRMED_PUBLISHER=CorridorPlatforms`** only after ownership on both registries is verified. No publishing secrets are needed: Visual Studio Marketplace (`vsce publish --oidc`) and Open VSX (`ovsx publish --trusted-publishing`) both authenticate with the job's GitHub OIDC token, so the workflow needs `id-token: write` and must run in the `marketplace` environment registered on Open VSX.
3. Review and commit all release sources, including public repository metadata, lockfile and changelog. Tag that exact commit `v<version>` (currently `v0.1.2`) and push it. CI builds and tests; a tag push does **not** publish.
4. Manually run **Publish marketplaces**, selecting that version tag as the workflow ref and destination **both**. Approve its protected environment deployment after reviewing the tag and CI evidence.

The workflow checks the tag/version, publisher confirmation, real metadata, tests, audit and VSIX allowlist before publishing. It uses major-version action tags, read-only GitHub permissions, locked CLIs and short-lived OIDC tokens instead of stored marketplace tokens. It uploads the exact VSIX as an artifact.

Publication is not atomic across registries. If one succeeds and the other fails, inspect the logs and registry state, then rerun at the **same immutable tag**, selecting only the failed destination. Do not overwrite an already-published version or move its tag. If the source must change, increment the version and release a new tag.

## Manual publication

Use the same verified artifact for both uploads. Load tokens through your secret manager into `VSCE_PAT` and `OVSX_PAT` (do not paste them into commands). Set `GITHUB_REF` to the release tag ref and `CONFIRMED_PUBLISHER` to your verified publisher, then:

```sh
npm run verify:release
npx --no-install vsce publish --packagePath ggx-mcp-0.1.2.vsix
npx --no-install ovsx publish ggx-mcp-0.1.2.vsix
```

Substitute the actual version. Never upload a VSIX built from unreviewed or uncommitted sources. Verify each registry's listing, metadata, icon, install and OAuth behavior after publication. Revoke or rotate publishing tokens on suspected exposure.

## First Open VSX version

Needed once, because Open VSX can't register a trusted publisher before the extension exists. Upload the VSIX that a successful **Publish marketplaces** run already verified (its `published-vsix` artifact), not a new local build:

```sh
gh run download <run-id> -R corridor/ggx-extension -n published-vsix
OVSX_PAT=... npx --no-install ovsx publish ggx-mcp-<version>.vsix   # load the token from your secret manager
```

Then register the trusted publisher (preparation step 5) and revoke that access token. Later releases publish to Open VSX from the workflow with OIDC only.
