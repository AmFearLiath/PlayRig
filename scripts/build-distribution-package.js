const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

console.log('⚡ Erstelle PlayRig Produktions- und Installationspakete...');

const items = [
  'server',
  'rigs',
  '_shared',
  'studio',
  'admin',
  'docs',
  'docs-portal',
  'deploy',
  'scripts',
  'install.sh',
  'package.json',
  'ecosystem.config.js',
  '.env.example',
  'README.md',
  'GRUNDREGELN.md',
  'LICENSE.md',
  'favicon.svg',
  'favicon.ico',
  'hub.css',
  'hub.js',
  'registry.js',
  'index.html'
].join(' ');

try {
  // 1. Erstelle tar.gz
  const tarCmd = `tar --exclude="node_modules" --exclude=".git" --exclude="dist" --exclude="scratch" -czf dist/playrig-debian-server.tar.gz ${items}`;
  execSync(tarCmd, { cwd: ROOT_DIR, stdio: 'inherit' });
  console.log('✓ Paket erstellt: dist/playrig-debian-server.tar.gz');

  // 2. Erstelle zip
  const zipCmd = `tar --exclude="node_modules" --exclude=".git" --exclude="dist" --exclude="scratch" -a -cf dist/playrig-debian-server.zip ${items}`;
  execSync(zipCmd, { cwd: ROOT_DIR, stdio: 'inherit' });
  console.log('✓ Paket erstellt: dist/playrig-debian-server.zip');

  console.log('🎉 Beide Installationspakete erfolgreich in dist/ gebaut!');
} catch (err) {
  console.error('Fehler beim Erstellen der Pakete:', err.message);
  process.exit(1);
}
