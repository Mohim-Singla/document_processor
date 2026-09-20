import { logger } from '../../utils/logger.js';
import { GEMINI_CONFIG } from '../../utils/constant/index.js';

const CONTEXT = 'BaseAIService';

/**
 * Base abstract class for all AI provider services.
 * Defines standard contract for embeddings, summaries, and streaming RAG completions.
 */
export class BaseAIService {
  constructor(vendorName) {
    if (new.target === BaseAIService) {
      throw new TypeError('Cannot construct BaseAIService instances directly.');
    }
    this.vendorName = vendorName;
  }

  /**
   * Generates vector embedding for a single text string.
   * @param {string} text
   * @returns {Promise<{ embedding: number[], aiVendor: string, aiModel: string }>}
   */
  async getEmbedding(/* text */) {
    throw new Error(`getEmbedding() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Generates vector embeddings for an array of texts.
   * @param {string[]} texts
   * @returns {Promise<{ embeddings: number[][], aiVendor: string, aiModel: string }>}
   */
  async getEmbeddingsBatch(/* texts */) {
    throw new Error(`getEmbeddingsBatch() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Computes embeddings for an array of chunk objects using batched requests with controlled concurrency.
   * Mutates each chunk in-place by setting `chunk.embedding`, `chunk.userId`, `chunk.aiVendor`, and `chunk.aiModel`.
   *
   * @param {Object[]} chunks - Array of chunk objects with `.content` property
   * @param {string} userId - User ID to set on each chunk
   * @param {Object} [options]
   * @param {string} [options.summary] - Optional document summary to contextualize chunk embeddings
   * @param {string} [options.fileName] - Optional file name to contextualize chunk embeddings
   * @param {number} [options.batchSize] - Texts per API call
   * @param {number} [options.concurrency] - Parallel batch requests
   * @returns {Promise<Object[]>} The same chunks array with embeddings & metadata populated
   */
  async getEmbeddingsForChunks(chunks, userId, options = {}) {
    const SUB_CONTEXT = `${this.constructor.name}.getEmbeddingsForChunks`;
    if (!chunks || chunks.length === 0) return chunks;

    const { summary = '', fileName = '' } = options;
    const batchSize = options.batchSize || GEMINI_CONFIG.EMBEDDING_BATCH_SIZE || 50;
    const concurrency = options.concurrency || GEMINI_CONFIG.EMBEDDING_BATCH_CONCURRENCY || 2;

    logger.info(`[${this.vendorName}] Starting batched embedding computation for chunks`, CONTEXT, SUB_CONTEXT, {
      totalChunks: chunks.length,
      batchSize,
      concurrency,
      hasSummary: Boolean(summary),
      estimatedBatches: Math.ceil(chunks.length / batchSize),
    });

    const startTime = Date.now();

    const formatTextForEmbedding = (chunk) => {
      const chunkFileName = fileName || chunk.metadata?.fileName || '';
      const parts = [];
      if (chunkFileName) {
        parts.push(`Document: ${chunkFileName}`);
      }
      if (summary) {
        parts.push(`Summary: ${summary}`);
      }
      parts.push(`Content:\n${chunk.content}`);
      return parts.join('\n\n');
    };

    // Split chunks into batches
    const batches = [];
    for (let i = 0; i < chunks.length; i += batchSize) {
      batches.push(chunks.slice(i, i + batchSize));
    }

    // Process batches with controlled concurrency
    for (let waveStart = 0; waveStart < batches.length; waveStart += concurrency) {
      const wave = batches.slice(waveStart, waveStart + concurrency);
      const waveNumber = Math.floor(waveStart / concurrency) + 1;
      const totalWaves = Math.ceil(batches.length / concurrency);

      logger.info(`[${this.vendorName}] Processing embedding wave ${waveNumber}/${totalWaves}`, CONTEXT, SUB_CONTEXT, {
        batchesInWave: wave.length,
        chunksInWave: wave.reduce((sum, b) => sum + b.length, 0),
      });

      const waveResults = await Promise.all(
        wave.map((batch) => this.getEmbeddingsBatch(batch.map(formatTextForEmbedding)))
      );

      // Assign embeddings and provider metadata back to chunks
      for (let batchIdx = 0; batchIdx < wave.length; batchIdx++) {
        const batch = wave[batchIdx];
        const result = waveResults[batchIdx];
        const embeddings = result.embeddings || [];
        for (let j = 0; j < batch.length; j++) {
          batch[j].userId = userId;
          batch[j].embedding = embeddings[j] || [];
          batch[j].aiVendor = result.aiVendor || this.vendorName;
          batch[j].aiModel = result.aiModel || null;
        }
      }

      // Yield event loop between waves so HTTP requests remain responsive
      await new Promise((resolve) => setImmediate(resolve));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`[${this.vendorName}] Batched embedding computation completed`, CONTEXT, SUB_CONTEXT, {
      totalChunks: chunks.length,
      totalBatches: batches.length,
      elapsedSeconds: elapsed,
    });

    return chunks;
  }

  /**
   * Generates high-level executive summary for raw text.
   * @param {string} rawText
   * @returns {Promise<{ summary: string, aiVendor: string, aiModel: string }>}
   */
  async generateDocumentSummary(/* rawText */) {
    throw new Error(`generateDocumentSummary() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Streams RAG answer tokens given user prompt, context chunks, and history.
   * Yields string tokens and attaches metadata on return/property.
   * @param {Object} params
   * @param {string} params.prompt
   * @param {Object[]} [params.contextChunks]
   * @param {Object[]} [params.chatHistory]
   * @returns {AsyncGenerator<string, { aiVendor: string, aiModel: string }, void>}
   */
  // eslint-disable-next-line require-yield
  async *streamRagCompletion(/* params */) {
    throw new Error(`streamRagCompletion() must be implemented by ${this.constructor.name}`);
  }
}
