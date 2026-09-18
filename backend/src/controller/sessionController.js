import { v4 as uuidv4 } from 'uuid';
import { mongoRepositories } from '../db/mongo/repository/index.js';
import { SESSION_STATUS } from '../utils/constant/status.js';
import { logger } from '../utils/logger.js';
import { HTTP_STATUS, ERROR_CODES, PAGINATION } from '../utils/constant/index.js';

const CONTEXT = 'sessionController';

export async function listSessions(req, res) {
  const SUB_CONTEXT = listSessions.name;
  try {
    const {
      status = SESSION_STATUS.ACTIVE,
      cursor = null,
      limit = PAGINATION.DEFAULT_LIMIT,
      search = '',
    } = req.query;
    const userId = req.user.userId;

    logger.info('Listing sessions for user', CONTEXT, SUB_CONTEXT, { userId, status, cursor, limit, search });

    // Strict owner scoping: Only fetch sessions owned by this user that are not deleted
    const filter = { userId, isDeleted: false };
    if (status) {
      filter.status = status;
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$and = [
        {
          $or: [
            { title: { $regex: escaped, $options: 'i' } },
            { description: { $regex: escaped, $options: 'i' } },
          ],
        },
      ];
    }

    let parsedCursor = null;
    if (cursor) {
      try {
        parsedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
      } catch (err) {
        logger.warn('Invalid cursor provided', CONTEXT, SUB_CONTEXT, { cursor, error: err.message });
        return res.error('Invalid cursor format', ERROR_CODES.BAD_REQUEST, HTTP_STATUS.BAD_REQUEST);
      }
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MIN_LIMIT), PAGINATION.MAX_LIMIT);

    const result = await mongoRepositories.sessions.fetchPaginated({
      filter,
      cursor: parsedCursor,
      limit: parsedLimit,
    });

    logger.info('Fetched sessions successfully', CONTEXT, SUB_CONTEXT, {
      count: result.sessions.length,
      hasMore: result.hasMore,
    });

    return res.success('Sessions fetched successfully', result);
  } catch (error) {
    logger.error('Error fetching sessions', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to fetch sessions', error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
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
      return res.error('Session not found or unauthorized', ERROR_CODES.FORBIDDEN, HTTP_STATUS.NOT_FOUND);
    }

    logger.info('Session fetched successfully', CONTEXT, SUB_CONTEXT, { sessionId: id });
    return res.success('Session fetched successfully', session);
  } catch (error) {
    logger.error('Error fetching session by id', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to fetch session', error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
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
      return res.error('Session title is required', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
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
    return res.success('Session created successfully', newSession, HTTP_STATUS.CREATED);
  } catch (error) {
    logger.error('Error creating session', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to create session', error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
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
      return res.error('Session not found or unauthorized', ERROR_CODES.FORBIDDEN, HTTP_STATUS.NOT_FOUND);
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
    return res.error('Failed to update session', error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
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
      return res.error('Session not found or unauthorized', ERROR_CODES.FORBIDDEN, HTTP_STATUS.NOT_FOUND);
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
    return res.error('Failed to delete session', error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export const sessionController = {
  listSessions,
  getSessionById,
  createSession,
  updateSession,
  deleteSession,
};
