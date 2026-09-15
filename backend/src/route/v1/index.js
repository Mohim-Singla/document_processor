import express from 'express';
import multer from 'multer';
import { sessionController, documentController, queryController, authController } from '../../controller/index.js';
import { authenticateToken } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/requestValidator.js';
import { authSchema } from '../../apiValidations/auth.js';
import { fileFilter } from '../../middleware/fileFilter.js';
import { UPLOAD_LIMITS } from '../../utils/constant/index.js';

const router = new express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: UPLOAD_LIMITS.MAX_FILE_SIZE_BYTES,
    files: UPLOAD_LIMITS.MAX_FILES,
  },
});

// Middleware wrapper for multer error handling
function handleUpload(req, res, next) {
  upload.array('files')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.error(
          `File size exceeds the limit of ${UPLOAD_LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB per file.`,
          'FILE_SIZE_EXCEEDED',
          400
        );
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.error(
          `Maximum ${UPLOAD_LIMITS.MAX_FILES} files can be uploaded at once.`,
          'TOO_MANY_FILES',
          400
        );
      }
      return res.error(err.message, 'FILE_UPLOAD_ERROR', 400);
    }
    if (err) {
      return res.error(err.message, 'INVALID_FILE_TYPE', 400);
    }
    next();
  });
}

// Public Auth Endpoints
router.post('/auth/signup', validateRequest(authSchema.signup.body), authController.signup);
router.post('/auth/login', validateRequest(authSchema.login.body), authController.login);

// Protected User Profile
router.get('/auth/me', authenticateToken, authController.getCurrentUser);

// Protected Session Endpoints (validated with Bearer token at middleware level)
router.get('/sessions', authenticateToken, sessionController.listSessions);
router.get('/sessions/:id', authenticateToken, sessionController.getSessionById);
router.post('/sessions', authenticateToken, sessionController.createSession);
router.patch('/sessions/:id', authenticateToken, sessionController.updateSession);
router.delete('/sessions/:id', authenticateToken, sessionController.deleteSession);

// Protected Document Endpoints
router.get('/sessions/:id/documents', authenticateToken, documentController.listDocuments);
router.post('/sessions/:id/documents', authenticateToken, handleUpload, documentController.uploadDocuments);
router.get('/sessions/:id/documents/:docId/preview', authenticateToken, documentController.getPreviewUrl);
router.post('/sessions/:id/documents/:docId/retry', authenticateToken, documentController.retryDocument);
router.delete('/sessions/:id/documents/:docId', authenticateToken, documentController.deleteDocument);

// Protected Query & Chat Endpoints
router.post('/sessions/:id/query', authenticateToken, queryController.querySession);
router.get('/sessions/:id/messages', authenticateToken, queryController.getMessages);

export const v1 = router;
