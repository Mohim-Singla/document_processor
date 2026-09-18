import { v4 as uuidv4 } from 'uuid';
import { mongoRepositories } from '../db/mongo/repository/index.js';
import { ragService } from '../service/ragService.js';
import { geminiService } from '../service/geminiService.js';
import { MESSAGE_SENDER, SESSION_STATUS, HTTP_STATUS, ERROR_CODES, RAG_CONFIG, SSE_CONFIG, GEMINI_CONFIG } from '../utils/constant/index.js';
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
      return res.error('Prompt is required', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
    }

    // IDOR Check: Ensure session belongs to this user
    const session = await mongoRepositories.sessions.fetchOne({ sessionId, userId });
    if (!session) {
      logger.warn('Session query rejected: unauthorized or not found', CONTEXT, SUB_CONTEXT, { sessionId, userId });
      return res.error('Session not found or unauthorized', ERROR_CODES.FORBIDDEN, HTTP_STATUS.NOT_FOUND);
    }

    // Archive guard: Block queries on archived sessions
    if (session.status === SESSION_STATUS.ARCHIVED) {
      logger.warn('Query blocked on archived session', CONTEXT, SUB_CONTEXT, { sessionId, userId });
      return res.error('This session is archived. Restore it to ask questions.', ERROR_CODES.SESSION_ARCHIVED, HTTP_STATUS.FORBIDDEN);
    }

    // 1. Retrieve top matching chunks from MongoDB scoped strictly by userId
    logger.info('Retrieving relevant chunks for query', CONTEXT, SUB_CONTEXT, { sessionId, userId });
    const relevantChunks = await ragService.retrieveRelevantChunks({
      sessionId,
      userId,
      query: prompt,
      topK: RAG_CONFIG.DEFAULT_TOP_K,
    });

    logger.info('Found relevant chunks for context', CONTEXT, SUB_CONTEXT, { chunkCount: relevantChunks.length });

    // Retrieve past messages (4-6 messages) to maintain conversational context
    const priorChatHistory = await mongoRepositories.chatMessages.findRecentBySession(
      sessionId,
      { userId },
      GEMINI_CONFIG.CHAT_HISTORY_MESSAGE_LIMIT
    );

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

    const extractUsedCitations = (fullReply) => {
      const citationMatches = [...fullReply.matchAll(/\[(\d+)\]/g)];
      const citedIndices = new Set(
        citationMatches
          .map((m) => parseInt(m[1], 10))
          .filter((n) => n >= 1 && n <= relevantChunks.length)
      );

      const usedChunks = citedIndices.size > 0
        ? relevantChunks.filter((_, idx) => citedIndices.has(idx + 1))
        : relevantChunks;

      return usedChunks.map((c) => ({
        documentId: c.documentId,
        fileName: c.fileName || RAG_CONFIG.DEFAULT_DOCUMENT_NAME,
        pageNumber: c.pageNumber || 1,
        snippet: c.content.slice(0, RAG_CONFIG.SNIPPET_MAX_LENGTH),
        score: c.score,
      }));
    };

    // 2. Handle streaming response
    if (stream) {
      res.setHeader('Content-Type', SSE_CONFIG.HEADERS.CONTENT_TYPE);
      res.setHeader('Cache-Control', SSE_CONFIG.HEADERS.CACHE_CONTROL);
      res.setHeader('Connection', SSE_CONFIG.HEADERS.CONNECTION);

      let fullAssistantReply = '';

      logger.info('Initiating LLM stream response', CONTEXT, SUB_CONTEXT, { sessionId, historyCount: priorChatHistory.length });
      const generator = geminiService.streamRagCompletion({
        prompt,
        contextChunks: relevantChunks,
        chatHistory: priorChatHistory,
      });

      for await (const token of generator) {
        fullAssistantReply += token;
        res.write(`data: ${JSON.stringify({ type: SSE_CONFIG.EVENT_TYPES.TOKEN, content: token })}\n\n`);
      }

      const citations = extractUsedCitations(fullAssistantReply);

      // Send citations at end of stream
      res.write(`data: ${JSON.stringify({ type: SSE_CONFIG.EVENT_TYPES.CITATIONS, citations })}\n\n`);
      res.write(SSE_CONFIG.DONE_MESSAGE);
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

      logger.info('Streaming query completed successfully', CONTEXT, SUB_CONTEXT, { sessionId, replyLength: fullAssistantReply.length, citationCount: citations.length });
    } else {
      let fullAssistantReply = '';
      const generator = geminiService.streamRagCompletion({
        prompt,
        contextChunks: relevantChunks,
        chatHistory: priorChatHistory,
      });
      for await (const token of generator) {
        fullAssistantReply += token;
      }

      const citations = extractUsedCitations(fullAssistantReply);

      await mongoRepositories.chatMessages.create({
        messageId: uuidv4(),
        sessionId,
        userId,
        sender: MESSAGE_SENDER.ASSISTANT,
        content: fullAssistantReply,
        citations,
      });

      logger.info('Synchronous query completed successfully', CONTEXT, SUB_CONTEXT, { sessionId, citationCount: citations.length });
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
      return res.error(userFriendlyMessage, ERROR_CODES.QUERY_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
    res.write(`data: ${JSON.stringify({ type: SSE_CONFIG.EVENT_TYPES.ERROR, message: userFriendlyMessage })}\n\n`);
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
      return res.error('Session not found or unauthorized', ERROR_CODES.FORBIDDEN, HTTP_STATUS.NOT_FOUND);
    }

    const messages = await mongoRepositories.chatMessages.findBySession(sessionId, { userId });
    logger.info('Fetched chat messages successfully', CONTEXT, SUB_CONTEXT, { sessionId, messageCount: messages.length });
    return res.success('Messages retrieved successfully', messages);
  } catch (error) {
    logger.error('Error fetching messages', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to fetch messages', error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export const queryController = {
  querySession,
  getMessages,
};
