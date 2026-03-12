#!/usr/bin/env node
/** Sync package.json version to src/version.ts for CRA (cannot import outside src/) */
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const version = pkg.version || '0.0.0';
const content = `/** Synced from package.json version via npm run version:sync */
export const APP_VERSION = '${version}';
`;
const outPath = path.join(__dirname, '../src/version.ts');
fs.writeFileSync(outPath, content, 'utf8');
console.log('Synced version:', version, '-> src/version.ts');
