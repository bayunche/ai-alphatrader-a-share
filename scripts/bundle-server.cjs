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
const serverBundlePath = path.join(resourcesDir, 'index.cjs');
esbuild.buildSync({
    entryPoints: ['server/index.js'],
    outfile: serverBundlePath,
    bundle: true,
    platform: 'node',
    target: 'node18',
    external: ['sqlite3', 'bindings'], // Keep sqlite3 external
    format: 'cjs',
});
if (!fs.existsSync(serverBundlePath)) {
    throw new Error(`Server bundle missing after build: ${serverBundlePath}`);
}
const legacyBundlePath = path.join(resourcesDir, 'index.js');
fs.copyFileSync(serverBundlePath, legacyBundlePath);

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
// But to be safe and simple, let's copy the whole package properly.
console.log(`Copying sqlite3 from ${sourceSqlite} to ${targetSqlite}`);
copyDir(sourceSqlite, targetSqlite);

// 5. Copy 'bindings' (Critical dependency for sqlite3)
// sqlite3 depends on 'bindings', but it is often hoisted to root node_modules.
// We must copy it explicitly because we are only copying 'sqlite3' folder above.
const bindingSrcPath = path.resolve(__dirname, '../node_modules/bindings');
const bindingDestPath = path.join(resourcesDir, 'node_modules/bindings');

if (fs.existsSync(bindingSrcPath)) {
    console.log(`Copying bindings from ${bindingSrcPath} to ${bindingDestPath}`);
    copyDir(bindingSrcPath, bindingDestPath);
} else {
    // If not at root, maybe it's nested?
    const nestedBindingsPath = path.join(sourceSqlite, 'node_modules/bindings');
    if (!fs.existsSync(nestedBindingsPath)) {
        console.warn('WARNING: Could not find "bindings" package! sqlite3 might fail.');
    } else {
        console.log(`Found nested bindings at ${nestedBindingsPath} - strictly expected at root for flattened bundle.`);
    }
}

console.log('Bundle complete.');
