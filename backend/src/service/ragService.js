import { mongoRepositories } from '../db/mongo/repository/index.js';
import { geminiService } from './geminiService.js';
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
 * Implements document-fair diversified selection to ensure multi-document sessions
 * don't have one document completely crowd out the others.
 */
export async function retrieveRelevantChunks({ sessionId, userId, query, topK = 10 }) {
  const SUB_CONTEXT = retrieveRelevantChunks.name;
  logger.info('Retrieving relevant chunks for RAG search', CONTEXT, SUB_CONTEXT, { sessionId, userId, topK });

  const filter = {};
  if (userId) {
    filter.userId = userId;
  }

  // Fetch only chunks owned by this user for this session
  const allChunks = await mongoRepositories.documentChunks.findBySession(sessionId, filter);
  if (!allChunks || allChunks.length === 0) {
    logger.warn('No document chunks available for session', CONTEXT, SUB_CONTEXT, { sessionId });
    return [];
  }

  // Generate query embedding
  const queryEmbedding = await geminiService.getEmbedding(query);

  // Compute similarity score for each chunk
  const scoredChunks = allChunks.map((chunk) => {
    let score = 0;
    if (chunk.embedding && chunk.embedding.length > 0) {
      score = cosineSimilarity(queryEmbedding, chunk.embedding);
    } else {
      const lowerQuery = query.toLowerCase();
      const lowerContent = chunk.content.toLowerCase();
      if (lowerContent.includes(lowerQuery)) score = 0.8;
      else score = 0.1;
    }
    return {
      ...chunk,
      score,
      fileName: chunk.metadata?.fileName || 'Document',
    };
  });

  // Group chunks by documentId to ensure multi-document fairness
  const byDoc = {};
  for (const chunk of scoredChunks) {
    const docId = chunk.documentId || 'unknown';
    if (!byDoc[docId]) {
      byDoc[docId] = [];
    }
    byDoc[docId].push(chunk);
  }

  // Sort chunks within each document descending by score
  for (const docId of Object.keys(byDoc)) {
    byDoc[docId].sort((a, b) => b.score - a.score);
  }

  // Round-robin selection across distinct documents until topK is satisfied
  const selected = [];
  const docIds = Object.keys(byDoc);
  let round = 0;
  let addedInRound = true;

  while (selected.length < topK && addedInRound) {
    addedInRound = false;
    for (const docId of docIds) {
      if (round < byDoc[docId].length) {
        selected.push(byDoc[docId][round]);
        addedInRound = true;
        if (selected.length >= topK) break;
      }
    }
    round++;
  }

  // Final sort of selected excerpts by score descending
  selected.sort((a, b) => b.score - a.score);

  logger.info('Document-fair relevant chunks scored and selected', CONTEXT, SUB_CONTEXT, {
    totalEvaluated: allChunks.length,
    documentCount: docIds.length,
    selectedCount: selected.length,
    topScore: selected[0]?.score,
  });

  return selected;
}

export const ragService = {
  retrieveRelevantChunks,
};
