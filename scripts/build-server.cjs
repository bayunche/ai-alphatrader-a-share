const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetBin = path.join(__dirname, '../src-tauri/bin/server-x86_64-pc-windows-msvc.exe');

// 1. Cleanup existing binary
try {
    if (fs.existsSync(targetBin)) {
        console.log('Removing existing server binary...');
        fs.unlinkSync(targetBin);
    }
} catch (e) {
    console.warn('Warning: Failed to cleanup binary (might be in use or permission denied).', e.message);
}

// 2. Kill running server process (Windows only logic kept safe)
if (process.platform === 'win32') {
    try {
        console.log('Attempting to stop existing server process...');
        execSync('taskkill /F /IM server-x86_64-pc-windows-msvc.exe 2>nul');
    } catch (e) {
        // Ignore error if process not found
    }
}

// 3. Build with pkg
console.log('Building server with pkg...');
try {
    // Determine platform-specific target if needed, but for now we keep the user's specific target
    // The user's original command targeted 'node18-win-x64' specifically for Tauri Windows sidecar
    // If we are on Linux (CI), we might still want to cross-compile for Windows if that's the goal?
    // Wait, the error is running "tauri build" on Linux CI.
    // If the CI is building for Windows (cross-compile), we need win-x64 target.
    // If CI is building for Linux, we need a different target.

    // However, the immediate error is "powershell". 
    // Let's just fix the command execution first.

    execSync('npx pkg server/index.js --targets node18-win-x64 --output src-tauri/bin/server-x86_64-pc-windows-msvc.exe', { stdio: 'inherit' });
    console.log('Server build complete.');
} catch (e) {
    console.error('Server build failed:', e);
    process.exit(1);
}
