// Standalone XLSX bundle. Injected into the page's MAIN world by the extension when the
// lazy xlsx chunk can't be loaded with a <script> tag (Safari + YouTube CSP). See
// loadXLSXViaExtension in services/exportFormats.ts.
import * as XLSX from 'xlsx';

(window as unknown as { __ycsXLSX?: unknown }).__ycsXLSX = XLSX;
