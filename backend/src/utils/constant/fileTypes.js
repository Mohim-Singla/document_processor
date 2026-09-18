export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
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
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.tiff',
]);

export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_FILES: 5,
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
