# YCS Extension Source Code

This directory contains the source code for the YCS (YouTube Comment Search) browser extension. The extension enables searching, filtering, and exporting YouTube comments, replies, chat replays, and video transcripts.

## Directory Structure

```
app/
├── src/
│   ├── source/              # TypeScript source code (~12,145 lines)
│   │   ├── background.ts    # Service Worker - cache and storage management
│   │   ├── content-scripts/ # Content Script bridge layer
│   │   │   ├── cscripts.ts  # Message relay, script injection
│   │   │   └── style.css    # Content script styles
│   │   ├── web-resources/   # Main search and UI logic
│   │   │   └── wresources.ts # Fuse.js integration, UI rendering
│   │   ├── browser-action/  # Extension popup UI
│   │   ├── options/         # Settings page and comment export
│   │   └── utils/           # Core business logic
│   │       ├── assist.ts    # YouTube API calls, filtering logic
│   │       ├── renderView.ts # HTML template rendering
│   │       └── interfaces/  # TypeScript type definitions
│   └── static/              # Static assets (copied by Parcel)
│       ├── manifest.json    # Chrome MV3 manifest
│       ├── _locales/        # Internationalization files
│       └── assets/images/   # Extension icons
├── dist/                    # Build output (generated)
├── docs/                    # Technical documentation
├── manifest.json            # Chrome manifest source
├── manifest.firefox.json    # Firefox manifest source
├── package.json             # Dependencies and npm scripts
├── tsconfig.json            # TypeScript configuration
├── .parcelrc                # Parcel bundler configuration
└── .editorconfig            # Editor settings
```

## Development Setup

### Prerequisites
- Node.js 16+
- npm

### Install Dependencies

```bash
npm ci
```

## npm Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Parcel dev server (watch mode, HMR disabled) → `dev/` |
| `npm run build` | Production build (no source maps) → `dist/` |
| `npm run rebuild` | Clean cache and rebuild |
| `npm run lint` | Run ESLint on TypeScript files |
| `npm run rm` | Clean all build artifacts (dist, cache, dev) |

## Building the Extension

### Development Build

```bash
npm run dev
```

This will start Parcel in watch mode and output to `dev/` directory. Note: HMR (Hot Module Reloading) is disabled for extension compatibility.

### Production Build

```bash
npm run build
```

This creates an optimized build in `dist/` directory without source maps.

## Loading Extension in Browser

### Chrome

1. Build the extension: `npm run build`
2. Open `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` directory

### Firefox

**Note**: Building in the `app/` directory uses Chrome's manifest by default. For Firefox builds, use the root-level build scripts:

```bash
# From project root
./scripts/build-extension.sh firefox
```

Then load the extension from `app/dist/`:
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select any file in the `app/dist/` directory

## Build System

**Parcel 2.0.1** configuration:
- Bundles TypeScript to ES6
- Copies static files from `src/static/` to `dist/`
- No source maps in production
- Platform-specific manifest handling

**Manifest handling**:
- Source manifests: `manifest.json` (Chrome), `manifest.firefox.json` (Firefox)
- A prebuild hook automatically copies `manifest.json` (Chrome) to `src/static/manifest.json` before building
- **For Firefox builds**, you must use the root-level build scripts which will copy the Firefox manifest
- Platform-specific build command: `/scripts/build-extension.sh [chrome|firefox]`

**Build process**:
1. **Prebuild**: Copy manifest to `src/static/` (via `scripts/prepare-manifest.cjs`)
2. TypeScript compilation (strict mode, ES6 target)
3. Static file copy (`manifest.json`, `_locales/`, `assets/`)
4. Bundle optimization

## Architecture Overview

### Three-Layer Communication Model

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

**Why this structure?** Manifest V3 security restrictions require web page code to run in isolated context. The content script acts as a secure bridge between the web page and extension background.

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Service Worker | `background.ts` | Cache management, badge updates, message listening |
| Web Resources | `wresources.ts` | Main UI, search logic, GlobalStore state management |
| Content Script | `cscripts.ts` | Bridge layer, script injection |
| YouTube API | `assist.ts` | API calls, comment filtering, export logic |
| Template Renderer | `renderView.ts` | HTML template rendering |
| Popup UI | `b_action.ts` | Extension popup interface |

## Technical Documentation

For detailed information on Innertube API integration and implementation:

| Document | Topic |
|----------|-------|
| [Innertube Comments Integration](docs/innertube-comments-integration.md) | **Start here** - Unified guide for comment fetching |
| [API Migration Guide](docs/innertube-migration-guide.md) | Legacy vs new frameworkUpdates model |
| [Chat Replay API Changes](docs/innertube-chat-replay-api-changes.md) | playerOffsetMs → continuation tokens |
| [Implementation Alignment](docs/continuation-processing.md) | JS/TS code correspondence |

**Reading order**: Start with `innertube-comments-integration.md`, then refer to other docs as needed.

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| fuse.js | 6.6.2 | Fuzzy search engine |
| mark.js | 8.11.1 | Search result highlighting |
| idb | 7.0.2 | IndexedDB wrapper for caching |
| p-queue | 6.6.2 | Async queue for API rate limiting |
| fetch-retry | 5.0.3 | HTTP retry with exponential backoff |
| xlsx | 0.18.2 | Excel export functionality |
| html-entities | 2.6.0 | HTML entity encoding/decoding |

## Code Style

**EditorConfig** enforced:
- TypeScript/JavaScript: 4 spaces
- JSON/HTML/CSS: 2 spaces
- Line endings: LF (Unix)

**Prettier** formatting:
- Line width: 120 characters
- No trailing commas
- Single quotes

**ESLint**:
- TypeScript parser
- Strict type checking

Run linting:
```bash
npm run lint
```

## TypeScript Configuration

- Target: ES6
- Module: ES6 (Parcel handles bundling)
- Strict mode: Enabled
- Module resolution: Node
- Browser targets: Chrome 88+

## Platform Support

- **Chrome**: Manifest V3, minimum version 88
- **Firefox**: Compatible manifest variant

**Note**: This directory contains source manifests for both platforms (`manifest.json` for Chrome, `manifest.firefox.json` for Firefox). The appropriate manifest is copied to `src/static/manifest.json` during the build process at the project root level (see `/scripts/build-extension.sh`).
