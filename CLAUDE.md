# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YCS (YouTube Comment Search) is a browser extension for Chrome and Firefox that enables searching, filtering, and exporting YouTube comments, replies, chat replays, and video transcripts.

- **Extension type**: Manifest V3 (MV3)
- **Build system**: Parcel 2.0.1
- **Target browsers**: Chrome 88+, Firefox
- **Main branch**: `v2-source` (default branch for development and releases)
- **Node.js version**: 22+ (defined in `app/.nvmrc`)

## Development Commands

```bash
# Development (from app/ directory)
cd app
npm run dev       # Start Parcel dev server (HMR disabled)
npm run build     # Production build → app/dist/
npm run rebuild   # Clean cache and rebuild
npm run lint      # Run ESLint
npm run typecheck # Run TypeScript type checking
npm run format    # Format code with Prettier
npm run format:check # Check code formatting without modifying
npm test          # Run tests with Node.js test runner
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
  - `background.ts`: Service Worker (cache, storage management)
  - `content-scripts/`: Message relay bridge (web page ↔ extension)
  - **`web-resources/`**: Main search and UI logic
    - `wresources.ts`: Entry point for web page layer
    - `bootstrap.ts`: Initialization and SPA navigation handling
    - `appController.ts`: Core application control logic
    - `state.ts`: WebResourcesState management
    - `search/`: Search modules (comments, chat, transcript)
    - `ui/`: UI components (render, filters, interactions)
    - `services/`: Service layer (cache, export)
  - **`utils/`**: Modular utility system
    - `assist.ts`: Module facade and unified export point
    - `common.ts`: Shared utilities and GlobalStore
    - `libs.ts`: External library wrappers (fetchR, IndexedDB)
    - `dom.ts`, `formatting.ts`: DOM and data transformation
    - `innertube/`: Modularized YouTube API integration
      - `comments/`: Comment fetching and processing pipeline
      - `chat/`: Chat replay modules (live/replay)
      - `core.ts`, `request.ts`, `transcript.ts`: Core utilities
    - `filters/`: Comment and chat filtering modules
    - `sheets.ts`: Excel export functionality
    - `renderView.ts`, `viewModels.ts`: HTML rendering and view models
    - `interfaces/`: TypeScript type definitions (CommentItem, ChatItem, etc.)
  - `options/`: Extension settings page
  - `browser-action/`: Extension popup UI

- **`app/src/static/`**: Static assets (manifest, locales, icons)
- **`app/docs/`**: Technical documentation (Innertube API integration guides)
- **`scripts/`**: Build automation (build, package, version bump)
- **`packing/`**: Release artifacts (.zip files)

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
| `url-regex` v5.0.0 | URL pattern matching |
| `object-scan` v18.3.4 | Deep object scanning utility |

## Build System

### Parcel Configuration (`.parcelrc`)

- **Static file copy**: Uses `parcel-reporter-static-files-copy` to copy `app/src/static/` to `app/dist/`
- **No source maps in production**: Disabled to reduce bundle size
- **TypeScript**: ES6 target, strict mode enabled

### Build Scripts Flow

1. **`build-extension.sh [chrome|firefox]`** - Copies platform-specific manifest to `app/src/static/`, runs `npm run build`, outputs to `app/dist/`
2. **`package-extension.sh [chrome|firefox]`** - Creates `packing/{platform}-{version}.zip` from `app/dist/`
3. **`bump-version.sh [major|minor|patch]`** - Updates version in both manifests using semantic versioning

### Makefile Workflow

The `Makefile` automates the entire release process:

```bash
make release TYPE=patch
```

Steps: bump version → git commit/tag → build/package both platforms → output to `packing/`

## Code Architecture Patterns

### Module Facade Pattern

The utility layer uses a facade pattern via `utils/assist.ts` as a unified export point. This provides centralized module exports and clear dependency hierarchy (common → dom → formatting → filters → innertube → sheets).

Example: `import { getVideoId, formatLikes } from '../utils/assist';`

### GlobalStore Pattern

Runtime state management using IIFE closure pattern. See `app/src/source/web-resources/wresources.ts` for implementation.

### Web Resources State Management

`web-resources/state.ts` provides a functional state container with comments, chat data, transcript, counters, and abort controller.

### IndexedDB Cache Strategy

- **Store**: `STORE_CACHE_YCS` (key: video ID, data: comment/transcript)
- **Auto cleanup**: Clears cache when storage quota exceeded
- **Quota limit**: 200 MB (configurable in options)
- **Implementation**: `app/src/source/background.ts`

### Message Passing

Three-layer communication using `window.postMessage()` (Web Page ↔ Content Script) and `chrome.runtime.sendMessage()` (Content Script ↔ Service Worker). See Architecture section above.

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

- **Formatter**: Prettier (`app/.prettierrc.json`)
  - Line width: 120 chars, single quotes, LF endings, semicolons
  - Usage: `npx prettier --write "src/**/*.{ts,js,json,css,html}"`
  - Format before committing, after feature completion, when resolving merge conflicts
  - Most IDEs can auto-format on save

- **Linter**: ESLint with TypeScript parser (`npm run lint` from `app/`)
  - Config: `app/.eslintrc.cjs`
  - Key rules:
    - `no-console`: OFF (extension debugging)
    - `@typescript-eslint/no-explicit-any`: OFF (YouTube API complexity)
    - `prefer-const`: WARN
    - `@typescript-eslint/no-unused-vars`: WARN (allow `_` prefix)

- **Indentation**:
  - TS/JS: 4 spaces (`.editorconfig`)
  - JSON/HTML/CSS: 2 spaces
  - Makefile: Tabs

- **Naming Conventions**:
  - **Variables**: camelCase (`videoId`, `currentIndex`)
  - **Constants**: UPPER_SNAKE_CASE (`STORE_CACHE_YCS`, `MAX_RETRIES`)
  - **Functions**: camelCase with verb (`getVideoId()`, `processComment()`)
  - **Classes/Interfaces**: PascalCase (`CommentItem`, `CacheData`)
  - **Type aliases**: PascalCase (`type ReplyContinuation = ...`)
  - **Unused params**: `_` prefix (`_event: Event`)
  - **Files**: camelCase (`cacheService.ts`, `innertube.ts`)
  - **Type definition files**: `i_` prefix (`i_types.ts`, `i_assist.ts`)

- **Documentation**:
  - Do not include file line numbers in documentation
  - Do not add test coverage reports to documentation
  - Avoid temporal markers (e.g., "Updated", "Updated on YYYY/MM/DD", "New") unless explicitly requested
  - Documentation should reflect the current state, not historical changes

## Git Workflow

- **Main branch**: `v2-source` (default branch for development and releases)
- All development work should be based on this branch
- The project uses Husky pre-commit hooks for automatic formatting and linting

## Testing

### Automated Testing

The project uses **Node.js built-in test runner** with TypeScript support:

- **Test runner**: Node.js `node:test` module
- **Assertion**: Node.js `node:assert` (strict mode)
- **TypeScript**: `--experimental-strip-types` flag + custom loader
- **Command**: `npm test` (from `app/` directory)

**Test files** (in `app/tests/`):
- `common.test.ts` - Common utilities
- `formatting.test.ts` - Data formatting
- `innertube.test.ts` - Innertube API
- `innertube-comments-pipeline.test.ts` - Comment pipeline
- `viewModels.test.ts` - View models

Example:
```typescript
import { strict as assert } from 'node:assert';
import test from 'node:test';

test('description', () => {
    assert.equal(myFunction(input), expected);
});
```

### Manual Testing

1. Load unpacked extension from `app/dist/` in Chrome/Firefox
2. Test on YouTube video pages with comments
3. Verify search, filtering, and export functionality

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

The extension integrates with YouTube's internal Innertube API for fetching comments, chat replays, and transcripts.

- **Dual-track support**: Legacy and frameworkUpdates-driven response formats
- **Key modules**: Comment fetching, chat replay, pagination handling
- **Documentation**: See `app/docs/innertube-*.md` for detailed implementation guides

Implementation: `app/src/source/utils/innertube/` with type definitions in `utils/interfaces/i_assist.ts`
