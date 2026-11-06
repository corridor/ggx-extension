const assert = require("node:assert/strict");

function verifyRelease(manifest, { ref, confirmedPublisher }) {
  assert.equal(
    ref,
    `refs/tags/v${manifest.version}`,
    "Run publication from a v<package-version> tag.",
  );
  assert.equal(
    confirmedPublisher,
    manifest.publisher,
    "Set CONFIRMED_PUBLISHER only after verifying ownership of that publisher on both registries.",
  );
  const repository = manifest.repository?.url;
  assert.equal(
    typeof repository,
    "string",
    "Set the real public repository URL in package.json first.",
  );
  const url = new URL(repository);
  assert.equal(url.protocol, "https:", "Repository URL must use HTTPS.");
  assert.ok(
    !url.username && !url.password && !url.search && !url.hash,
    "Repository URL must not contain credentials.",
  );
  assert.ok(
    !/(^|\.)example\.(com|org|net)$|localhost/i.test(url.hostname),
    "Replace the placeholder repository URL.",
  );
  assert.ok(
    url.pathname.split("/").filter(Boolean).length >= 2,
    "Set a full repository URL, not an organization URL.",
  );
  assert.ok(
    /^https:\/\//.test(manifest.bugs?.url ?? ""),
    "Set a public issue tracker URL in package.json.",
  );
  assert.equal(
    manifest.contributes.configuration.properties["ggxMcp.url"].default,
    "",
    "Do not ship a default MCP endpoint.",
  );
}

exports.verifyRelease = verifyRelease;
if (require.main === module) {
  try {
    verifyRelease(require("../package.json"), {
      ref: process.env.GITHUB_REF,
      confirmedPublisher: process.env.CONFIRMED_PUBLISHER,
    });
    console.log("Release metadata and publisher confirmation passed.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
