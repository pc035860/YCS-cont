# YCS-Continued

> Source-based development repository. Main branch: **v2-source**

## Installation

Download the extension from official stores:
- **Chrome Web Store**: https://chromewebstore.google.com/detail/mfobjniokjbcldieppimekoibpocahed
- **Firefox Add-ons**: https://addons.mozilla.org/zh-TW/firefox/addon/ycs-continued/

## Project Background

This repository is the source-based continuation of **YCS (YouTube Comment Search)** extension.

**Status**:
- Main development branch: `v2-source`
- Supported browsers: Chrome 88+ (Manifest V3), Firefox
- Original project: [sonigy/YCS](https://github.com/sonigy/YCS)
- Migrated from `ycs_cont_migration` branch to single-repo structure

The extension enables searching, filtering, and exporting YouTube comments, replies, chat replays, and video transcripts, with continuous fixes for YouTube API changes (2024-2025).

## Development Setup

### Prerequisites
- Node.js 22+ (defined in `app/.nvmrc`)
- npm

### Installation & Build

All development commands run from the **`app/`** directory:

```bash
# Install dependencies
cd app
npm ci

# Development build (watch mode, HMR disabled)
npm run dev

# Production build → app/dist/
npm run build

# Clean cache and rebuild
npm run rebuild

# Lint check
npm run lint

# Type checking
npm run typecheck

# Format code with Prettier
npm run format
npm run format:check

# Clean all build artifacts
npm run rm
```

### Load Extension in Browser

1. Build the extension: `cd app && npm run build`
2. Open browser extension page:
   - Chrome: `chrome://extensions`
   - Firefox: `about:debugging#/runtime/this-firefox`
3. Enable "Developer mode"
4. Click "Load unpacked" and select **`app/dist/`** directory

## Release Workflow

From project root, use the Makefile:

```bash
make release TYPE=patch   # Auto bump, commit, tag, build, package
make release TYPE=minor
make release TYPE=major
```

This will:
- Update version in `app/manifest.json` and `app/manifest.firefox.json`
- Create git commit and tag
- Build both Chrome and Firefox versions
- Package as `.zip` files in `packing/` directory

**Manual build** (if needed):
```bash
./scripts/build-extension.sh chrome    # or firefox
./scripts/package-extension.sh chrome  # or firefox
```

## Technical Documentation

### Architecture Overview

**Three-layer communication model**:
```
YouTube.com Page
  ├─ web-resources.ts (Web Page Layer)
  │  └─ Search logic, UI rendering, Fuse.js integration
  │  └─ window.postMessage() ↕️
  ├─ content-scripts.ts (Content Script Layer)
  │  └─ Message relay, script injection management
  │  └─ chrome.runtime.sendMessage() ↕️
  └─ background.ts (Service Worker)
     └─ IndexedDB cache, storage monitoring, badge updates
```

**Why this structure?** Manifest V3 security restrictions require web page code to run in isolated context. The content script acts as a secure bridge between web page and extension background.

**Build system**: Parcel 2.0.1 with TypeScript (ES6 target, strict mode)

**Storage**: IndexedDB cache with auto-cleanup (200 MB quota limit, configurable in options)

### YouTube Innertube API Integration

The extension integrates with YouTube's internal Innertube API for comments, chat replays, and transcripts.

**Documentation**:
- [innertube-comments-integration.md](app/docs/innertube-comments-integration.md) - **Start here** for comment integration
- [innertube-migration-guide.md](app/docs/innertube-migration-guide.md) - frameworkUpdates migration guide
- [innertube-chat-replay-api-changes.md](app/docs/innertube-chat-replay-api-changes.md) - Chat replay API changes
- [continuation-processing.md](app/docs/continuation-processing.md) - Implementation reference

**Key directories**:
- `app/src/source/` - TypeScript source code
  - `utils/` - Modular utility system
    - `innertube.ts` - YouTube Innertube API integration
    - `filters/` - Comment and chat filtering modules
    - `formatting.ts` - Data transformation and HTML output
    - `dom.ts` - DOM manipulation and UI interactions
    - `sheets.ts` - Excel export functionality
    - `common.ts` - Shared utilities and GlobalStore
  - `web-resources/` - Search UI and Fuse.js integration
  - `content-scripts/` - Message relay layer
  - `background.ts` - Service Worker, IndexedDB cache
- `app/src/static/` - Static assets (manifest, icons, i18n)
- `scripts/` - Build automation
- `packing/` - Release artifacts

## Credits
- Original YCS by **sonigy**
- YCS-Continued maintained by **pc035860**
