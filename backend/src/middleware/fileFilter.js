import path from 'path';
import { ALLOWED_MIME_TYPES, ALLOWED_FILE_EXTENSIONS } from '../utils/constant/fileTypes.js';
import { logger } from '../utils/logger.js';

const CONTEXT = 'fileFilterMiddleware';

/**
 * Multer file filter to validate MIME types and file extensions.
 * Rejects unsupported file formats before memory buffering or processing.
 */
export function fileFilter(req, file, cb) {
  const SUB_CONTEXT = fileFilter.name;
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype?.toLowerCase();

  const isMimeAllowed = ALLOWED_MIME_TYPES.has(mimeType);
  const isExtAllowed = ALLOWED_FILE_EXTENSIONS.has(ext);

  if (!isMimeAllowed || !isExtAllowed) {
    logger.warn('File upload rejected: Unsupported file type', CONTEXT, SUB_CONTEXT, {
      fileName: file.originalname,
      mimeType,
      ext,
    });
    return cb(
      new Error(`Unsupported file type '${ext || mimeType}'. Allowed types: PDF, DOCX, TXT, PNG, JPEG, WEBP, BMP, TIFF.`),
      false
    );
  }

  return cb(null, true);
}
