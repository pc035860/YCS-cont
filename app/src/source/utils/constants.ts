export const EXPORT_FORMAT = {
    TXT: 'txt',
    JSON: 'json',
    XLSX: 'xlsx',
    SRT: 'srt'
} as const;

export type ExportFormat = (typeof EXPORT_FORMAT)[keyof typeof EXPORT_FORMAT];
