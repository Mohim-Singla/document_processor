import { v4 as uuidv4 } from 'uuid';
import { mongoRepositories } from '../db/mongo/repository/index.js';
import { ragService } from '../service/ragService.js';
import { geminiService } from '../service/geminiService.js';
import { MESSAGE_SENDER } from '../utils/constant/status.js';
import { logger } from '../utils/logger.js';

const CONTEXT = 'queryController';

export async function querySession(req, res) {
  const SUB_CONTEXT = querySession.name;
  try {
    const { id: sessionId } = req.params;
    const userId = req.user.userId;
    const { prompt, stream = true } = req.body;

    logger.info('Received session query request', CONTEXT, SUB_CONTEXT, { sessionId, userId, stream, promptLength: prompt?.length });

    if (!prompt) {
      logger.warn('Query failed: Prompt is required', CONTEXT, SUB_CONTEXT);
      return res.error('Prompt is required', 'Validation Error', 400);
    }

    // IDOR Check: Ensure session belongs to this user
    const session = await mongoRepositories.sessions.fetchOne({ sessionId, userId });
    if (!session) {
      logger.warn('Session query rejected: unauthorized or not found', CONTEXT, SUB_CONTEXT, { sessionId, userId });
      return res.error('Session not found or unauthorized', 'FORBIDDEN', 404);
    }

    // 1. Retrieve top matching chunks from MongoDB scoped strictly by userId
    logger.info('Retrieving relevant chunks for query', CONTEXT, SUB_CONTEXT, { sessionId, userId });
    const relevantChunks = await ragService.retrieveRelevantChunks({
      sessionId,
      userId,
      query: prompt,
      topK: 5,
    });

    const citations = relevantChunks.map((c) => ({
      documentId: c.documentId,
      fileName: c.fileName || 'Document',
      pageNumber: c.pageNumber || 1,
      snippet: c.content.slice(0, 300),
      score: c.score,
    }));

    logger.info('Found relevant chunks for context', CONTEXT, SUB_CONTEXT, { chunkCount: relevantChunks.length });

    // Record user message with owner userId if not a retry of the last unanswered message
    const lastMsg = await mongoRepositories.chatMessages.findLastBySession(sessionId, { userId });
    const isRetryOfUnanswered = lastMsg && lastMsg.sender === MESSAGE_SENDER.USER && lastMsg.content === prompt;

    if (!isRetryOfUnanswered) {
      await mongoRepositories.chatMessages.create({
        messageId: uuidv4(),
        sessionId,
        userId,
        sender: MESSAGE_SENDER.USER,
        content: prompt,
        citations: [],
      });
    } else {
      logger.info('Retrying last unanswered prompt - reusing existing user message record', CONTEXT, SUB_CONTEXT, { sessionId });
    }

    // 2. Handle streaming response
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullAssistantReply = '';

      logger.info('Initiating LLM stream response', CONTEXT, SUB_CONTEXT, { sessionId });
      const generator = geminiService.streamRagCompletion({
        prompt,
        contextChunks: relevantChunks,
      });

      for await (const token of generator) {
        fullAssistantReply += token;
        res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
      }

      // Send citations at end of stream
      res.write(`data: ${JSON.stringify({ type: 'citations', citations })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();

      // Record assistant message with citations and owner userId
      await mongoRepositories.chatMessages.create({
        messageId: uuidv4(),
        sessionId,
        userId,
        sender: MESSAGE_SENDER.ASSISTANT,
        content: fullAssistantReply,
        citations,
      });

      logger.info('Streaming query completed successfully', CONTEXT, SUB_CONTEXT, { sessionId, replyLength: fullAssistantReply.length });
    } else {
      let fullAssistantReply = '';
      const generator = geminiService.streamRagCompletion({
        prompt,
        contextChunks: relevantChunks,
      });
      for await (const token of generator) {
        fullAssistantReply += token;
      }

      await mongoRepositories.chatMessages.create({
        messageId: uuidv4(),
        sessionId,
        userId,
        sender: MESSAGE_SENDER.ASSISTANT,
        content: fullAssistantReply,
        citations,
      });

      logger.info('Synchronous query completed successfully', CONTEXT, SUB_CONTEXT, { sessionId });
      return res.success('Query successful', {
        answer: fullAssistantReply,
        citations,
      });
    }
  } catch (error) {
    logger.error('Error during query execution', CONTEXT, SUB_CONTEXT, { error: error.message });

    // Clean up error message if it is stringified JSON (e.g. from Google Gemini API)
    let userFriendlyMessage = error.message;
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.error?.message) {
        // Double check if nested
        try {
          const inner = JSON.parse(parsed.error.message);
          userFriendlyMessage = inner.error?.message || parsed.error.message;
        } catch {
          userFriendlyMessage = parsed.error.message;
        }
      }
    } catch {
      // not JSON, use as is
    }

    if (!res.headersSent) {
      return res.error(userFriendlyMessage, 'QUERY_ERROR', 500);
    }
    res.write(`data: ${JSON.stringify({ type: 'error', message: userFriendlyMessage })}\n\n`);
    res.end();
  }
}

export async function getMessages(req, res) {
  const SUB_CONTEXT = getMessages.name;
  try {
    const { id: sessionId } = req.params;
    const userId = req.user.userId;

    logger.info('Fetching chat messages for session', CONTEXT, SUB_CONTEXT, { sessionId, userId });

    // IDOR Check: Ensure session belongs to this user
    const session = await mongoRepositories.sessions.fetchOne({ sessionId, userId });
    if (!session) {
      logger.warn('Get messages rejected: unauthorized or not found', CONTEXT, SUB_CONTEXT, { sessionId, userId });
      return res.error('Session not found or unauthorized', 'FORBIDDEN', 404);
    }

    const messages = await mongoRepositories.chatMessages.findBySession(sessionId, { userId });
    logger.info('Fetched chat messages successfully', CONTEXT, SUB_CONTEXT, { sessionId, messageCount: messages.length });
    return res.success('Messages retrieved successfully', messages);
  } catch (error) {
    logger.error('Error fetching messages', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to fetch messages', error.message, 500);
  }
}

export const queryController = {
  querySession,
  getMessages,
};
