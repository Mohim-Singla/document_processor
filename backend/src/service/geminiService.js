import { GoogleGenAI } from '@google/genai';
import { constant, GEMINI_CONFIG, SYSTEM_INSTRUCTIONS } from '../utils/constant/index.js';
import { logger } from '../utils/logger.js';

const CONTEXT = 'geminiService';
let aiInstance = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey && process.env.ENV !== 'test') {
      logger.critical('GEMINI_API_KEY is missing in environment', CONTEXT, getAI.name);
      throw new Error('GEMINI_API_KEY is missing in environment.');
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

/**
 * Computes vector embedding for a given text snippet using Google GenAI embedding models
 */
export async function getEmbedding(text) {
  const SUB_CONTEXT = getEmbedding.name;
  // Mock only runs when ENV === 'test'
  if (process.env.ENV === constant.ENVS.TEST) {
    logger.debug('Returning test mock embedding vector', CONTEXT, SUB_CONTEXT, { textLength: text.length });
    return new Array(GEMINI_CONFIG.TEST_MOCK_EMBEDDING_DIMENSIONS).fill(0).map((_, i) => Math.sin(i + text.length) * 0.05);
  }

  const ai = getAI();
  const primaryModel = process.env.GEMINI_EMBEDDING_MODEL || GEMINI_CONFIG.DEFAULT_EMBEDDING_MODEL;
  const candidateModels = [
    primaryModel,
    ...GEMINI_CONFIG.EMBEDDING_CANDIDATE_MODELS,
  ].filter((v, idx, arr) => arr.indexOf(v) === idx);

  for (let idx = 0; idx < candidateModels.length; idx++) {
    const candidate = candidateModels[idx];
    const attemptNum = idx + 1;
    const totalCandidates = candidateModels.length;

    try {
      logger.info(`Generating embedding via Gemini API [Attempt ${attemptNum}/${totalCandidates}]`, CONTEXT, SUB_CONTEXT, {
        model: candidate,
        textLength: text.length,
        attempt: attemptNum,
        totalAttempts: totalCandidates,
      });

      const response = await ai.models.embedContent({
        model: candidate,
        contents: text,
      });

      if (response.embeddings && response.embeddings[0]?.values) {
        if (idx > 0) {
          logger.info(`[RETRY SUCCESS] Embedding generated successfully with fallback model: ${candidate}`, CONTEXT, SUB_CONTEXT, {
            model: candidate,
            dimensions: response.embeddings[0].values.length,
            successfulAttempt: attemptNum,
          });
        } else {
          logger.info('Embedding generated successfully', CONTEXT, SUB_CONTEXT, { dimensions: response.embeddings[0].values.length });
        }
        return response.embeddings[0].values;
      }
      if (response.embedding?.values) {
        if (idx > 0) {
          logger.info(`[RETRY SUCCESS] Embedding generated successfully with fallback model: ${candidate}`, CONTEXT, SUB_CONTEXT, {
            model: candidate,
            dimensions: response.embedding.values.length,
            successfulAttempt: attemptNum,
          });
        } else {
          logger.info('Embedding generated successfully', CONTEXT, SUB_CONTEXT, { dimensions: response.embedding.values.length });
        }
        return response.embedding.values;
      }
    } catch (err) {
      const isCapacityError =
        err.message?.includes('503') ||
        err.message?.includes('high demand') ||
        err.message?.includes('UNAVAILABLE') ||
        err.message?.includes('429') ||
        err.message?.includes('RESOURCE_EXHAUSTED');

      if (isCapacityError && idx < totalCandidates - 1) {
        const nextModel = candidateModels[idx + 1];
        logger.warn(`[RETRYING EMBEDDING] Model ${candidate} capacity busy (503/429). Still retrying... Switching to next candidate [${idx + 2}/${totalCandidates}]: ${nextModel}`, CONTEXT, SUB_CONTEXT, {
          failedModel: candidate,
          nextModel,
          attempt: attemptNum,
          remainingAttempts: totalCandidates - attemptNum,
          error: err.message,
        });
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      if (idx === totalCandidates - 1) {
        logger.error(`[RETRY EXHAUSTED] All ${totalCandidates} embedding candidate models failed. Last error: ${err.message}`, CONTEXT, SUB_CONTEXT, {
          error: err.message,
        });
        throw err;
      }
    }
  }

  logger.warn('Empty embedding response received', CONTEXT, SUB_CONTEXT);
  return [];
}

/**
 * Computes vector embeddings for a batch of text snippets in a single API call.
 * Falls back through candidate models on capacity errors just like getEmbedding.
 *
 * @param {string[]} texts - Array of text strings to embed
 * @returns {Promise<number[][]>} Array of embedding vectors in same order as input texts
 */
export async function getEmbeddingsBatch(texts) {
  const SUB_CONTEXT = getEmbeddingsBatch.name;

  if (!texts || texts.length === 0) return [];

  // Single text — delegate to the existing single-embed path
  if (texts.length === 1) {
    const embedding = await getEmbedding(texts[0]);
    return [embedding];
  }

  if (process.env.ENV === constant.ENVS.TEST) {
    logger.debug('Returning test mock batch embeddings', CONTEXT, SUB_CONTEXT, { batchSize: texts.length });
    return texts.map((t) =>
      new Array(GEMINI_CONFIG.TEST_MOCK_EMBEDDING_DIMENSIONS).fill(0).map((_, i) => Math.sin(i + t.length) * 0.05)
    );
  }

  const ai = getAI();
  const primaryModel = process.env.GEMINI_EMBEDDING_MODEL || GEMINI_CONFIG.DEFAULT_EMBEDDING_MODEL;
  const candidateModels = [
    primaryModel,
    ...GEMINI_CONFIG.EMBEDDING_CANDIDATE_MODELS,
  ].filter((v, idx, arr) => arr.indexOf(v) === idx);

  for (let idx = 0; idx < candidateModels.length; idx++) {
    const candidate = candidateModels[idx];
    const attemptNum = idx + 1;
    const totalCandidates = candidateModels.length;

    try {
      logger.info(`Generating batch embeddings via Gemini API [Attempt ${attemptNum}/${totalCandidates}]`, CONTEXT, SUB_CONTEXT, {
        model: candidate,
        batchSize: texts.length,
        attempt: attemptNum,
        totalAttempts: totalCandidates,
      });

      const response = await ai.models.embedContent({
        model: candidate,
        contents: texts,
      });

      if (response.embeddings && response.embeddings.length > 0) {
        const results = response.embeddings.map((e) => e.values || []);
        logger.info('Batch embeddings generated successfully', CONTEXT, SUB_CONTEXT, {
          model: candidate,
          batchSize: texts.length,
          dimensions: results[0]?.length,
        });
        return results;
      }
    } catch (err) {
      const isCapacityError =
        err.message?.includes('503') ||
        err.message?.includes('high demand') ||
        err.message?.includes('UNAVAILABLE') ||
        err.message?.includes('429') ||
        err.message?.includes('RESOURCE_EXHAUSTED');

      if (isCapacityError && idx < totalCandidates - 1) {
        const nextModel = candidateModels[idx + 1];
        logger.warn(`[RETRYING BATCH EMBEDDING] Model ${candidate} capacity busy. Switching to candidate [${idx + 2}/${totalCandidates}]: ${nextModel}`, CONTEXT, SUB_CONTEXT, {
          failedModel: candidate,
          nextModel,
          attempt: attemptNum,
          remainingAttempts: totalCandidates - attemptNum,
          batchSize: texts.length,
          error: err.message,
        });
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      if (idx === totalCandidates - 1) {
        logger.error(`[RETRY EXHAUSTED] All ${totalCandidates} batch embedding candidates failed. Last error: ${err.message}`, CONTEXT, SUB_CONTEXT, {
          error: err.message,
          batchSize: texts.length,
        });
        throw err;
      }
    }
  }

  logger.warn('Empty batch embedding response received', CONTEXT, SUB_CONTEXT, { batchSize: texts.length });
  return texts.map(() => []);
}

/**
 * High-level helper: computes embeddings for an array of chunks using batched
 * API calls with controlled concurrency.
 *
 * Mutates each chunk in-place by setting `chunk.embedding` and `chunk.userId`.
 *
 * @param {Object[]} chunks - Array of chunk objects with `.content` property
 * @param {string} userId - User ID to set on each chunk
 * @param {Object} [options]
 * @param {number} [options.batchSize] - Texts per API call (default from GEMINI_CONFIG)
 * @param {number} [options.concurrency] - Parallel batch requests (default from GEMINI_CONFIG)
 * @returns {Promise<Object[]>} The same chunks array with embeddings populated
 */
export async function getEmbeddingsForChunks(chunks, userId, options = {}) {
  const SUB_CONTEXT = getEmbeddingsForChunks.name;
  if (!chunks || chunks.length === 0) return chunks;

  const batchSize = options.batchSize || GEMINI_CONFIG.EMBEDDING_BATCH_SIZE || 100;
  const concurrency = options.concurrency || GEMINI_CONFIG.EMBEDDING_BATCH_CONCURRENCY || 5;

  logger.info('Starting batched embedding computation for chunks', CONTEXT, SUB_CONTEXT, {
    totalChunks: chunks.length,
    batchSize,
    concurrency,
    estimatedBatches: Math.ceil(chunks.length / batchSize),
  });

  const startTime = Date.now();

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

    logger.info(`Processing embedding wave ${waveNumber}/${totalWaves}`, CONTEXT, SUB_CONTEXT, {
      batchesInWave: wave.length,
      chunksInWave: wave.reduce((sum, b) => sum + b.length, 0),
    });

    const waveResults = await Promise.all(
      wave.map((batch) => getEmbeddingsBatch(batch.map((c) => c.content)))
    );

    // Assign embeddings back to chunks
    for (let batchIdx = 0; batchIdx < wave.length; batchIdx++) {
      const batch = wave[batchIdx];
      const embeddings = waveResults[batchIdx];
      for (let j = 0; j < batch.length; j++) {
        batch[j].userId = userId;
        batch[j].embedding = embeddings[j] || [];
      }
    }

    // Yield event loop between waves so HTTP requests stay responsive
    await new Promise((resolve) => setImmediate(resolve));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info('Batched embedding computation completed', CONTEXT, SUB_CONTEXT, {
    totalChunks: chunks.length,
    totalBatches: batches.length,
    elapsedSeconds: elapsed,
  });

  return chunks;
}

/**
 * Streams conversational RAG answer given user prompt and relevant context chunks
 */
export async function* streamRagCompletion({ prompt, contextChunks = [] }) {
  const SUB_CONTEXT = streamRagCompletion.name;
  logger.info('Starting streaming RAG generation with Gemini', CONTEXT, SUB_CONTEXT, { chunkCount: contextChunks.length, promptLength: prompt.length });

  // Mock only runs when ENV === 'test'
  if (process.env.ENV === 'test') {
    const fallbackText = `[Test Mode] Answer for: ${prompt} based on ${contextChunks.length} documents. [1]`;
    for (const word of fallbackText.split(' ')) {
      yield `${word} `;
      await new Promise((r) => setTimeout(r, 20));
    }
    return;
  }

  const formattedContext = contextChunks
    .map((chunk, index) => {
      const docName = chunk.fileName || `Document_${chunk.documentId}`;
      const pageInfo = chunk.pageNumber ? `(Page ${chunk.pageNumber})` : '';
      return `[${index + 1}] Source: ${docName} ${pageInfo}\nContent:\n${chunk.content}\n---`;
    })
    .join('\n\n');

  const systemInstruction = SYSTEM_INSTRUCTIONS.RAG_COMPLETION;

  const ai = getAI();
  const primaryModel = process.env.GEMINI_LLM_MODEL || GEMINI_CONFIG.DEFAULT_LLM_MODEL;
  // Candidate fallback models in case the primary experiences temporary 503 demand spikes
  const candidateModels = [
    primaryModel,
    ...GEMINI_CONFIG.LLM_CANDIDATE_MODELS,
  ].filter((v, idx, arr) => arr.indexOf(v) === idx);

  const fullUserPrompt = `Context Documents:\n${formattedContext}\n\nUser Question:\n${prompt}`;

  let streamResult = null;
  let activeModel = primaryModel;

  for (let idx = 0; idx < candidateModels.length; idx++) {
    const candidate = candidateModels[idx];
    const attemptNum = idx + 1;
    const totalCandidates = candidateModels.length;

    try {
      logger.info(`Invoking Gemini generateContentStream [Attempt ${attemptNum}/${totalCandidates}]`, CONTEXT, SUB_CONTEXT, {
        model: candidate,
        attempt: attemptNum,
        totalAttempts: totalCandidates,
      });
      streamResult = await ai.models.generateContentStream({
        model: candidate,
        contents: [{ role: 'user', parts: [{ text: fullUserPrompt }] }],
        config: {
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
        },
      });
      activeModel = candidate;
      if (idx > 0) {
        logger.info(`[RETRY SUCCESS] Stream generation established with fallback model: ${candidate}`, CONTEXT, SUB_CONTEXT, {
          model: candidate,
          successfulAttempt: attemptNum,
        });
      }
      break;
    } catch (err) {
      const isCapacityError =
        err.message?.includes('503') ||
        err.message?.includes('high demand') ||
        err.message?.includes('UNAVAILABLE') ||
        err.message?.includes('429') ||
        err.message?.includes('RESOURCE_EXHAUSTED');

      if (isCapacityError && idx < totalCandidates - 1) {
        const nextModel = candidateModels[idx + 1];
        logger.warn(`[RETRYING STREAM] Model ${candidate} capacity busy (503/429). Still retrying... Switching to next candidate [${idx + 2}/${totalCandidates}]: ${nextModel}`, CONTEXT, SUB_CONTEXT, {
          failedModel: candidate,
          nextModel,
          attempt: attemptNum,
          remainingAttempts: totalCandidates - attemptNum,
          error: err.message,
        });
        await new Promise((r) => setTimeout(r, GEMINI_CONFIG.RETRY_DELAY_MS));
        continue;
      }
      if (idx === totalCandidates - 1) {
        logger.error(`[RETRY EXHAUSTED] All ${totalCandidates} streaming LLM candidates failed. Last error: ${err.message}`, CONTEXT, SUB_CONTEXT, {
          error: err.message,
        });
        throw err;
      }
    }
  }

  if (!streamResult) {
    throw new Error('All Gemini model clusters are currently at capacity (503/429). Please retry in a few moments.');
  }

  for await (const chunk of streamResult) {
    const text = chunk.text;
    if (text) {
      yield text;
    }
  }

  logger.info('Gemini stream generation completed', CONTEXT, SUB_CONTEXT, { activeModel });
}

/**
 * Generates a concise high-level document summary
 */
export async function generateDocumentSummary(rawText) {
  const SUB_CONTEXT = generateDocumentSummary.name;
  if (!rawText || !rawText.trim()) return '';

  if (process.env.ENV === constant.ENVS.TEST || process.env.ENV === 'test') {
    logger.debug('Returning test mock document summary', CONTEXT, SUB_CONTEXT);
    return 'Summary of the uploaded document based on parsed content.';
  }

  const ai = getAI();
  const primaryModel = process.env.GEMINI_LLM_MODEL || GEMINI_CONFIG.DEFAULT_LLM_MODEL;
  const candidateModels = [
    primaryModel,
    ...GEMINI_CONFIG.LLM_CANDIDATE_MODELS,
  ].filter((v, idx, arr) => arr.indexOf(v) === idx);

  // Trim rawText to configured maximum characters to keep latency fast while capturing key sections
  const truncatedText = rawText.slice(0, GEMINI_CONFIG.SUMMARY_MAX_CHAR_LENGTH);
  const prompt = SYSTEM_INSTRUCTIONS.DOCUMENT_SUMMARY(truncatedText);

  for (let idx = 0; idx < candidateModels.length; idx++) {
    const candidate = candidateModels[idx];
    const attemptNum = idx + 1;
    const totalCandidates = candidateModels.length;

    try {
      logger.info(`Generating document summary via Gemini [Attempt ${attemptNum}/${totalCandidates}]`, CONTEXT, SUB_CONTEXT, {
        model: candidate,
        textLength: truncatedText.length,
        attempt: attemptNum,
        totalAttempts: totalCandidates,
      });
      const response = await ai.models.generateContent({
        model: candidate,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      const summary = response.text ? response.text.trim() : '';
      if (summary) {
        if (idx > 0) {
          logger.info(`[RETRY SUCCESS] Successfully generated summary with fallback model: ${candidate}`, CONTEXT, SUB_CONTEXT, {
            model: candidate,
            summaryLength: summary.length,
            successfulAttempt: attemptNum,
          });
        } else {
          logger.info('Document summary generated successfully', CONTEXT, SUB_CONTEXT, { model: candidate, summaryLength: summary.length });
        }
        return summary;
      }
    } catch (err) {
      const isCapacityError =
        err.message?.includes('503') ||
        err.message?.includes('high demand') ||
        err.message?.includes('UNAVAILABLE') ||
        err.message?.includes('429') ||
        err.message?.includes('RESOURCE_EXHAUSTED');

      if (isCapacityError && idx < totalCandidates - 1) {
        const nextModel = candidateModels[idx + 1];
        logger.warn(`[RETRYING SUMMARY] Model ${candidate} busy (503/429). Still retrying... Switching to candidate [${idx + 2}/${totalCandidates}]: ${nextModel}`, CONTEXT, SUB_CONTEXT, {
          failedCandidate: candidate,
          nextCandidate: nextModel,
          attempt: attemptNum,
          remainingAttempts: totalCandidates - attemptNum,
          error: err.message,
        });
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      logger.warn('Error generating summary with candidate', CONTEXT, SUB_CONTEXT, { candidate, error: err.message });
    }
  }

  logger.warn('All candidate models failed or returned empty summary', CONTEXT, SUB_CONTEXT);
  return '';
}

export const geminiService = {
  getEmbedding,
  getEmbeddingsBatch,
  getEmbeddingsForChunks,
  generateDocumentSummary,
  streamRagCompletion,
};
