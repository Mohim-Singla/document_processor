import { v4 as uuidv4 } from 'uuid';
import { mongoRepositories } from '../db/mongo/repository/index.js';
import { s3Service } from '../service/s3Service.js';
import { parsingService } from '../service/parsingService.js';
import { geminiService } from '../service/geminiService.js';

export async function listDocuments(req, res) {
  try {
    const { id: sessionId } = req.params;
    const userId = req.user.userId;

    // IDOR Check: Ensure parent session belongs to this user
    const session = await mongoRepositories.sessions.fetchOne({ sessionId, userId });
    if (!session) {
      return res.error('Session not found or unauthorized', 'FORBIDDEN', 404);
    }

    const documents = await mongoRepositories.documents.fetchAll({ sessionId, userId });
    return res.success('Documents fetched successfully', documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.error('Failed to fetch documents', error.message, 500);
  }
}

export async function uploadDocuments(req, res) {
  try {
    const { id: sessionId } = req.params;
    const userId = req.user.userId;
    const files = req.files || [];

    if (files.length === 0) {
      return res.error('No files uploaded', 'Validation Error', 400);
    }

    // IDOR Check: Ensure target session belongs to the user
    const session = await mongoRepositories.sessions.fetchOne({ sessionId, userId });
    if (!session) {
      return res.error('Session not found or unauthorized', 'FORBIDDEN', 404);
    }

    const createdDocs = [];

    for (const file of files) {
      const documentId = uuidv4();
      const s3Key = `sessions/${sessionId}/${documentId}/${file.originalname}`;

      // 1. Upload raw file to S3
      const s3Result = await s3Service.uploadToS3({
        key: s3Key,
        buffer: file.buffer,
        mimeType: file.mimetype,
      });

      // 2. Insert record into MongoDB documents collection with owner userId
      const docRecord = await mongoRepositories.documents.create({
        documentId,
        sessionId,
        userId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        s3Key,
        s3Bucket: s3Result.bucket,
        status: 'PROCESSING',
      });

      createdDocs.push(docRecord);

      // 3. Process asynchronously (parse, embed, index)
      (async () => {
        try {
          const { pageCount, chunks } = await parsingService.parseDocument({
            buffer: file.buffer,
            fileName: file.originalname,
            mimeType: file.mimetype,
            documentId,
            sessionId,
          });

          // Attach owner userId to each chunk and compute embedding
          for (const chunk of chunks) {
            chunk.userId = userId;
            chunk.embedding = await geminiService.getEmbedding(chunk.content);
          }

          if (chunks.length > 0) {
            await mongoRepositories.documentChunks.bulkInsert(chunks);
          }

          await mongoRepositories.documents.update(
            { documentId, userId },
            { status: 'READY', pageCount }
          );

          // Increment documentCount on session
          await mongoRepositories.sessions.incrementDocCount(sessionId, 1);
        } catch (err) {
          console.error(`[Ingestion Error] doc ${documentId}:`, err);
          await mongoRepositories.documents.update(
            { documentId, userId },
            { status: 'FAILED', errorMessage: err.message }
          );
        }
      })();
    }

    return res.success('Documents uploaded and processing started', createdDocs, 202);
  } catch (error) {
    console.error('Error uploading documents:', error);
    return res.error('Failed to upload documents', error.message, 500);
  }
}

export async function getPreviewUrl(req, res) {
  try {
    const { docId } = req.params;
    const userId = req.user.userId;

    // IDOR Check: Ensure document belongs to this user
    const document = await mongoRepositories.documents.fetchOne({ documentId: docId, userId });

    if (!document) {
      return res.error('Document not found or unauthorized', 'FORBIDDEN', 404);
    }

    const url = await s3Service.getPresignedDownloadUrl({ key: document.s3Key });
    return res.success('Presigned preview URL generated', { url });
  } catch (error) {
    console.error('Error getting preview URL:', error);
    return res.error('Failed to generate preview URL', error.message, 500);
  }
}

export async function deleteDocument(req, res) {
  try {
    const { id: sessionId, docId } = req.params;
    const userId = req.user.userId;

    // IDOR Check: Ensure document belongs to this user and session
    const document = await mongoRepositories.documents.fetchOne({ documentId: docId, sessionId, userId });

    if (!document) {
      return res.error('Document not found or unauthorized', 'FORBIDDEN', 404);
    }

    await s3Service.deleteFromS3({ key: document.s3Key }).catch(() => {});
    await mongoRepositories.documentChunks.deleteByDocument(docId, { userId });
    await mongoRepositories.documents.destroy({ documentId: docId, userId });
    await mongoRepositories.sessions.incrementDocCount(sessionId, -1);

    return res.success('Document deleted successfully');
  } catch (error) {
    console.error('Error deleting document:', error);
    return res.error('Failed to delete document', error.message, 500);
  }
}

export const documentController = {
  listDocuments,
  uploadDocuments,
  getPreviewUrl,
  deleteDocument,
};
