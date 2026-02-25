#!/usr/bin/env node
/**
 * 包装 craco build，确保进度输出实时显示
 */
process.env.CI = 'false';
process.env.NODE_ENV = 'production';

const { spawn } = require('child_process');

console.error('[Build] Starting...');
const child = spawn('node', ['node_modules/.bin/craco', 'build'], {
  stdio: 'inherit',
  cwd: __dirname + '/..',
});
child.on('exit', (code) => process.exit(code || 0));
