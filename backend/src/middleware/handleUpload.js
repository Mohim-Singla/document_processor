import multer from 'multer';
import { fileFilter } from './fileFilter.js';
import { UPLOAD_LIMITS, HTTP_STATUS, ERROR_CODES } from '../utils/constant/index.js';

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: UPLOAD_LIMITS.MAX_FILE_SIZE_BYTES,
    files: UPLOAD_LIMITS.MAX_FILES,
  },
});

/**
 * Middleware wrapper for multer error handling and file validation
 */
export function handleUpload(req, res, next) {
  upload.array('files')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.error(
          `File size exceeds the limit of ${UPLOAD_LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB per file.`,
          ERROR_CODES.FILE_SIZE_EXCEEDED,
          HTTP_STATUS.BAD_REQUEST
        );
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.error(
          `Maximum ${UPLOAD_LIMITS.MAX_FILES} files can be uploaded at once.`,
          ERROR_CODES.TOO_MANY_FILES,
          HTTP_STATUS.BAD_REQUEST
        );
      }
      return res.error(err.message, ERROR_CODES.FILE_UPLOAD_ERROR, HTTP_STATUS.BAD_REQUEST);
    }
    if (err) {
      return res.error(err.message, ERROR_CODES.INVALID_FILE_TYPE, HTTP_STATUS.BAD_REQUEST);
    }
    return next();
  });
}
