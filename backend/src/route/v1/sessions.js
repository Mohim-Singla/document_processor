import express from 'express';
import { sessionController, documentController, queryController } from '../../controller/index.js';
import { authenticateToken } from '../../middleware/auth.js';
import { handleUpload } from '../../middleware/handleUpload.js';

const router = new express.Router();

// Protected Session Endpoints
router.get('/', authenticateToken, sessionController.listSessions);
router.get('/:id', authenticateToken, sessionController.getSessionById);
router.post('/', authenticateToken, sessionController.createSession);
router.patch('/:id', authenticateToken, sessionController.updateSession);
router.delete('/:id', authenticateToken, sessionController.deleteSession);

// Protected Document Endpoints
router.get('/:id/documents', authenticateToken, documentController.listDocuments);
router.post('/:id/documents', authenticateToken, handleUpload, documentController.uploadDocuments);
router.get('/:id/documents/:docId/preview', authenticateToken, documentController.getPreviewUrl);
router.post('/:id/documents/:docId/retry', authenticateToken, documentController.retryDocument);
router.delete('/:id/documents/:docId', authenticateToken, documentController.deleteDocument);

// Protected Query & Chat Endpoints
router.post('/:id/query', authenticateToken, queryController.querySession);
router.get('/:id/messages', authenticateToken, queryController.getMessages);

export const sessionsRouter = router;
