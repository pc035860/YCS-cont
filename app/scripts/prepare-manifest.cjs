const fs = require('fs');
const path = require('path');

// Default to Chrome manifest
const manifestSource = path.join(__dirname, '..', 'manifest.json');
const manifestDest = path.join(__dirname, '..', 'src', 'static', 'manifest.json');

// If manifest already exists, skip (likely copied by root-level build scripts)
if (fs.existsSync(manifestDest)) {
    console.log('⏭️  Manifest already exists, skipping copy');
    process.exit(0);
}

// Ensure the static directory exists
const staticDir = path.dirname(manifestDest);
if (!fs.existsSync(staticDir)) {
    fs.mkdirSync(staticDir, { recursive: true });
}

// Copy manifest
fs.copyFileSync(manifestSource, manifestDest);
console.log('✓ Copied manifest.json to src/static/');
