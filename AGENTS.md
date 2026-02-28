# AGENTS.md

Please refer directly to `CLAUDE.md` for the complete development guide, architecture documentation, code style guidelines, and technical details of this project.

`CLAUDE.md` contains:
- Project overview and development commands
- Architecture design and directory structure
- Code style and naming conventions
- Testing guidelines
- YouTube Innertube API integration documentation
- Other important technical documentation

## Cursor Cloud specific instructions

### Project overview

YCS (YouTube Comment Search) is an MV3 browser extension (Chrome/Firefox). There is no backend server or database — it is a pure client-side extension with a Node.js build toolchain. All dev commands run from the `app/` directory.

### Quick reference

See `CLAUDE.md` and `README.md` for the full command list. The essential commands from `app/`:

- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript type checking
- `npm test` — Node.js test runner (163 tests)
- `npm run build` — production build to `app/dist/`
- `npm run dev` — dev server with watch mode (serves on `http://localhost:1234`)
- `npm run format:check` — Prettier format check

### Loading the extension in Chrome

1. Run `npm run build` from `app/` to produce `app/dist/`.
2. Open `chrome://extensions`, enable Developer mode.
3. Click "Load unpacked" and select the **`app/dist/` folder** (not the `manifest.json` file directly — Chrome requires selecting the folder).

### Gotchas

- Node.js 22+ is required (`.nvmrc` specifies `22`). The VM already has it pre-installed.
- Husky pre-commit hook runs `typecheck`, `test`, and `lint-staged`. Keep staged changes minimal before committing.
- The `npm run dev` Parcel server is for asset serving during development, not for running the extension. To test the extension end-to-end, load `app/dist/` in Chrome after running `npm run build`.
- The test command uses `--experimental-strip-types` and `--experimental-loader` flags — deprecation warnings about `--experimental-loader` are expected and harmless.

