import { mongoRepositories } from '../db/mongo/repository/index.js';
import { geminiService } from './geminiService.js';

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
 * Searches top K chunks for a session given a query, scoped by owner userId to prevent IDOR
 */
export async function retrieveRelevantChunks({ sessionId, userId, query, topK = 5 }) {
  const filter = {};
  if (userId) {
    filter.userId = userId;
  }

  // Fetch only chunks owned by this user for this session
  const allChunks = await mongoRepositories.documentChunks.findBySession(sessionId, filter);
  if (!allChunks || allChunks.length === 0) {
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

  // Sort descending by score and pick top K
  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks.slice(0, topK);
}

export const ragService = {
  retrieveRelevantChunks,
};
