import fs from 'node:fs/promises';
import path from 'node:path';

// Reports paths only. Never writes or prints credential values.
const root = process.cwd();
const secrets = new Set();
try {
  const env = await fs.readFile(path.join(root, '.env.local'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^(?:COMETCHAT_REST_API_KEY|COMETCHAT_API_KEY|OPENAI_API_KEY)=(.+)$/);
    if (match && match[1].trim().length >= 12) secrets.add(match[1].trim().replace(/^['"]|['"]$/g, ''));
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
try {
  const config = JSON.parse(await fs.readFile(path.join(root, '.cometchat/config.json'), 'utf8'));
  if (typeof config.authKey === 'string' && config.authKey.length >= 12) secrets.add(config.authKey);
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const skipDirectories = new Set(['node_modules', '.git', '.next', 'coverage', 'test-results', 'playwright-report']);
const findings = [];
let inspected = 0;
async function scan(dir, compiled = false) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(root, absolute).replaceAll('\\', '/');
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (!compiled && skipDirectories.has(entry.name)) continue;
      await scan(absolute, compiled);
    } else if (entry.isFile()) {
      if (entry.name.startsWith('.env') && entry.name !== '.env.example') continue;
      if (relative === '.cometchat/config.json' || /credentials/i.test(entry.name)) continue;
      if (!/\.(?:[cm]?[jt]sx?|json|md|html|css|toml|ya?ml|txt)$/.test(entry.name)) continue;
      const content = await fs.readFile(absolute, 'utf8');
      inspected++;
      if ([...secrets].some(secret => content.includes(secret))) findings.push(relative);
    }
  }
}
await scan(root);
try { await scan(path.join(root, '.next/static'), true); } catch (error) { if (error.code !== 'ENOENT') throw error; }
console.log(JSON.stringify({ check: 'exact-local-credential-leak-scan', knownSecretCount: secrets.size, filesInspected: inspected, findings, status: findings.length ? 'FAIL' : secrets.size ? 'PASS' : 'UNVERIFIED_NO_LOCAL_SECRETS' }, null, 2));
process.exitCode = findings.length || !secrets.size ? 1 : 0;
