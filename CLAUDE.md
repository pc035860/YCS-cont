# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YCS (YouTube Comment Search) is a browser extension for Chrome and Firefox that enables searching, filtering, and exporting YouTube comments, replies, chat replays, and video transcripts.

- **Total codebase**: ~12,145 lines of TypeScript
- **Extension type**: Manifest V3 (MV3)
- **Build system**: Parcel 2.0.1
- **Target browsers**: Chrome 88+, Firefox

## Development Commands

```bash
# Development (from app/ directory)
cd app
npm run dev       # Start Parcel dev server (HMR disabled)
npm run build     # Production build → app/dist/
npm run rebuild   # Clean cache and rebuild
npm run lint      # Run ESLint
npm run typecheck # Run TypeScript type checking
npm run rm        # Clean all build artifacts

# Release workflow (from project root)
make release TYPE=patch   # Auto bump version, commit, tag, build, package
make release TYPE=minor
make release TYPE=major

# Manual build steps (if not using Makefile)
./scripts/bump-version.sh patch          # Update version in manifests
./scripts/build-extension.sh chrome      # Build Chrome version
./scripts/build-extension.sh firefox     # Build Firefox version
./scripts/package-extension.sh chrome    # Package as .zip
```

## Architecture

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

**Why this structure?**
MV3 security restrictions require web page code to run in isolated context. The content script acts as a secure bridge between web page and extension background.

### Key Directories

- **`app/src/source/`**: TypeScript source code
  - `background.ts`: Service Worker, manages cache and storage
  - `content-scripts/`: Content script bridge
  - `web-resources/`: Main search and UI logic
  - `utils/`: Modular utility system
    - `innertube.ts`: YouTube Innertube API integration
    - `filters/`: Comment and chat filtering modules
    - `formatting.ts`: Data transformation and HTML output
    - `dom.ts`: DOM manipulation and UI interactions
    - `sheets.ts`: Excel export functionality
    - `common.ts`: Shared utilities and GlobalStore
    - `renderView.ts`: HTML template rendering
    - `interfaces/`: TypeScript type definitions
  - `options/`: Extension settings page and comment export
  - `browser-action/`: Extension popup UI

- **`app/src/static/`**: Static assets copied by Parcel
  - `manifest.json`: Chrome manifest
  - `_locales/en/`: Internationalization files
  - `assets/images/`: Extension icons

- **`app/docs/`**: Technical documentation (4 files)
  - `innertube-comments-integration.md`: Unified guide for comment integration and continuation handling
  - `innertube-migration-guide.md`: Migration guide from legacy to frameworkUpdates-driven comment model
  - `innertube-chat-replay-api-changes.md`: Chat replay API migration (playerOffsetMs → continuation tokens)
  - `continuation-processing.md`: JS/TS implementation alignment reference

- **`scripts/`**: Build automation
  - `build-extension.sh`: Platform-specific manifest selection and build
  - `package-extension.sh`: Create versioned .zip packages
  - `bump-version.sh`: Update version in manifests

- **`packing/`**: Release artifacts
  - `chrome-{version}.zip`
  - `firefox-{version}.zip`

### Extension Manifest Files

- **`app/manifest.json`**: Chrome MV3 manifest (in app root)
- **`app/manifest.firefox.json`**: Firefox-specific manifest
- **Build process**: Copies the appropriate manifest to `app/src/static/manifest.json` before build

## Important Dependencies

| Package | Usage |
|---------|-------|
| `fuse.js` v6.6.2 | Fuzzy search engine for comments |
| `mark.js` v8.11.1 | Search result highlighting |
| `idb` v7.0.2 | IndexedDB wrapper for caching |
| `p-queue` v6.6.2 | Async queue for API rate limiting |
| `fetch-retry` v5.0.3 | HTTP retry with exponential backoff |
| `xlsx` v0.18.2 | Excel export functionality |
| `html-entities` v2.6.0 | HTML entity encoding/decoding |

## Build System

### Parcel Configuration (`.parcelrc`)

- **Static file copy**: Uses `parcel-reporter-static-files-copy` to copy `app/src/static/` to `app/dist/`
- **No source maps in production**: Disabled to reduce bundle size
- **TypeScript**: ES6 target, strict mode enabled

### Build Scripts Flow

1. **`build-extension.sh [chrome|firefox]`**
   - Copies platform-specific manifest from `app/manifest.json` or `app/manifest.firefox.json` to `app/src/static/manifest.json`
   - Runs `npm run build` in app/ directory
   - Outputs to `app/dist/`

2. **`package-extension.sh [chrome|firefox]`**
   - Reads version from built manifest in `app/dist/manifest.json`
   - Creates `packing/{platform}-{version}.zip` from `app/dist/`

3. **`bump-version.sh [major|minor|patch]`**
   - Updates version in both `app/manifest.json` and `app/manifest.firefox.json`
   - Uses semantic versioning

### Makefile Workflow

The `Makefile` automates the entire release process:

```bash
make release TYPE=patch
```

This will:
1. Run `bump-version.sh` to increment version
2. Git commit with message "Bump version to {version}"
3. Create git tag "v{version}"
4. Build and package both Chrome and Firefox versions
5. Output `.zip` files to `packing/`

## Code Architecture Patterns

### GlobalStore Pattern

Runtime state management using IIFE closure pattern. See `app/src/source/web-resources/wresources.ts` for implementation.

### IndexedDB Cache Strategy

- **Store name**: `STORE_CACHE_YCS`
- **Key**: YouTube video ID
- **Data**: `{ videoId, body }` (comment/transcript data)
- **Auto cleanup**: Clears cache when storage quota exceeded
- **Quota limit**: 200 MB (configurable in options)

Implementation in `app/src/source/background.ts`.

### Message Passing

Three-layer communication using `window.postMessage()` (Web Page ↔ Content Script) and `chrome.runtime.sendMessage()` (Content Script ↔ Service Worker).

See the Architecture section above for communication flow details.

### Retry Mechanism

Uses `fetch-retry` with exponential backoff (2s → 10s → 60s, max 100 retries) to handle YouTube API instability. Implemented in `utils/innertube.ts`.

## TypeScript Configuration

- **Target**: ES6
- **Module**: ES6 (Parcel handles bundling)
- **Strict**: Enabled
- **Module Resolution**: Node
- **ESM Interop**: Enabled
- **Types**: `@types/chrome`, `@types/mark.js`

## Code Style

- **Language**: All code documentation, comments, commit messages, and technical documents must be written in English

- **Formatter**: Prettier
  - **Config file**: `app/.prettierrc.json`
  - **Key settings**:
    - Line width: 120 chars
    - Single quotes: true
    - No trailing commas
    - LF line endings
    - Semi-colons: true
  - **Usage**:
    ```bash
    # Format specific files
    npx prettier --write path/to/file.ts

    # Format entire source directory
    npx prettier --write "src/**/*.{ts,js,json,css,html}"

    # Check formatting without modifying files
    npx prettier --check "src/**/*.{ts,js,json,css,html}"
    ```
  - **When to format**:
    - Before committing code changes
    - After completing a feature or bug fix
    - When resolving merge conflicts
  - **Note**: Most IDEs can auto-format on save using the Prettier config

- **Linter**: ESLint with TypeScript parser
  - Run with `npm run lint` from `app/` directory
  - Config: `app/.eslintrc.cjs`

- **Indentation**:
  - TS/JS: 4 spaces (enforced by `.editorconfig`)
  - JSON/HTML/CSS: 2 spaces
  - Makefile: Tabs

## Repository Structure History

**Important**: This repository was migrated from a dual-repo structure (YCS + YCS_origin) to a single repo in commit b59aeaa (2025-01-18).

- **Before**: Source code in separate YCS_origin repo, build output in YCS repo
- **After**: All source code and build output in single YCS repo
- **Migration**: Extension build folder renamed from root to `app/`
- **Build system**: Updated to work with single-repo structure

## Known Issues and Solutions

### SPA Navigation (v1.3.9)

**Issue**: Extension fails to load when navigating from YouTube homepage to video page.

**Solution**: Hybrid approach implemented in commit 591db80:
- Listen to YouTube native `yt-navigate-finish` event
- Fallback to `popstate` event
- Polling fallback for DOM-not-ready scenarios
- Retry mechanism with duplicate initialization prevention

### Bundle Size Optimization

The extension experienced a ~97% size increase in v1.3.9 (908KB → 1792KB) due to Parcel code splitting creating duplicate chunks. Monitor `app/dist/` output when modifying build configuration.

## Testing

This project does not have automated unit tests. Testing is done manually by:
1. Loading unpacked extension from `app/dist/` in Chrome/Firefox
2. Testing on YouTube video pages with comments
3. Verifying search, filtering, and export functionality

## Multi-Platform Support

### Chrome vs Firefox Differences

Both platforms use mostly identical code, with only manifest differences:

**Chrome** (`manifest.json`):
- `action` key for toolbar icon
- `scripting` permission for dynamic injection

**Firefox** (`manifest.firefox.json`):
- `browser_action` key (older Firefox versions)
- Identical otherwise

Build scripts handle platform selection automatically.

## YouTube Innertube API Integration

The extension integrates with YouTube's internal Innertube API for fetching comments, chat replays, and transcripts. Important technical documentation is located in `app/docs/`.

### API Architecture

**Two-Track System**: The codebase supports both legacy and new Innertube API response formats:

- **Legacy**: Direct `runs` arrays for comment content
- **New (frameworkUpdates)**: Entity-based updates via `frameworkUpdates.entityBatchUpdate.mutations`

All Innertube API logic is implemented in `app/src/source/utils/innertube.ts` with type definitions in `utils/interfaces/i_assist.ts`.

### Core Functionality

The implementation handles three main areas:
- **Comment Fetching**: frameworkUpdates processing, runs migration, continuation handling
- **Chat Replay**: Three-tier fallback mechanism for API structure detection
- **Pagination**: Dual support for legacy (`playerOffsetMs`) and new (`continuation` tokens) systems

For detailed function reference, see `app/docs/innertube-comments-integration.md`.

### Documentation Files

Reading `app/docs/` is essential for working with Innertube API code:

| File | Purpose | Use When |
|------|---------|----------|
| `innertube-comments-integration.md` | Unified entry point for comment integration | Starting work on comment features |
| `innertube-migration-guide.md` | Detailed frameworkUpdates migration guide | Understanding the new API model |
| `innertube-chat-replay-api-changes.md` | Chat replay API changes and implementation | Working on chat replay features |
| `continuation-processing.md` | JS/TS implementation alignment | Verifying code consistency |

**Documentation Dependency**:
```
innertube-comments-integration.md (start here)
    ↓
    ├── innertube-migration-guide.md (comment details)
    │   └── continuation-processing.md (implementation reference)
    │
    └── innertube-chat-replay-api-changes.md (chat implementation)
```

### Common Pitfalls

- Always check for both legacy and new response structures
- Use frameworkUpdates as source of truth when available
- Handle missing continuation tokens gracefully
- Test with various video types (live streams, premieres, regular videos)
- Verify chat replay works with both ongoing and completed streams
