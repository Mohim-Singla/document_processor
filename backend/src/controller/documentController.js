import { v4 as uuidv4 } from 'uuid';
import { mongoRepositories } from '../db/mongo/repository/index.js';
import { s3Service } from '../service/s3Service.js';
import { sqsProducer } from '../sqs/producer/index.js';
import { processDocumentJob } from '../sqs/consumer/documentConsumer.js';
import { DOCUMENT_STATUS, SESSION_STATUS, HTTP_STATUS, ERROR_CODES, TEXT_FILE_EXTENSIONS, TEXT_MIME_TYPES, PREVIEW_LIMITS } from '../utils/constant/index.js';
import { logger } from '../utils/logger.js';

const CONTEXT = 'documentController';

function sanitizeDocument(doc) {
  if (!doc) return doc;
  if (Array.isArray(doc)) {
    return doc.map(sanitizeDocument);
  }
  const plainDoc = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  delete plainDoc.errorMessage;
  return plainDoc;
}

export async function listDocuments(req, res) {
  const SUB_CONTEXT = listDocuments.name;
  try {
    const { id: sessionId } = req.params;
    const userId = req.user.userId;

    logger.info('Listing documents for session', CONTEXT, SUB_CONTEXT, { sessionId, userId });

    // IDOR Check: Ensure parent session belongs to this user
    const session = await mongoRepositories.sessions.fetchOne({ sessionId, userId });
    if (!session) {
      logger.warn('Session not found or unauthorized for document list', CONTEXT, SUB_CONTEXT, { sessionId, userId });
      return res.error('Session not found or unauthorized', ERROR_CODES.FORBIDDEN, HTTP_STATUS.NOT_FOUND);
    }

    const documents = await mongoRepositories.documents.fetchAll({ sessionId, userId });
    logger.info('Documents listed successfully', CONTEXT, SUB_CONTEXT, { sessionId, count: documents.length });
    return res.success('Documents fetched successfully', sanitizeDocument(documents));
  } catch (error) {
    logger.error('Error fetching documents', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to fetch documents', error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function uploadDocuments(req, res) {
  const SUB_CONTEXT = uploadDocuments.name;
  try {
    const { id: sessionId } = req.params;
    const userId = req.user.userId;
    const files = req.files || [];

    logger.info('Received document upload request', CONTEXT, SUB_CONTEXT, { sessionId, userId, fileCount: files.length });

    if (files.length === 0) {
      logger.warn('Document upload failed: No files provided', CONTEXT, SUB_CONTEXT);
      return res.error('No files uploaded', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
    }

    // IDOR Check: Ensure target session belongs to the user
    const session = await mongoRepositories.sessions.fetchOne({ sessionId, userId });
    if (!session) {
      logger.warn('Session not found or unauthorized for document upload', CONTEXT, SUB_CONTEXT, { sessionId, userId });
      return res.error('Session not found or unauthorized', ERROR_CODES.FORBIDDEN, HTTP_STATUS.NOT_FOUND);
    }

    // Archive guard: Block uploads on archived sessions
    if (session.status === SESSION_STATUS.ARCHIVED) {
      logger.warn('Document upload blocked on archived session', CONTEXT, SUB_CONTEXT, { sessionId, userId });
      return res.error('This session is archived. Restore it to upload documents.', ERROR_CODES.SESSION_ARCHIVED, HTTP_STATUS.FORBIDDEN);
    }

    const createdDocs = [];

    for (const file of files) {
      const documentId = uuidv4();
      const s3Key = `sessions/${sessionId}/${documentId}/${file.originalname}`;

      logger.info('Uploading file to S3', CONTEXT, SUB_CONTEXT, { documentId, fileName: file.originalname, size: file.size });

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
        status: DOCUMENT_STATUS.PROCESSING,
      });

      createdDocs.push(docRecord);

      // Increment session documentCount immediately on document creation
      await mongoRepositories.sessions.incrementDocCount(sessionId, 1);

      // 3. Queue job via AWS SQS for worker processing (with in-process fallback if SQS fails/disabled)
      const jobPayload = {
        documentId,
        sessionId,
        userId,
        s3Key,
        fileName: file.originalname,
        mimeType: file.mimetype,
      };

      try {
        await sqsProducer.sendDocumentJob(jobPayload);
        logger.info('Document processing queued via SQS successfully', CONTEXT, SUB_CONTEXT, { documentId });
      } catch (sqsErr) {
        logger.warn('Failed to queue to SQS. Falling back to local in-process ingestion', CONTEXT, SUB_CONTEXT, {
          documentId,
          error: sqsErr.message,
        });

        // In-process fallback: directly invoke worker processing job with in-memory buffer
        setImmediate(() => {
          processDocumentJob({
            ...jobPayload,
            buffer: file.buffer,
          }).catch((fallbackErr) => {
            logger.error('Local fallback document ingestion failed', CONTEXT, 'processAsyncDocumentFallback', {
              documentId,
              error: fallbackErr.message,
            });
          });
        });
      }
    }

    return res.success('Documents uploaded and processing started', sanitizeDocument(createdDocs), HTTP_STATUS.ACCEPTED);
  } catch (error) {
    logger.error('Error uploading documents', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to upload documents', error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

function isTextFile(fileName, mimeType) {
  if (mimeType) {
    for (const prefix of TEXT_MIME_TYPES) {
      if (mimeType.startsWith(prefix) || mimeType === prefix) return true;
    }
  }
  const ext = fileName?.split('.').pop()?.toLowerCase();
  return ext ? TEXT_FILE_EXTENSIONS.has(ext) : false;
}

export async function getPreviewUrl(req, res) {
  const SUB_CONTEXT = getPreviewUrl.name;
  try {
    const { id: sessionId, docId } = req.params;
    const userId = req.user.userId;

    logger.info('Generating presigned preview URL', CONTEXT, SUB_CONTEXT, { sessionId, docId, userId });

    // IDOR Check: Ensure parent session exists and belongs to this user
    if (sessionId) {
      const session = await mongoRepositories.sessions.fetchOne({ sessionId, userId });
      if (!session) {
        logger.warn('Parent session not found or unauthorized for preview', CONTEXT, SUB_CONTEXT, { sessionId, userId });
        return res.error('Session not found or unauthorized', ERROR_CODES.FORBIDDEN, HTTP_STATUS.NOT_FOUND);
      }
    }

    // IDOR Check: Ensure document belongs to this user and session
    const docQuery = { documentId: docId, userId };
    if (sessionId) docQuery.sessionId = sessionId;
    const document = await mongoRepositories.documents.fetchOne(docQuery);

    if (!document) {
      logger.warn('Document not found or unauthorized for preview', CONTEXT, SUB_CONTEXT, { docId, userId });
      return res.error('Document not found or unauthorized', ERROR_CODES.FORBIDDEN, HTTP_STATUS.NOT_FOUND);
    }

    const [url, downloadUrl] = await Promise.all([
      s3Service.getPresignedDownloadUrl({ key: document.s3Key }),
      s3Service.getPresignedDownloadUrl({
        key: document.s3Key,
        fileName: document.fileName,
        asAttachment: true,
      }),
    ]);

    const isText = isTextFile(document.fileName, document.mimeType);
    let previewText = null;
    let isTruncated = false;
    const MAX_PREVIEW_BYTES = PREVIEW_LIMITS.MAX_PREVIEW_BYTES; // 250 KB

    if (isText) {
      const isLarge = document.fileSize && document.fileSize > MAX_PREVIEW_BYTES;
      const range = isLarge ? `bytes=0-${MAX_PREVIEW_BYTES - 1}` : undefined;
      try {
        const textBuffer = await s3Service.getObjectBuffer({
          key: document.s3Key,
          range,
        });
        previewText = textBuffer.toString('utf8');
        isTruncated = isLarge || (document.fileSize ? document.fileSize > textBuffer.length : textBuffer.length >= MAX_PREVIEW_BYTES);
      } catch (err) {
        logger.warn('Failed to load text snippet for preview', CONTEXT, SUB_CONTEXT, { error: err.message, docId });
      }
    }

    logger.info('Preview and download URLs generated successfully', CONTEXT, SUB_CONTEXT, { docId, isText, isTruncated });
    return res.success('Presigned preview URL generated', {
      url,
      downloadUrl,
      summary: document.summary || null,
      pageCount: document.pageCount || 0,
      fileName: document.fileName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      previewText,
      isTruncated,
      maxPreviewBytes: MAX_PREVIEW_BYTES,
    });
  } catch (error) {
    logger.error('Error getting preview URL', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to generate preview URL', error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function deleteDocument(req, res) {
  const SUB_CONTEXT = deleteDocument.name;
  try {
    const { id: sessionId, docId } = req.params;
    const userId = req.user.userId;

    logger.info('Deleting document (soft delete)', CONTEXT, SUB_CONTEXT, { sessionId, docId, userId });

    // IDOR Check: Ensure parent session exists and belongs to this user
    const session = await mongoRepositories.sessions.fetchOne({ sessionId, userId });
    if (!session) {
      logger.warn('Parent session not found or unauthorized for document delete', CONTEXT, SUB_CONTEXT, { sessionId, userId });
      return res.error('Session not found or unauthorized', ERROR_CODES.FORBIDDEN, HTTP_STATUS.NOT_FOUND);
    }

    // IDOR Check: Ensure document belongs to this user and session and is not already deleted
    const document = await mongoRepositories.documents.fetchOne({ documentId: docId, sessionId, userId });

    if (!document) {
      logger.warn('Document not found or unauthorized for deletion', CONTEXT, SUB_CONTEXT, { sessionId, docId, userId });
      return res.error('Document not found or unauthorized', ERROR_CODES.FORBIDDEN, HTTP_STATUS.NOT_FOUND);
    }

    // Soft delete document and its chunks (S3 file remains intact)
    await mongoRepositories.documentChunks.softDeleteByDocument(docId, { userId });
    await mongoRepositories.documents.softDelete({ documentId: docId, userId });
    await mongoRepositories.sessions.incrementDocCount(sessionId, -1);

    logger.info('Document soft-deleted successfully', CONTEXT, SUB_CONTEXT, { docId });
    return res.success('Document deleted successfully');
  } catch (error) {
    logger.error('Error deleting document', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to delete document', error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function retryDocument(req, res) {
  const SUB_CONTEXT = retryDocument.name;
  try {
    const { id: sessionId, docId } = req.params;
    const userId = req.user.userId;

    logger.info('Retrying document ingestion', CONTEXT, SUB_CONTEXT, { sessionId, docId, userId });

    // IDOR Check: Ensure parent session exists and belongs to this user
    const session = await mongoRepositories.sessions.fetchOne({ sessionId, userId });
    if (!session) {
      logger.warn('Parent session not found or unauthorized for document retry', CONTEXT, SUB_CONTEXT, { sessionId, userId });
      return res.error('Session not found or unauthorized', ERROR_CODES.FORBIDDEN, HTTP_STATUS.NOT_FOUND);
    }

    // Archive guard: Block document retry on archived sessions
    if (session.status === SESSION_STATUS.ARCHIVED) {
      logger.warn('Document retry blocked on archived session', CONTEXT, SUB_CONTEXT, { sessionId, userId });
      return res.error('This session is archived. Restore it to retry documents.', ERROR_CODES.SESSION_ARCHIVED, HTTP_STATUS.FORBIDDEN);
    }

    // IDOR Check: Ensure document belongs to this user and session
    const document = await mongoRepositories.documents.fetchOne({ documentId: docId, sessionId, userId });

    if (!document) {
      logger.warn('Document not found or unauthorized for retry', CONTEXT, SUB_CONTEXT, { sessionId, docId, userId });
      return res.error('Document not found or unauthorized', ERROR_CODES.FORBIDDEN, HTTP_STATUS.NOT_FOUND);
    }

    // Clean up any previously stored chunks from prior failed attempt
    await mongoRepositories.documentChunks.softDeleteByDocument(docId, { userId });

    // Reset status to PROCESSING and clear error message
    const updatedDoc = await mongoRepositories.documents.update(
      { documentId: docId, userId },
      { status: DOCUMENT_STATUS.PROCESSING, errorMessage: null }
    );

    // Queue job via AWS SQS for worker processing (with fallback)
    const jobPayload = {
      documentId: document.documentId,
      sessionId: document.sessionId,
      userId,
      s3Key: document.s3Key,
      fileName: document.fileName,
      mimeType: document.mimeType,
    };

    try {
      await sqsProducer.sendDocumentJob(jobPayload);
      logger.info('Document retry job queued via SQS successfully', CONTEXT, SUB_CONTEXT, { documentId: docId });
    } catch (sqsErr) {
      logger.warn('Failed to queue retry to SQS. Falling back to in-process ingestion', CONTEXT, SUB_CONTEXT, {
        documentId: docId,
        error: sqsErr.message,
      });

      // In-process fallback: directly invoke worker processing job
      setImmediate(() => {
        processDocumentJob(jobPayload).catch((fallbackErr) => {
          logger.error('Local fallback document retry ingestion failed', CONTEXT, 'processAsyncDocumentRetryFallback', {
            documentId: docId,
            error: fallbackErr.message,
          });
        });
      });
    }

    return res.success('Document retry scheduled successfully', sanitizeDocument(updatedDoc), HTTP_STATUS.OK);
  } catch (error) {
    logger.error('Error retrying document', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to retry document', error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export const documentController = {
  listDocuments,
  uploadDocuments,
  getPreviewUrl,
  deleteDocument,
  retryDocument,
};
