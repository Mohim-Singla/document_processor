import { GoogleGenAI } from '@google/genai';
import { BaseAIService } from './BaseAIService.js';
import { constant, GEMINI_CONFIG, SYSTEM_INSTRUCTIONS, AI_VENDORS } from '../../utils/constant/index.js';
import { logger } from '../../utils/logger.js';

const CONTEXT = 'GeminiService';

export class GeminiService extends BaseAIService {
  constructor(apiKey) {
    super(AI_VENDORS.GEMINI);
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.aiInstance = null;
  }

  getAI() {
    if (!this.aiInstance) {
      if (!this.apiKey && process.env.ENV !== constant.ENVS.TEST) {
        logger.critical('GEMINI_API_KEY is missing in environment', CONTEXT, this.getAI.name);
        throw new Error('GEMINI_API_KEY is missing in environment.');
      }
      this.aiInstance = new GoogleGenAI({ apiKey: this.apiKey });
    }
    return this.aiInstance;
  }

  async getEmbedding(text) {
    const SUB_CONTEXT = 'getEmbedding';

    if (process.env.ENV === constant.ENVS.TEST) {
      logger.debug('Returning test mock embedding vector', CONTEXT, SUB_CONTEXT, { textLength: text.length });
      return {
        embedding: new Array(GEMINI_CONFIG.TEST_MOCK_EMBEDDING_DIMENSIONS)
          .fill(0)
          .map((_, i) => Math.sin(i + text.length) * 0.05),
        aiVendor: this.vendorName,
        aiModel: 'mock-test-model',
      };
    }

    const ai = this.getAI();
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

        const values = response.embeddings?.[0]?.values || response.embedding?.values;
        if (values && values.length > 0) {
          logger.info('Gemini embedding generated successfully', CONTEXT, SUB_CONTEXT, {
            model: candidate,
            dimensions: values.length,
          });
          return {
            embedding: values,
            aiVendor: this.vendorName,
            aiModel: candidate,
          };
        }
      } catch (err) {
        const isCapacityError = GEMINI_CONFIG.CAPACITY_ERROR_SIGNALS.some((signal) =>
          err.message?.includes(signal)
        );

        if (isCapacityError && idx < totalCandidates - 1) {
          const nextModel = candidateModels[idx + 1];
          logger.warn(
            `[RETRYING EMBEDDING] Gemini Model ${candidate} capacity busy (503/429). Switching to candidate [${idx + 2}/${totalCandidates}]: ${nextModel}`,
            CONTEXT,
            SUB_CONTEXT,
            { failedModel: candidate, nextModel, error: err.message }
          );
          await new Promise((r) => setTimeout(r, GEMINI_CONFIG.CAPACITY_RETRY_DELAY_MS));
          continue;
        }

        if (idx === totalCandidates - 1) {
          logger.error(`[RETRY EXHAUSTED] All ${totalCandidates} Gemini embedding candidates failed. Last error: ${err.message}`, CONTEXT, SUB_CONTEXT);
          throw err;
        }
      }
    }

    throw new Error('Gemini embedding generation returned empty values.');
  }

  async getEmbeddingsBatch(texts) {
    const SUB_CONTEXT = 'getEmbeddingsBatch';
    if (!texts || texts.length === 0) {
      return { embeddings: [], aiVendor: this.vendorName, aiModel: null };
    }

    if (process.env.ENV === constant.ENVS.TEST) {
      logger.debug('Returning mock batch embeddings for test environment', CONTEXT, SUB_CONTEXT, { count: texts.length });
      return {
        embeddings: texts.map((t) =>
          new Array(GEMINI_CONFIG.TEST_MOCK_EMBEDDING_DIMENSIONS).fill(0).map((_, i) => Math.sin(i + t.length) * 0.05)
        ),
        aiVendor: this.vendorName,
        aiModel: 'mock-test-model',
      };
    }

    const ai = this.getAI();
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
        logger.info(`Invoking Gemini batch embedding API [Attempt ${attemptNum}/${totalCandidates}]`, CONTEXT, SUB_CONTEXT, {
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
          logger.info('Gemini batch embeddings generated successfully', CONTEXT, SUB_CONTEXT, {
            model: candidate,
            batchSize: texts.length,
            dimensions: results[0]?.length,
          });
          return {
            embeddings: results,
            aiVendor: this.vendorName,
            aiModel: candidate,
          };
        }
      } catch (err) {
        const isCapacityError = GEMINI_CONFIG.CAPACITY_ERROR_SIGNALS.some((signal) =>
          err.message?.includes(signal)
        );

        if (isCapacityError && idx < totalCandidates - 1) {
          const nextModel = candidateModels[idx + 1];
          // Check if Google provided an explicit retryDelay (e.g. "retry in 3s" or retryDelay: "4s")
          let backoffMs = GEMINI_CONFIG.CAPACITY_RETRY_DELAY_MS;
          const retryMatch = err.message?.match(/retry in ([0-9.]+)s/i) || err.message?.match(/"retryDelay":\s*"([0-9]+)s"/i);
          if (retryMatch && parseFloat(retryMatch[1]) <= 10) {
            backoffMs = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 200;
          }

          logger.warn(
            `[RETRYING BATCH EMBEDDING] Gemini Model ${candidate} capacity busy. Switching to candidate [${idx + 2}/${totalCandidates}]: ${nextModel} after ${backoffMs}ms`,
            CONTEXT,
            SUB_CONTEXT,
            { failedModel: candidate, nextModel, backoffMs, error: err.message }
          );
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }

        if (idx === totalCandidates - 1) {
          logger.error(`[RETRY EXHAUSTED] All ${totalCandidates} Gemini batch embedding candidates failed. Last error: ${err.message}`, CONTEXT, SUB_CONTEXT);
          throw err;
        }
      }
    }

    return { embeddings: texts.map(() => []), aiVendor: this.vendorName, aiModel: null };
  }

  async generateDocumentSummary(rawText) {
    const SUB_CONTEXT = 'generateDocumentSummary';
    if (!rawText || !rawText.trim()) {
      return { summary: '', aiVendor: this.vendorName, aiModel: null };
    }

    if (process.env.ENV === constant.ENVS.TEST) {
      logger.debug('Returning test mock document summary', CONTEXT, SUB_CONTEXT);
      return {
        summary: 'Summary of the uploaded document based on parsed content.',
        aiVendor: this.vendorName,
        aiModel: 'mock-test-model',
      };
    }

    const ai = this.getAI();
    const primaryModel = process.env.GEMINI_LLM_MODEL || GEMINI_CONFIG.DEFAULT_LLM_MODEL;
    const candidateModels = [
      primaryModel,
      ...GEMINI_CONFIG.LLM_CANDIDATE_MODELS,
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

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
          logger.info('Gemini document summary generated successfully', CONTEXT, SUB_CONTEXT, {
            model: candidate,
            summaryLength: summary.length,
          });
          return {
            summary,
            aiVendor: this.vendorName,
            aiModel: candidate,
          };
        }
      } catch (err) {
        const isCapacityError = GEMINI_CONFIG.CAPACITY_ERROR_SIGNALS.some((signal) =>
          err.message?.includes(signal)
        );

        if (isCapacityError && idx < totalCandidates - 1) {
          const nextModel = candidateModels[idx + 1];
          logger.warn(
            `[RETRYING SUMMARY] Gemini Model ${candidate} busy (503/429). Switching to candidate [${idx + 2}/${totalCandidates}]: ${nextModel}`,
            CONTEXT,
            SUB_CONTEXT,
            { failedCandidate: candidate, nextCandidate: nextModel, error: err.message }
          );
          await new Promise((r) => setTimeout(r, GEMINI_CONFIG.CAPACITY_RETRY_DELAY_MS));
          continue;
        }
        logger.warn('Error generating summary with Gemini candidate', CONTEXT, SUB_CONTEXT, { candidate, error: err.message });
      }
    }

    throw new Error('All Gemini candidate models failed to generate a document summary.');
  }

  async *streamRagCompletion({ prompt, contextChunks = [], chatHistory = [] }) {
    const SUB_CONTEXT = 'streamRagCompletion';
    logger.info('Starting streaming RAG generation with Gemini', CONTEXT, SUB_CONTEXT, {
      chunkCount: contextChunks.length,
      promptLength: prompt.length,
      historyLength: chatHistory.length,
    });

    if (process.env.ENV === constant.ENVS.TEST) {
      const fallbackText = `[Test Mode] Answer for: ${prompt} based on ${contextChunks.length} documents. [1]`;
      for (const word of fallbackText.split(' ')) {
        yield { token: `${word} `, aiVendor: this.vendorName, aiModel: 'mock-test-model' };
        await new Promise((r) => setTimeout(r, 20));
      }
      return { aiVendor: this.vendorName, aiModel: 'mock-test-model' };
    }

    const formattedContext = contextChunks
      .map((chunk, index) => {
        const docName = chunk.fileName || `Document_${chunk.documentId}`;
        const pageInfo = chunk.pageNumber ? `(Page ${chunk.pageNumber})` : '';
        return `[${index + 1}] Source: ${docName} ${pageInfo}\nContent:\n${chunk.content}\n---`;
      })
      .join('\n\n');

    const systemInstruction = SYSTEM_INSTRUCTIONS.RAG_COMPLETION;

    const ai = this.getAI();
    const primaryModel = process.env.GEMINI_LLM_MODEL || GEMINI_CONFIG.DEFAULT_LLM_MODEL;
    const candidateModels = [
      primaryModel,
      ...GEMINI_CONFIG.LLM_CANDIDATE_MODELS,
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

    let formattedHistory = '';
    if (chatHistory && chatHistory.length > 0) {
      const turns = chatHistory
        .map((msg) => {
          const roleName = msg.sender === 'user' ? 'User' : 'Assistant';
          return `${roleName}: ${msg.content}`;
        })
        .join('\n\n');
      formattedHistory = `Prior Conversation History:\n${turns}\n\n`;
    }

    const fullUserPrompt = `Context Documents:\n${formattedContext}\n\n${formattedHistory}Current User Question:\n${prompt}`;

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
        break;
      } catch (err) {
        const isCapacityError = GEMINI_CONFIG.CAPACITY_ERROR_SIGNALS.some((signal) =>
          err.message?.includes(signal)
        );

        if (isCapacityError && idx < totalCandidates - 1) {
          const nextModel = candidateModels[idx + 1];
          logger.warn(
            `[RETRYING STREAM] Gemini Model ${candidate} capacity busy (503/429). Switching to next candidate [${idx + 2}/${totalCandidates}]: ${nextModel}`,
            CONTEXT,
            SUB_CONTEXT,
            { failedModel: candidate, nextModel, error: err.message }
          );
          await new Promise((r) => setTimeout(r, GEMINI_CONFIG.RETRY_DELAY_MS));
          continue;
        }

        if (idx === totalCandidates - 1) {
          logger.error(`[RETRY EXHAUSTED] All ${totalCandidates} streaming LLM candidates failed. Last error: ${err.message}`, CONTEXT, SUB_CONTEXT);
          throw err;
        }
      }
    }

    if (!streamResult) {
      throw new Error('All Gemini model clusters are currently at capacity (503/429).');
    }

    for await (const chunk of streamResult) {
      const text = chunk.text;
      if (text) {
        yield { token: text, aiVendor: this.vendorName, aiModel: activeModel };
      }
    }

    logger.info('Gemini stream generation completed', CONTEXT, SUB_CONTEXT, { activeModel });
    return { aiVendor: this.vendorName, aiModel: activeModel };
  }
}
