export const EXPORT_FORMAT = {
    TXT: 'txt',
    JSON: 'json',
    XLSX: 'xlsx',
    SRT: 'srt'
} as const;

export type ExportFormat = (typeof EXPORT_FORMAT)[keyof typeof EXPORT_FORMAT];

const EXPORT_FORMAT_VALUES: ReadonlySet<string> = new Set(Object.values(EXPORT_FORMAT));

export const isExportFormat = (value: string | undefined): value is ExportFormat => {
    return typeof value === 'string' && EXPORT_FORMAT_VALUES.has(value);
};
