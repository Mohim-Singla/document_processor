import { v4 as uuidv4 } from 'uuid';
import { mongoRepositories } from '../db/mongo/repository/index.js';
import { s3Service } from '../service/s3Service.js';
import { parsingService } from '../service/parsingService.js';
import { geminiService } from '../service/geminiService.js';

export async function listDocuments(req, res) {
  try {
    const { id } = req.params;
    const documents = await mongoRepositories.documents.fetchAll({ sessionId: id });
    return res.success('Documents fetched successfully', documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.error('Failed to fetch documents', error.message, 500);
  }
}

export async function uploadDocuments(req, res) {
  try {
    const { id: sessionId } = req.params;
    const files = req.files || [];

    if (files.length === 0) {
      return res.error('No files uploaded', 'Validation Error', 400);
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

      // 2. Insert record into MongoDB documents collection
      const docRecord = await mongoRepositories.documents.create({
        documentId,
        sessionId,
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

          // Compute embeddings for all chunks
          for (const chunk of chunks) {
            chunk.embedding = await geminiService.getEmbedding(chunk.content);
          }

          if (chunks.length > 0) {
            await mongoRepositories.documentChunks.bulkInsert(chunks);
          }

          await mongoRepositories.documents.update(
            { documentId },
            { status: 'READY', pageCount }
          );

          // Increment documentCount on session
          await mongoRepositories.sessions.incrementDocCount(sessionId, 1);
        } catch (err) {
          console.error(`[Ingestion Error] doc ${documentId}:`, err);
          await mongoRepositories.documents.update(
            { documentId },
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
    const document = await mongoRepositories.documents.fetchOne({ documentId: docId });

    if (!document) {
      return res.error('Document not found', 'Not Found', 404);
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
    const document = await mongoRepositories.documents.fetchOne({ documentId: docId });

    if (document) {
      await s3Service.deleteFromS3({ key: document.s3Key }).catch(() => {});
      await mongoRepositories.documentChunks.deleteByDocument(docId);
      await mongoRepositories.documents.destroy({ documentId: docId });
      await mongoRepositories.sessions.incrementDocCount(sessionId, -1);
    }

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
