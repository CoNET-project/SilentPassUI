#!/usr/bin/env node
/**
 * Copy @ffmpeg/core wasm/js into public/ffmpeg so the browser loads same-origin
 * assets (unpkg CDN fetch often fails with "Failed to fetch").
 */
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bizRoot = join(__dirname, '..');
const srcDir = join(bizRoot, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
const destDir = join(bizRoot, 'public', 'ffmpeg');

const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

await mkdir(destDir, { recursive: true });
for (const name of files) {
  await cp(join(srcDir, name), join(destDir, name));
}
console.log(`[copyFfmpegCorePublic] copied ${files.join(', ')} → public/ffmpeg/`);
