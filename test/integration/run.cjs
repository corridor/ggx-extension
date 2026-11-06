const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runTests } = require('@vscode/test-electron');

async function main() {
  const tempRoot = fs.existsSync('/tmp/opencode') ? '/tmp/opencode' : os.tmpdir();
  const profile = fs.mkdtempSync(path.join(tempRoot, 'ggx-extension-test-'));
  try {
    // Suppress interactive onboarding only in this disposable test profile.
    // Unit tests cover the first-run URL input; host tests exercise actual startup.
    fs.mkdirSync(path.join(profile, 'User'), { recursive: true });
    fs.writeFileSync(
      path.join(profile, 'User/settings.json'),
      JSON.stringify({ 'ggxMcp.enabled': false }),
    );
    await runTests({
      version: process.env.VSCODE_TEST_VERSION || '1.102.0',
      extensionDevelopmentPath: path.resolve(__dirname, '../..'),
      extensionTestsPath: path.join(__dirname, 'suite.cjs'),
      launchArgs: [
        '--disable-extensions',
        '--disable-gpu',
        '--skip-welcome',
        '--skip-release-notes',
        '--user-data-dir',
        profile,
      ],
    });
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
    if (fs.existsSync(profile)) {
      console.error(`Test profile cleanup failed: ${profile}`);
      process.exitCode = 1;
    } else console.log(`Removed isolated test profile: ${profile}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
