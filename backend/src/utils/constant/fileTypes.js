export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'text/csv',
  'application/csv',
  'text/x-csv',
  'text/tab-separated-values',
  'text/tsv',
  'application/json',
  'text/json',
  'application/xml',
  'text/xml',
  'text/html',
  'application/x-yaml',
  'text/yaml',
  'text/x-yaml',
  'text/x-log',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/bmp',
  'image/tiff',
]);

export const ALLOWED_FILE_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.tsv',
  '.json',
  '.xml',
  '.html',
  '.htm',
  '.yaml',
  '.yml',
  '.log',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.tiff',
]);

export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE_BYTES: (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10) * 1024 * 1024, // Default: 10 MB
  MAX_FILES: parseInt(process.env.MAX_BATCH_FILE_COUNT, 10) || 5, // Default: 5 files
};

export const TEXT_FILE_EXTENSIONS = new Set([
  'txt', 'csv', 'tsv', 'json', 'md', 'markdown', 'log', 'xml', 'yaml', 'yml',
  'sql', 'html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'env', 'sh', 'py',
]);

export const TEXT_MIME_TYPES = new Set([
  'text/',
  'application/json',
  'application/xml',
  'application/x-yaml',
  'application/javascript',
]);

export const PREVIEW_LIMITS = {
  MAX_PREVIEW_BYTES: 250 * 1024, // 250 KB
};
