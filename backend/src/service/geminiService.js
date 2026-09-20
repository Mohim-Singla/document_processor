import { aiService } from './aiService.js';

/**
 * Adapter delegating to the unified multi-provider aiService.
 * Preserves backwards compatibility for any external callers or tests.
 */
export async function getEmbedding(text) {
  const res = await aiService.getEmbedding(text);
  return res.embedding || res;
}

export async function getEmbeddingsBatch(texts) {
  const res = await aiService.getEmbeddingsBatch(texts);
  return res.embeddings || res;
}

export async function getEmbeddingsForChunks(chunks, userId, options = {}) {
  return aiService.getEmbeddingsForChunks(chunks, userId, options);
}

export async function generateDocumentSummary(rawText) {
  const res = await aiService.generateDocumentSummary(rawText);
  return res.summary || res;
}

export async function* streamRagCompletion(params) {
  const generator = aiService.streamRagCompletion(params);
  for await (const chunk of generator) {
    if (typeof chunk === 'object' && chunk !== null && 'token' in chunk) {
      yield chunk.token;
    } else {
      yield chunk;
    }
  }
}

export const geminiService = {
  getEmbedding,
  getEmbeddingsBatch,
  getEmbeddingsForChunks,
  generateDocumentSummary,
  streamRagCompletion,
};
