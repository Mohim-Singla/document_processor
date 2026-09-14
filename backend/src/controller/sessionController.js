import { v4 as uuidv4 } from 'uuid';
import { mongoRepositories } from '../db/mongo/repository/index.js';
import { s3Service } from '../service/s3Service.js';
import { SESSION_STATUS } from '../utils/constant/status.js';
import { logger } from '../utils/logger.js';

const CONTEXT = 'sessionController';

export async function listSessions(req, res) {
  const SUB_CONTEXT = listSessions.name;
  try {
    const { status = SESSION_STATUS.ACTIVE } = req.query;
    const userId = req.user.userId;

    logger.info('Listing sessions for user', CONTEXT, SUB_CONTEXT, { userId, status });

    // Strict owner scoping: Only fetch sessions owned by this user that are not deleted
    const filter = { userId, isDeleted: false };
    if (status) {
      filter.status = status;
    }

    const sessions = await mongoRepositories.sessions.fetchAll(filter);
    logger.info('Fetched sessions successfully', CONTEXT, SUB_CONTEXT, { count: sessions.length });
    return res.success('Sessions fetched successfully', sessions);
  } catch (error) {
    logger.error('Error fetching sessions', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to fetch sessions', error.message, 500);
  }
}

export async function getSessionById(req, res) {
  const SUB_CONTEXT = getSessionById.name;
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    logger.info('Fetching session by ID', CONTEXT, SUB_CONTEXT, { sessionId: id, userId });

    // IDOR Check: Ensure session exists and belongs to this user and is not deleted
    const session = await mongoRepositories.sessions.fetchOne({ sessionId: id, userId });
    if (!session) {
      logger.warn('Session not found or access denied', CONTEXT, SUB_CONTEXT, { sessionId: id, userId });
      return res.error('Session not found or unauthorized', 'FORBIDDEN', 404);
    }

    logger.info('Session fetched successfully', CONTEXT, SUB_CONTEXT, { sessionId: id });
    return res.success('Session fetched successfully', session);
  } catch (error) {
    logger.error('Error fetching session by id', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to fetch session', error.message, 500);
  }
}

export async function createSession(req, res) {
  const SUB_CONTEXT = createSession.name;
  try {
    const { title, description } = req.body;
    const userId = req.user.userId;

    logger.info('Creating new session', CONTEXT, SUB_CONTEXT, { title, userId });

    if (!title) {
      logger.warn('Creation failed: session title is required', CONTEXT, SUB_CONTEXT);
      return res.error('Session title is required', 'Validation Error', 400);
    }

    const sessionId = uuidv4();
    const newSession = await mongoRepositories.sessions.create({
      sessionId,
      userId,
      title,
      description: description || null,
      status: SESSION_STATUS.ACTIVE,
      documentCount: 0,
      isDeleted: false,
      deletedAt: null,
    });

    logger.info('Session created successfully', CONTEXT, SUB_CONTEXT, { sessionId, title });
    return res.success('Session created successfully', newSession, 201);
  } catch (error) {
    logger.error('Error creating session', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to create session', error.message, 500);
  }
}

export async function updateSession(req, res) {
  const SUB_CONTEXT = updateSession.name;
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { title, description, status } = req.body;

    logger.info('Updating session', CONTEXT, SUB_CONTEXT, { sessionId: id, userId, status, title });

    // IDOR Check: Ensure session exists and belongs to the authenticated user
    const existing = await mongoRepositories.sessions.fetchOne({ sessionId: id, userId });
    if (!existing) {
      logger.warn('Session update failed: not found or unauthorized', CONTEXT, SUB_CONTEXT, { sessionId: id, userId });
      return res.error('Session not found or unauthorized', 'FORBIDDEN', 404);
    }

    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (status !== undefined) updateFields.status = status;

    const updated = await mongoRepositories.sessions.update(
      { sessionId: id, userId },
      updateFields
    );

    logger.info('Session updated successfully', CONTEXT, SUB_CONTEXT, { sessionId: id });
    return res.success('Session updated successfully', updated);
  } catch (error) {
    logger.error('Error updating session', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to update session', error.message, 500);
  }
}

export async function deleteSession(req, res) {
  const SUB_CONTEXT = deleteSession.name;
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    logger.info('Deleting session (soft delete)', CONTEXT, SUB_CONTEXT, { sessionId: id, userId });

    // IDOR Check: Ensure session belongs to the user and is not already deleted
    const session = await mongoRepositories.sessions.fetchOne({ sessionId: id, userId });
    if (!session) {
      logger.warn('Session delete failed: not found or unauthorized', CONTEXT, SUB_CONTEXT, { sessionId: id, userId });
      return res.error('Session not found or unauthorized', 'FORBIDDEN', 404);
    }

    // Cascade soft delete across MongoDB collections (S3 documents are kept intact)
    await Promise.all([
      mongoRepositories.documentChunks.softDeleteBySession(id, { userId }),
      mongoRepositories.chatMessages.softDeleteBySession(id, { userId }),
      mongoRepositories.documents.softDeleteBySession(id, { userId }),
      mongoRepositories.sessions.softDelete({ sessionId: id, userId }),
    ]);

    logger.info('Session and associated documents soft-deleted successfully', CONTEXT, SUB_CONTEXT, { sessionId: id });
    return res.success('Session and associated documents deleted successfully');
  } catch (error) {
    logger.error('Error deleting session', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to delete session', error.message, 500);
  }
}

export const sessionController = {
  listSessions,
  getSessionById,
  createSession,
  updateSession,
  deleteSession,
};
