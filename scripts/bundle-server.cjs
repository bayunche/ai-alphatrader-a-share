const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

// Configuration
const PLATFORM_MAP = {
    'win32': 'pc-windows-msvc',
    'darwin': 'apple-darwin',
    'linux': 'unknown-linux-gnu'
};

const ARCH_MAP = {
    'x64': 'x86_64',
    'arm64': 'aarch64'
};

const platform = process.platform;
const arch = process.arch;

const tauriTarget = `${ARCH_MAP[arch]}-${PLATFORM_MAP[platform]}`;
const binDir = path.resolve(__dirname, '../src-tauri/bin');
const resourcesDir = path.resolve(__dirname, '../src-tauri/resources/server');
const nodeBinName = platform === 'win32' ? `node-${tauriTarget}.exe` : `node-${tauriTarget}`;

console.log(`Building for target: ${tauriTarget}`);

// 1. Prepare directories
if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
if (fs.existsSync(resourcesDir)) fs.rmSync(resourcesDir, { recursive: true, force: true });
fs.mkdirSync(resourcesDir, { recursive: true });

// 2. Copy Node binary
const currentNodePath = process.execPath;
const targetNodePath = path.join(binDir, nodeBinName);
console.log(`Copying Node binary from ${currentNodePath} to ${targetNodePath}`);
fs.copyFileSync(currentNodePath, targetNodePath);
if (platform !== 'win32') fs.chmodSync(targetNodePath, '755');

// 3. Bundle Server Code
console.log('Bundling server code with esbuild...');
esbuild.buildSync({
    entryPoints: ['server/index.js'],
    outfile: path.join(resourcesDir, 'index.js'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    external: ['sqlite3', 'bindings'], // Keep sqlite3 external
    format: 'cjs',
});

// 4. Copy Resources (sqlite3 + schema)
console.log('Copying resources...');

// Copy schema
fs.copyFileSync('server/schema.sql', path.join(resourcesDir, 'schema.sql'));

// Copy sqlite3 build (native bindings)
const sourceSqlite = path.resolve(__dirname, '../node_modules/sqlite3');
const targetSqlite = path.join(resourcesDir, 'node_modules/sqlite3');

// Helper to copy directory recursively
function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// We only need lib/binding (native mod), package.json, and lib/*.js (wrapper)
// But to be safe and simple, let's copy the whole package properly,
// OR since we are bundling, we might just need the native parts if we were careful.
// However, 'sqlite3' main entry point might load other files. 
// Safest is to copy the whole 'sqlite3' folder from node_modules.
console.log(`Copying sqlite3 from ${sourceSqlite} to ${targetSqlite}`);
copyDir(sourceSqlite, targetSqlite);

// Also copy 'bindings' package if it's used by sqlite3 (it usually is)
// But wait, esbuild 'external: ["sqlite3"]' means `require('sqlite3')` stays as is.
// So we need `node_modules/sqlite3` to be present relative to the bundle.
// The bundle is at `resources/server/index.js`.
// So `resources/server/node_modules/sqlite3` is correct.

console.log('Bundle complete.');
