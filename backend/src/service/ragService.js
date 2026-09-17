import { mongoRepositories } from '../db/mongo/repository/index.js';
import { geminiService } from './geminiService.js';
import { RAG_CONFIG } from '../utils/constant/index.js';
import { logger } from '../utils/logger.js';

const CONTEXT = 'ragService';

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Searches top K chunks for a session given a query, scoped by owner userId to prevent IDOR.
 * Filters exclusively for active (non-deleted) documents and uses dynamic similarity
 * thresholding to prevent unrelated documents from contaminating query context and citations.
 */
export async function retrieveRelevantChunks({ sessionId, userId, query, topK = RAG_CONFIG.DEFAULT_TOP_K }) {
  const SUB_CONTEXT = retrieveRelevantChunks.name;
  logger.info('Retrieving relevant chunks for RAG search', CONTEXT, SUB_CONTEXT, { sessionId, userId, topK });

  if (!userId) {
    logger.error('retrieveRelevantChunks rejected: userId is strictly required for multi-tenant data isolation', CONTEXT, SUB_CONTEXT, { sessionId });
    throw new Error('Unauthorized: userId is required for chunk retrieval');
  }

  const docFilter = { sessionId, userId, isDeleted: false };
  const chunkFilter = { userId };

  // Concurrently fetch active documents, session chunks, and query embedding
  const [activeDocs, allChunks, queryEmbedding] = await Promise.all([
    mongoRepositories.documents.fetchAll(docFilter),
    mongoRepositories.documentChunks.findBySession(sessionId, chunkFilter),
    geminiService.getEmbedding(query),
  ]);

  if (!activeDocs || activeDocs.length === 0) {
    logger.warn('No active documents found for session', CONTEXT, SUB_CONTEXT, { sessionId });
    return [];
  }

  if (!allChunks || allChunks.length === 0) {
    logger.warn('No document chunks available for session', CONTEXT, SUB_CONTEXT, { sessionId });
    return [];
  }

  const activeDocMap = new Map(activeDocs.map((d) => [d.documentId, d.fileName]));

  // Keep only chunks belonging to active documents in this session
  const activeChunks = allChunks.filter((chunk) => activeDocMap.has(chunk.documentId));
  if (activeChunks.length === 0) {
    logger.warn('No active document chunks found for session', CONTEXT, SUB_CONTEXT, { sessionId });
    return [];
  }

  // 4. Compute similarity score for each active chunk
  const scoredChunks = activeChunks.map((chunk) => {
    let score = 0;
    if (chunk.embedding && chunk.embedding.length > 0) {
      score = cosineSimilarity(queryEmbedding, chunk.embedding);
    } else {
      const lowerQuery = query.toLowerCase();
      const lowerContent = chunk.content.toLowerCase();
      if (lowerContent.includes(lowerQuery)) score = RAG_CONFIG.KEYWORD_MATCH_FALLBACK_SCORE;
      else score = RAG_CONFIG.DEFAULT_FALLBACK_SCORE;
    }
    return {
      ...chunk,
      score,
      fileName: activeDocMap.get(chunk.documentId) || chunk.metadata?.fileName || 'Document',
    };
  });

  // 5. Sort all chunks descending by similarity score
  scoredChunks.sort((a, b) => b.score - a.score);

  const topScore = scoredChunks[0]?.score || 0;
  const minThreshold = RAG_CONFIG.MIN_SIMILARITY_THRESHOLD || 0.45;
  const relativeThreshold = RAG_CONFIG.RELATIVE_SCORE_THRESHOLD || 0.70;

  // Dynamic threshold: Chunks must meet both the minimum baseline and be within relative range of topScore
  const dynamicThreshold = Math.max(minThreshold, topScore * relativeThreshold);

  let selected = scoredChunks.filter((c) => c.score >= dynamicThreshold).slice(0, topK);

  // If no chunks pass the strict threshold, fallback to highest scoring chunks above fallback score
  if (selected.length === 0 && scoredChunks.length > 0) {
    selected = scoredChunks.filter((c) => c.score >= RAG_CONFIG.DEFAULT_FALLBACK_SCORE).slice(0, Math.min(3, topK));
  }

  logger.info('Relevant chunks scored and filtered', CONTEXT, SUB_CONTEXT, {
    totalEvaluated: activeChunks.length,
    activeDocumentsCount: activeDocMap.size,
    topScore,
    dynamicThreshold,
    selectedCount: selected.length,
    selectedSources: [...new Set(selected.map((c) => c.fileName))],
  });

  return selected;
}

export const ragService = {
  retrieveRelevantChunks,
};
