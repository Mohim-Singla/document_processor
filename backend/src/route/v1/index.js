import express from 'express';
import multer from 'multer';
import { sessionController, documentController, queryController } from '../../controller/index.js';

const router = new express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Session Routes
router.get('/sessions', sessionController.listSessions);
router.post('/sessions', sessionController.createSession);
router.patch('/sessions/:id', sessionController.updateSession);
router.delete('/sessions/:id', sessionController.deleteSession);

// Document Routes
router.get('/sessions/:id/documents', documentController.listDocuments);
router.post('/sessions/:id/documents', upload.array('files'), documentController.uploadDocuments);
router.get('/sessions/:id/documents/:docId/preview', documentController.getPreviewUrl);
router.delete('/sessions/:id/documents/:docId', documentController.deleteDocument);

// Query & Chat Routes
router.post('/sessions/:id/query', queryController.querySession);
router.get('/sessions/:id/messages', queryController.getMessages);

export const v1 = router;
