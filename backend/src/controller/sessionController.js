import { v4 as uuidv4 } from 'uuid';
import { mongoRepositories } from '../db/mongo/repository/index.js';
import { s3Service } from '../service/s3Service.js';

export async function listSessions(req, res) {
  try {
    const { status = 'ACTIVE' } = req.query;
    const filter = {};
    if (status) {
      filter.status = status;
    }
    const sessions = await mongoRepositories.sessions.fetchAll(filter);
    return res.success('Sessions fetched successfully', sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return res.error('Failed to fetch sessions', error.message, 500);
  }
}

export async function createSession(req, res) {
  try {
    const { title, description } = req.body;
    if (!title) {
      return res.error('Session title is required', 'Validation Error', 400);
    }

    const sessionId = uuidv4();
    const newSession = await mongoRepositories.sessions.create({
      sessionId,
      title,
      description: description || null,
      status: 'ACTIVE',
      documentCount: 0,
    });

    return res.success('Session created successfully', newSession, 201);
  } catch (error) {
    console.error('Error creating session:', error);
    return res.error('Failed to create session', error.message, 500);
  }
}

export async function updateSession(req, res) {
  try {
    const { id } = req.params;
    const { title, description, status } = req.body;

    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (status !== undefined) updateFields.status = status;

    const updated = await mongoRepositories.sessions.update(
      { sessionId: id },
      updateFields
    );

    return res.success('Session updated successfully', updated);
  } catch (error) {
    console.error('Error updating session:', error);
    return res.error('Failed to update session', error.message, 500);
  }
}

export async function deleteSession(req, res) {
  try {
    const { id } = req.params;

    // 1. Delete all S3 files belonging to this session
    const docs = await mongoRepositories.documents.fetchAll({ sessionId: id });
    for (const doc of docs) {
      if (doc.s3Key) {
        await s3Service.deleteFromS3({ key: doc.s3Key }).catch(() => {});
      }
    }

    // 2. Cascade cleanup across all MongoDB collections
    await Promise.all([
      mongoRepositories.documentChunks.deleteBySession(id),
      mongoRepositories.chatMessages.deleteBySession(id),
      mongoRepositories.documents.deleteBySession(id),
      mongoRepositories.sessions.destroy({ sessionId: id }),
    ]);

    return res.success('Session and associated documents deleted successfully');
  } catch (error) {
    console.error('Error deleting session:', error);
    return res.error('Failed to delete session', error.message, 500);
  }
}

export const sessionController = {
  listSessions,
  createSession,
  updateSession,
  deleteSession,
};
