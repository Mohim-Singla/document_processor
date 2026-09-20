import OpenAI from 'openai';
import { BaseAIService } from './BaseAIService.js';
import { constant, OPENAI_CONFIG, SYSTEM_INSTRUCTIONS, AI_VENDORS } from '../../utils/constant/index.js';
import { logger } from '../../utils/logger.js';

const CONTEXT = 'OpenAIService';

export class OpenAIService extends BaseAIService {
  constructor(apiKey) {
    super(AI_VENDORS.OPENAI);
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.client = null;
  }

  getClient() {
    if (!this.client) {
      if (!this.apiKey && process.env.ENV !== constant.ENVS.TEST) {
        logger.critical('OPENAI_API_KEY is missing in environment', CONTEXT, this.getClient.name);
        throw new Error('OPENAI_API_KEY is missing in environment.');
      }
      this.client = new OpenAI({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async getEmbedding(text) {
    const SUB_CONTEXT = 'getEmbedding';

    if (process.env.ENV === constant.ENVS.TEST) {
      logger.debug('Returning test mock embedding vector for OpenAI', CONTEXT, SUB_CONTEXT, { textLength: text.length });
      return {
        embedding: new Array(OPENAI_CONFIG.EMBEDDING_DIMENSIONS)
          .fill(0)
          .map((_, i) => Math.sin(i + text.length) * 0.05),
        aiVendor: this.vendorName,
        aiModel: 'mock-openai-embedding',
      };
    }

    const client = this.getClient();
    const primaryModel = process.env.OPENAI_EMBEDDING_MODEL || OPENAI_CONFIG.DEFAULT_EMBEDDING_MODEL;
    const candidateModels = [
      primaryModel,
      ...OPENAI_CONFIG.EMBEDDING_CANDIDATE_MODELS,
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

    for (let idx = 0; idx < candidateModels.length; idx++) {
      const candidate = candidateModels[idx];
      const attemptNum = idx + 1;
      const totalCandidates = candidateModels.length;

      try {
        logger.info(`Generating embedding via OpenAI API [Attempt ${attemptNum}/${totalCandidates}]`, CONTEXT, SUB_CONTEXT, {
          model: candidate,
          textLength: text.length,
          dimensions: OPENAI_CONFIG.EMBEDDING_DIMENSIONS,
          attempt: attemptNum,
          totalAttempts: totalCandidates,
        });

        const response = await client.embeddings.create({
          model: candidate,
          input: text,
          dimensions: OPENAI_CONFIG.EMBEDDING_DIMENSIONS,
        });

        const vector = response.data?.[0]?.embedding;
        if (vector && vector.length > 0) {
          logger.info('OpenAI embedding generated successfully', CONTEXT, SUB_CONTEXT, {
            model: candidate,
            dimensions: vector.length,
          });
          return {
            embedding: vector,
            aiVendor: this.vendorName,
            aiModel: candidate,
          };
        }
      } catch (err) {
        const isRateLimit = OPENAI_CONFIG.RATE_LIMIT_ERROR_SIGNALS.some((signal) =>
          err.message?.toLowerCase().includes(signal)
        );

        if (isRateLimit && idx < totalCandidates - 1) {
          const nextModel = candidateModels[idx + 1];
          logger.warn(
            `[RETRYING EMBEDDING] OpenAI Model ${candidate} rate limited. Switching to candidate [${idx + 2}/${totalCandidates}]: ${nextModel}`,
            CONTEXT,
            SUB_CONTEXT,
            { failedModel: candidate, nextModel, error: err.message }
          );
          await new Promise((r) => setTimeout(r, OPENAI_CONFIG.CAPACITY_RETRY_DELAY_MS));
          continue;
        }

        if (idx === totalCandidates - 1) {
          logger.error(`[RETRY EXHAUSTED] All ${totalCandidates} OpenAI embedding candidates failed. Last error: ${err.message}`, CONTEXT, SUB_CONTEXT);
          throw err;
        }
      }
    }

    throw new Error('OpenAI embedding generation returned empty values.');
  }

  async getEmbeddingsBatch(texts) {
    const SUB_CONTEXT = 'getEmbeddingsBatch';
    if (!texts || texts.length === 0) {
      return { embeddings: [], aiVendor: this.vendorName, aiModel: null };
    }

    if (process.env.ENV === constant.ENVS.TEST) {
      logger.debug('Returning mock batch embeddings for test environment (OpenAI)', CONTEXT, SUB_CONTEXT, { count: texts.length });
      return {
        embeddings: texts.map((t) =>
          new Array(OPENAI_CONFIG.EMBEDDING_DIMENSIONS).fill(0).map((_, i) => Math.sin(i + t.length) * 0.05)
        ),
        aiVendor: this.vendorName,
        aiModel: 'mock-openai-embedding',
      };
    }

    const client = this.getClient();
    const primaryModel = process.env.OPENAI_EMBEDDING_MODEL || OPENAI_CONFIG.DEFAULT_EMBEDDING_MODEL;
    const candidateModels = [
      primaryModel,
      ...OPENAI_CONFIG.EMBEDDING_CANDIDATE_MODELS,
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

    for (let idx = 0; idx < candidateModels.length; idx++) {
      const candidate = candidateModels[idx];
      const attemptNum = idx + 1;
      const totalCandidates = candidateModels.length;

      try {
        logger.info(`Invoking OpenAI batch embedding API [Attempt ${attemptNum}/${totalCandidates}]`, CONTEXT, SUB_CONTEXT, {
          model: candidate,
          batchSize: texts.length,
          dimensions: OPENAI_CONFIG.EMBEDDING_DIMENSIONS,
          attempt: attemptNum,
          totalAttempts: totalCandidates,
        });

        const response = await client.embeddings.create({
          model: candidate,
          input: texts,
          dimensions: OPENAI_CONFIG.EMBEDDING_DIMENSIONS,
        });

        if (response.data && response.data.length > 0) {
          // Sort by index to ensure order alignment
          const sorted = [...response.data].sort((a, b) => a.index - b.index);
          const results = sorted.map((item) => item.embedding);
          logger.info('OpenAI batch embeddings generated successfully', CONTEXT, SUB_CONTEXT, {
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
        const isRateLimit = OPENAI_CONFIG.RATE_LIMIT_ERROR_SIGNALS.some((signal) =>
          err.message?.toLowerCase().includes(signal)
        );

        if (isRateLimit && idx < totalCandidates - 1) {
          const nextModel = candidateModels[idx + 1];
          logger.warn(
            `[RETRYING BATCH EMBEDDING] OpenAI Model ${candidate} rate limited. Switching to candidate [${idx + 2}/${totalCandidates}]: ${nextModel}`,
            CONTEXT,
            SUB_CONTEXT,
            { failedModel: candidate, nextModel, error: err.message }
          );
          await new Promise((r) => setTimeout(r, OPENAI_CONFIG.CAPACITY_RETRY_DELAY_MS));
          continue;
        }

        if (idx === totalCandidates - 1) {
          logger.error(`[RETRY EXHAUSTED] All ${totalCandidates} OpenAI batch embedding candidates failed. Last error: ${err.message}`, CONTEXT, SUB_CONTEXT);
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
      logger.debug('Returning test mock document summary for OpenAI', CONTEXT, SUB_CONTEXT);
      return {
        summary: 'Summary of the uploaded document based on parsed content.',
        aiVendor: this.vendorName,
        aiModel: 'mock-openai-llm',
      };
    }

    const client = this.getClient();
    const primaryModel = process.env.OPENAI_LLM_MODEL || OPENAI_CONFIG.DEFAULT_LLM_MODEL;
    const candidateModels = [
      primaryModel,
      ...OPENAI_CONFIG.LLM_CANDIDATE_MODELS,
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

    const truncatedText = rawText.slice(0, OPENAI_CONFIG.SUMMARY_MAX_CHAR_LENGTH);
    const prompt = SYSTEM_INSTRUCTIONS.DOCUMENT_SUMMARY(truncatedText);

    for (let idx = 0; idx < candidateModels.length; idx++) {
      const candidate = candidateModels[idx];
      const attemptNum = idx + 1;
      const totalCandidates = candidateModels.length;

      try {
        logger.info(`Generating document summary via OpenAI [Attempt ${attemptNum}/${totalCandidates}]`, CONTEXT, SUB_CONTEXT, {
          model: candidate,
          textLength: truncatedText.length,
          attempt: attemptNum,
          totalAttempts: totalCandidates,
        });

        const response = await client.chat.completions.create({
          model: candidate,
          messages: [
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
        });

        const summary = response.choices?.[0]?.message?.content?.trim() || '';
        if (summary) {
          logger.info('OpenAI document summary generated successfully', CONTEXT, SUB_CONTEXT, {
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
        const isRateLimit = OPENAI_CONFIG.RATE_LIMIT_ERROR_SIGNALS.some((signal) =>
          err.message?.toLowerCase().includes(signal)
        );

        if (isRateLimit && idx < totalCandidates - 1) {
          const nextModel = candidateModels[idx + 1];
          logger.warn(
            `[RETRYING SUMMARY] OpenAI Model ${candidate} busy/rate-limited. Switching to candidate [${idx + 2}/${totalCandidates}]: ${nextModel}`,
            CONTEXT,
            SUB_CONTEXT,
            { failedCandidate: candidate, nextCandidate: nextModel, error: err.message }
          );
          await new Promise((r) => setTimeout(r, OPENAI_CONFIG.CAPACITY_RETRY_DELAY_MS));
          continue;
        }
        logger.warn('Error generating summary with OpenAI candidate', CONTEXT, SUB_CONTEXT, { candidate, error: err.message });
      }
    }

    throw new Error('All OpenAI candidate models failed to generate a document summary.');
  }

  async *streamRagCompletion({ prompt, contextChunks = [], chatHistory = [] }) {
    const SUB_CONTEXT = 'streamRagCompletion';
    logger.info('Starting streaming RAG generation with OpenAI', CONTEXT, SUB_CONTEXT, {
      chunkCount: contextChunks.length,
      promptLength: prompt.length,
      historyLength: chatHistory.length,
    });

    if (process.env.ENV === constant.ENVS.TEST) {
      const fallbackText = `[Test Mode] Answer for: ${prompt} based on ${contextChunks.length} documents. [1]`;
      for (const word of fallbackText.split(' ')) {
        yield { token: `${word} `, aiVendor: this.vendorName, aiModel: 'mock-openai-llm' };
        await new Promise((r) => setTimeout(r, 20));
      }
      return { aiVendor: this.vendorName, aiModel: 'mock-openai-llm' };
    }

    const formattedContext = contextChunks
      .map((chunk, index) => {
        const docName = chunk.fileName || `Document_${chunk.documentId}`;
        const pageInfo = chunk.pageNumber ? `(Page ${chunk.pageNumber})` : '';
        return `[${index + 1}] Source: ${docName} ${pageInfo}\nContent:\n${chunk.content}\n---`;
      })
      .join('\n\n');

    const systemInstruction = SYSTEM_INSTRUCTIONS.RAG_COMPLETION;

    const client = this.getClient();
    const primaryModel = process.env.OPENAI_LLM_MODEL || OPENAI_CONFIG.DEFAULT_LLM_MODEL;
    const candidateModels = [
      primaryModel,
      ...OPENAI_CONFIG.LLM_CANDIDATE_MODELS,
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

    // Build chat message array for OpenAI API format
    const messages = [
      { role: 'system', content: systemInstruction },
    ];

    if (chatHistory && chatHistory.length > 0) {
      for (const msg of chatHistory) {
        messages.push({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }
    }

    messages.push({
      role: 'user',
      content: `Context Documents:\n${formattedContext}\n\nCurrent User Question:\n${prompt}`,
    });

    let stream = null;
    let activeModel = primaryModel;

    for (let idx = 0; idx < candidateModels.length; idx++) {
      const candidate = candidateModels[idx];
      const attemptNum = idx + 1;
      const totalCandidates = candidateModels.length;

      try {
        logger.info(`Invoking OpenAI chat stream [Attempt ${attemptNum}/${totalCandidates}]`, CONTEXT, SUB_CONTEXT, {
          model: candidate,
          attempt: attemptNum,
          totalAttempts: totalCandidates,
        });

        stream = await client.chat.completions.create({
          model: candidate,
          messages,
          stream: true,
          temperature: 0.2,
        });
        activeModel = candidate;
        break;
      } catch (err) {
        const isRateLimit = OPENAI_CONFIG.RATE_LIMIT_ERROR_SIGNALS.some((signal) =>
          err.message?.toLowerCase().includes(signal)
        );

        if (isRateLimit && idx < totalCandidates - 1) {
          const nextModel = candidateModels[idx + 1];
          logger.warn(
            `[RETRYING STREAM] OpenAI Model ${candidate} busy/rate-limited. Switching to next candidate [${idx + 2}/${totalCandidates}]: ${nextModel}`,
            CONTEXT,
            SUB_CONTEXT,
            { failedModel: candidate, nextModel, error: err.message }
          );
          await new Promise((r) => setTimeout(r, OPENAI_CONFIG.RETRY_DELAY_MS));
          continue;
        }

        if (idx === totalCandidates - 1) {
          logger.error(`[RETRY EXHAUSTED] All ${totalCandidates} OpenAI streaming LLM candidates failed. Last error: ${err.message}`, CONTEXT, SUB_CONTEXT);
          throw err;
        }
      }
    }

    if (!stream) {
      throw new Error('All OpenAI model clusters are currently busy or rate-limited.');
    }

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        yield { token: delta, aiVendor: this.vendorName, aiModel: activeModel };
      }
    }

    logger.info('OpenAI stream generation completed', CONTEXT, SUB_CONTEXT, { activeModel });
    return { aiVendor: this.vendorName, aiModel: activeModel };
  }
}
