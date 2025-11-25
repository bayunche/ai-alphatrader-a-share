const fs = require('fs');
const path = require('path');

const platform = process.platform;
const arch = process.arch;

const triples = {
  win32: {
    x64: 'x86_64-pc-windows-msvc.exe',
    arm64: 'aarch64-pc-windows-msvc.exe',
  },
  linux: {
    x64: 'x86_64-unknown-linux-gnu',
    arm64: 'aarch64-unknown-linux-gnu',
  },
  darwin: {
    x64: 'x86_64-apple-darwin',
    arm64: 'aarch64-apple-darwin',
  },
};

const suffix = (triples[platform] && triples[platform][arch]) || null;
if (!suffix) {
  console.error(`Unsupported platform/arch for akshare sidecar: ${platform} ${arch}`);
  process.exit(1);
}

const distDir = path.resolve(__dirname, '..', 'dist');
const binDir = path.resolve(__dirname, '..', 'src-tauri', 'bin');
const srcFile = path.join(distDir, platform === 'win32' ? 'akshare_service.exe' : 'akshare_service');
const targetFile = path.join(binDir, `akshare_service-${suffix}`);

if (!fs.existsSync(srcFile)) {
  console.error(`Akshare sidecar not found at ${srcFile}. Did pyinstaller run successfully?`);
  process.exit(1);
}

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

// Prefer rename (move) to avoid double space usage; fallback to copy+delete
try {
  fs.renameSync(srcFile, targetFile);
  console.log(`Akshare sidecar moved to ${targetFile}`);
} catch (err) {
  if (err.code === 'EXDEV' || err.code === 'EACCES' || err.code === 'EPERM') {
    fs.copyFileSync(srcFile, targetFile);
    fs.unlinkSync(srcFile);
    console.log(`Akshare sidecar copied to ${targetFile} and source removed`);
  } else {
    throw err;
  }
}
fs.chmodSync(targetFile, 0o755);
