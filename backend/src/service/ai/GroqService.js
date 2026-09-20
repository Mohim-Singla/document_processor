import Groq from 'groq-sdk';
import { BaseAIService } from './BaseAIService.js';
import { constant, GROQ_CONFIG, SYSTEM_INSTRUCTIONS, AI_VENDORS } from '../../utils/constant/index.js';
import { logger } from '../../utils/logger.js';

const CONTEXT = 'GroqService';

/**
 * Concrete AI service implementing BaseAIService for Groq Cloud.
 * Uses groq-sdk for lightning-fast inference on open-source models (e.g. Llama 3.3 70B, Llama 3.1 8B).
 * Note: Groq is a text-generation inference engine (Q&A streaming & summaries).
 * For vector embeddings, it falls back to the configured embedding providers in the chain.
 */
export class GroqService extends BaseAIService {
  constructor(apiKey) {
    super(AI_VENDORS.GROQ);
    this.apiKey = apiKey || process.env.GROQ_API_KEY || '';
    this.client = null;
  }

  getClient() {
    if (!this.client) {
      if (!this.apiKey && process.env.ENV !== constant.ENVS.TEST) {
        logger.critical('GROQ_API_KEY is missing in environment', CONTEXT, this.getClient.name);
        throw new Error('GROQ_API_KEY is missing in environment.');
      }
      this.client = new Groq({ apiKey: this.apiKey });
    }
    return this.client;
  }

  /**
   * Groq specializes in text LLMs and does not provide native vector embedding endpoints.
   * Delegating to next provider in the chain for embedding operations.
   */
  async getEmbedding(/* text */) {
    throw new Error('Groq does not provide embedding models. Falling over to next provider.');
  }

  async getEmbeddingsBatch(/* texts */) {
    throw new Error('Groq does not provide embedding models. Falling over to next provider.');
  }

  /**
   * Generates document summary using Groq LLM.
   */
  async generateDocumentSummary(rawText) {
    const SUB_CONTEXT = 'generateDocumentSummary';
    if (!rawText || !rawText.trim()) {
      return { summary: '', aiVendor: this.vendorName, aiModel: null };
    }

    if (process.env.ENV === constant.ENVS.TEST) {
      logger.debug('Returning test mock document summary for Groq', CONTEXT, SUB_CONTEXT);
      return {
        summary: 'Summary of the uploaded document based on parsed content.',
        aiVendor: this.vendorName,
        aiModel: 'mock-groq-llm',
      };
    }

    const client = this.getClient();
    const primaryModel = process.env.GROQ_LLM_MODEL || GROQ_CONFIG.DEFAULT_LLM_MODEL;
    const candidateModels = [
      primaryModel,
      ...GROQ_CONFIG.LLM_CANDIDATE_MODELS,
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

    const truncatedText = rawText.slice(0, GROQ_CONFIG.SUMMARY_MAX_CHAR_LENGTH);
    const prompt = SYSTEM_INSTRUCTIONS.DOCUMENT_SUMMARY(truncatedText);

    for (let idx = 0; idx < candidateModels.length; idx++) {
      const candidate = candidateModels[idx];
      const attemptNum = idx + 1;
      const totalCandidates = candidateModels.length;

      try {
        logger.info(`Generating document summary via Groq [Attempt ${attemptNum}/${totalCandidates}]`, CONTEXT, SUB_CONTEXT, {
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
          logger.info('Groq document summary generated successfully', CONTEXT, SUB_CONTEXT, {
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
        const isRateLimit = GROQ_CONFIG.RATE_LIMIT_ERROR_SIGNALS.some((sig) =>
          err.message?.toLowerCase().includes(sig.toLowerCase())
        );

        if (isRateLimit && idx < totalCandidates - 1) {
          const nextModel = candidateModels[idx + 1];
          logger.warn(
            `[RETRYING SUMMARY] Groq Model ${candidate} rate limited. Switching to candidate [${idx + 2}/${totalCandidates}]: ${nextModel}`,
            CONTEXT,
            SUB_CONTEXT,
            { failedModel: candidate, nextModel, error: err.message }
          );
          await new Promise((r) => setTimeout(r, GROQ_CONFIG.CAPACITY_RETRY_DELAY_MS));
          continue;
        }

        if (idx === totalCandidates - 1) {
          logger.error(`[RETRY EXHAUSTED] All ${totalCandidates} Groq summary candidates failed. Last error: ${err.message}`, CONTEXT, SUB_CONTEXT);
          throw err;
        }
      }
    }

    return { summary: '', aiVendor: this.vendorName, aiModel: null };
  }

  /**
   * Streams RAG answer tokens using Groq's high-speed completion engine.
   */
  async *streamRagCompletion({ prompt, contextChunks = [], chatHistory = [] }) {
    const SUB_CONTEXT = 'streamRagCompletion';

    if (process.env.ENV === constant.ENVS.TEST) {
      const mockTokens = ['Mock ', 'response ', 'from ', 'Groq.'];
      for (const token of mockTokens) {
        yield { token, aiVendor: this.vendorName, aiModel: 'mock-groq-llm' };
      }
      return;
    }

    const client = this.getClient();
    const primaryModel = process.env.GROQ_LLM_MODEL || GROQ_CONFIG.DEFAULT_LLM_MODEL;
    const candidateModels = [
      primaryModel,
      ...GROQ_CONFIG.LLM_CANDIDATE_MODELS,
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

    // Format context chunks with numbered citations
    let contextBlock = '';
    if (contextChunks.length > 0) {
      contextBlock = '\n\nDocument Excerpts:\n' + contextChunks.map((chunk, index) => {
        const sourceDoc = chunk.fileName || `Document ${chunk.documentId || ''}`;
        const pageInfo = chunk.pageNumber ? ` (Page ${chunk.pageNumber})` : '';
        return `[${index + 1}] Source: ${sourceDoc}${pageInfo}\n${chunk.content}\n`;
      }).join('\n');
    }

    // Convert prior history into standard OpenAI/Groq message role array
    const messages = [
      { role: 'system', content: SYSTEM_INSTRUCTIONS.RAG_COMPLETION },
    ];

    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      for (const msg of chatHistory) {
        if (!msg.content) continue;
        const role = msg.sender?.toUpperCase() === 'USER' ? 'user' : 'assistant';
        messages.push({ role, content: msg.content });
      }
    }

    const userMessageContent = contextBlock
      ? `Context Information:\n${contextBlock}\n\nUser Question:\n${prompt}`
      : prompt;

    messages.push({ role: 'user', content: userMessageContent });

    let activeStream = null;
    let selectedModel = null;

    for (let idx = 0; idx < candidateModels.length; idx++) {
      const candidate = candidateModels[idx];
      const attemptNum = idx + 1;
      const totalCandidates = candidateModels.length;

      try {
        logger.info(`Initiating Groq streaming completion [Attempt ${attemptNum}/${totalCandidates}]`, CONTEXT, SUB_CONTEXT, {
          model: candidate,
          contextChunksCount: contextChunks.length,
          historyCount: chatHistory.length,
          attempt: attemptNum,
          totalAttempts: totalCandidates,
        });

        activeStream = await client.chat.completions.create({
          model: candidate,
          messages,
          temperature: 0.2,
          stream: true,
        });

        selectedModel = candidate;
        break;
      } catch (err) {
        const isRateLimit = GROQ_CONFIG.RATE_LIMIT_ERROR_SIGNALS.some((sig) =>
          err.message?.toLowerCase().includes(sig.toLowerCase())
        );

        if (isRateLimit && idx < totalCandidates - 1) {
          const nextModel = candidateModels[idx + 1];
          logger.warn(
            `[RETRYING STREAM] Groq Model ${candidate} rate limited. Switching to candidate [${idx + 2}/${totalCandidates}]: ${nextModel}`,
            CONTEXT,
            SUB_CONTEXT,
            { failedModel: candidate, nextModel, error: err.message }
          );
          await new Promise((r) => setTimeout(r, GROQ_CONFIG.CAPACITY_RETRY_DELAY_MS));
          continue;
        }

        if (idx === totalCandidates - 1) {
          logger.error(`[RETRY EXHAUSTED] All ${totalCandidates} Groq streaming candidates failed. Last error: ${err.message}`, CONTEXT, SUB_CONTEXT);
          throw err;
        }
      }
    }

    if (!activeStream) {
      throw new Error('Failed to obtain stream response from Groq.');
    }

    for await (const chunk of activeStream) {
      const token = chunk.choices?.[0]?.delta?.content || '';
      if (token) {
        yield {
          token,
          aiVendor: this.vendorName,
          aiModel: selectedModel,
        };
      }
    }
  }
}
