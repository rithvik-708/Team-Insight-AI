/**
 * Offline manifest validation using the @forge/manifest package bundled with the globally
 * installed Forge CLI. Unlike `forge lint`, this does not require `forge login`.
 * Usage: npm run validate:manifest   (build the UI first: resource paths are checked too)
 */
const path = require('path');
const { execSync } = require('child_process');

const globalRoot = execSync('npm root -g').toString().trim();
const manifestPkg = path.join(globalRoot, '@forge', 'cli', 'node_modules', '@forge', 'manifest');

let validate;
try {
  ({ validate } = require(manifestPkg));
} catch {
  console.error('Could not load @forge/manifest. Install the Forge CLI: npm install -g @forge/cli');
  process.exit(1);
}

validate(false, path.resolve(__dirname, '..', 'manifest.yml'))
  .then((result) => {
    for (const e of result.errors ?? []) {
      console.log(`${e.level ?? 'error'}: ${e.message}${e.line ? ` (line ${e.line})` : ''}`);
    }
    console.log(result.success ? 'manifest.yml is valid' : 'manifest.yml has errors');
    process.exit(result.success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Validator failed:', err.message);
    process.exit(1);
  });
