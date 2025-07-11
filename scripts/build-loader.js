// scripts/build-loader.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Starting custom loader build...');

// Define paths
const buildDir = path.resolve(__dirname, '../build');
const mainSWPath = path.resolve(buildDir, 'service-worker.js');
const loaderSrcPath = path.resolve(__dirname, '../src/loader.ts');
const loaderDestPath = path.resolve(buildDir, 'loader.js'); // Final output name from your code

// 1. Compile loader.ts using its own tsconfig
// This creates a temporary loader file inside the build directory
try {
  console.log('Compiling loader.ts...');
  // Note: Adjust the output path in tsconfig.worker.json if needed
  execSync(`tsc -p tsconfig.worker.json --outFile ${loaderDestPath}`);
  console.log(`Successfully compiled loader to ${loaderDestPath}`);
} catch (err) {
  console.error('Failed to compile loader.ts:', err.stdout.toString());
  process.exit(1);
}

// 2. Read the content of the main service worker
let mainSWContent;
try {
  console.log(`Reading main service worker from ${mainSWPath}`);
  mainSWContent = fs.readFileSync(mainSWPath, 'utf8');
} catch (err) {
  console.error(`Failed to read ${mainSWPath}:`, err);
  process.exit(1);
}

// 3. Read the content of the compiled loader script
let loaderContent;
try {
  console.log(`Reading compiled loader from ${loaderDestPath}`);
  loaderContent = fs.readFileSync(loaderDestPath, 'utf8');
} catch (err) {
  console.error(`Failed to read ${loaderDestPath}:`, err);
  process.exit(1);
}

// 4. Replace the placeholder
console.log('Injecting service worker content into loader...');
const finalLoaderContent = loaderContent.replace(
  'const initialSWJS = __INITIAL_SW_JS__;',
  // We use a template literal and JSON.stringify to safely embed the code as a string
  `const initialSWJS = ${JSON.stringify(mainSWContent)};`
);

// 5. Write the final, self-contained loader script back to the file
try {
  console.log(`Writing final loader to ${loaderDestPath}`);
  fs.writeFileSync(loaderDestPath, finalLoaderContent, 'utf8');
  console.log('Loader build complete! ✅');
} catch (err) {
  console.error(`Failed to write final loader script:`, err);
  process.exit(1);
}