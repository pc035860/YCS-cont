# YCS Extension Source Code

This directory contains the source code for the YCS (YouTube Comment Search) browser extension. The extension enables searching, filtering, and exporting YouTube comments, replies, chat replays, and video transcripts.

## Directory Structure

```
app/
├── src/
│   ├── source/              # TypeScript source code
│   │   ├── background.ts    # Service Worker - cache and storage management
│   │   ├── content-scripts/ # Content Script bridge layer
│   │   │   ├── cscripts.ts  # Message relay, script injection
│   │   │   └── style.css    # Content script styles
│   │   ├── web-resources/   # Main search and UI logic
│   │   │   ├── wresources.ts     # Entry point
│   │   │   ├── bootstrap.ts      # App initialization & SPA handling
│   │   │   ├── appController.ts  # Core application logic
│   │   │   ├── state.ts          # State management
│   │   │   ├── search/           # Search pipeline modules
│   │   │   │   ├── types.ts           # Search context types
│   │   │   │   ├── commentsSearch.ts  # Comments search
│   │   │   │   ├── chatSearch.ts      # Chat replay search
│   │   │   │   └── transcriptSearch.ts # Transcript search
│   │   │   ├── ui/               # UI components
│   │   │   │   ├── render.ts            # Result rendering
│   │   │   │   ├── filters.ts           # Filter button management
│   │   │   │   └── commentInteractions.ts # Comment interactions
│   │   │   └── services/         # Service layer
│   │   │       ├── cacheService.ts      # Cache operations
│   │   │       └── exportService.ts     # Export/download
│   │   ├── browser-action/  # Extension popup UI
│   │   ├── options/         # Settings page and comment export
│   │   └── utils/           # Modular utility system
│   │       ├── assist.ts     # Module facade and unified export point
│   │       ├── common.ts     # Shared utilities and GlobalStore
│   │       ├── libs.ts       # External library wrappers (fetchR, IndexedDB)
│   │       ├── innertube/    # Modularized YouTube API integration
│   │       │   ├── innertube.ts      # Module facade
│   │       │   ├── core.ts           # Configuration & initialization
│   │       │   ├── request.ts        # Request building utilities
│   │       │   ├── authHeaders.ts    # Authorization header generation
│   │       │   ├── comments.ts       # Comment module entry
│   │       │   ├── comments/         # Comment processing
│   │       │   │   ├── pipeline.ts   # Fetching pipeline
│   │       │   │   └── normalize.ts  # Data normalization
│   │       │   ├── chat.ts           # Chat module entry
│   │       │   ├── chat/             # Chat replay processing
│   │       │   │   ├── liveChat.ts   # Live chat handling
│   │       │   │   ├── replayChat.ts # Replay chat handling
│   │       │   │   └── utils.ts      # Chat utilities
│   │       │   └── transcript.ts     # Transcript fetching
│   │       ├── filters/      # Comment and chat filtering modules
│   │       ├── formatting.ts # Data transformation and HTML output
│   │       ├── dom.ts        # DOM manipulation and UI interactions
│   │       ├── sheets.ts     # Excel export functionality
│   │       ├── renderView.ts # HTML template rendering
│   │       ├── viewModels.ts # View model interfaces and builders
│   │       ├── icons.ts      # SVG icon constants
│   │       ├── injections.ts # Script injection utilities (MV3)
│   │       └── interfaces/   # TypeScript type definitions
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
- Node.js 22+ (defined in `.nvmrc`)
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
| `npm run typecheck` | Run TypeScript type checking (no build) |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting without modifying |
| `npm run rm` | Clean all build artifacts (dist, cache, dev) |
| `npm test` | Run all tests with Node.js test runner |

## Testing

The project uses **Node.js built-in test runner** with TypeScript support:

```bash
npm test  # Run all tests
```

**Test Framework**:
- **Test runner**: Node.js `node:test` module
- **Assertion**: Node.js `node:assert` (strict mode)
- **TypeScript**: `--experimental-strip-types` flag + custom loader (`tests/ts-loader.mjs`)

**Test Files** (in `tests/` directory):
- `common.test.ts` - Common utilities (HTML entity decoding)
- `formatting.test.ts` - Data formatting (HTML escaping, URL normalization)
- `innertube.test.ts` - Innertube API (framework updates, badges, heart icons)
- `innertube-comments-pipeline.test.ts` - Comment processing pipeline
- `viewModels.test.ts` - View model construction

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
| YouTube API | `innertube.ts` | Innertube API integration, request handling |
| Filtering | `filters/*.ts` | Comment and chat filtering logic |
| Data Export | `sheets.ts` | Excel export functionality |
| Formatting | `formatting.ts` | Data transformation and HTML generation |
| UI Interactions | `dom.ts` | DOM manipulation and browser APIs |
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
| [SAPISID Authorization](docs/sap-sid-authorization.md) | SAPISID/APISID cookie-based auth headers |

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
| crypto-js | 4.2.0 | SHA-1 hashing for authorization headers |
| @types/crypto-js | 4.2.2 | TypeScript definitions |

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
