import { v4 as uuidv4 } from 'uuid';
import { mongoRepositories } from '../db/mongo/repository/index.js';
import { ragService } from '../service/ragService.js';
import { geminiService } from '../service/geminiService.js';

export async function querySession(req, res) {
  try {
    const { id: sessionId } = req.params;
    const { prompt, stream = true } = req.body;

    if (!prompt) {
      return res.error('Prompt is required', 'Validation Error', 400);
    }

    // 1. Retrieve top matching chunks from MongoDB
    const relevantChunks = await ragService.retrieveRelevantChunks({
      sessionId,
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

    // Record user message
    await mongoRepositories.chatMessages.create({
      messageId: uuidv4(),
      sessionId,
      sender: 'USER',
      content: prompt,
      citations: [],
    });

    // 2. Handle streaming response
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullAssistantReply = '';

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

      // Record assistant message with citations
      await mongoRepositories.chatMessages.create({
        messageId: uuidv4(),
        sessionId,
        sender: 'ASSISTANT',
        content: fullAssistantReply,
        citations,
      });
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
        sender: 'ASSISTANT',
        content: fullAssistantReply,
        citations,
      });

      return res.success('Query successful', {
        answer: fullAssistantReply,
        citations,
      });
    }
  } catch (error) {
    console.error('Error during query:', error);
    if (!res.headersSent) {
      return res.error('Failed to query documents', error.message, 500);
    }
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
}

export async function getMessages(req, res) {
  try {
    const { id: sessionId } = req.params;
    const messages = await mongoRepositories.chatMessages.findBySession(sessionId);
    return res.success('Messages retrieved successfully', messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.error('Failed to fetch messages', error.message, 500);
  }
}

export const queryController = {
  querySession,
  getMessages,
};
