import { BaseAIService } from './BaseAIService.js';
import { AIFactory } from './AIFactory.js';
import { constant, AI_ORCHESTRATION } from '../../utils/constant/index.js';
import { logger } from '../../utils/logger.js';

const CONTEXT = 'MultiProviderAIService';

/**
 * Composite AI service executing the strategy pattern across an array of providers.
 * Automatically falls back to secondary providers (e.g. OpenAI) when primary (e.g. Gemini)
 * encounters rate-limits (429), capacity exhaustion (503), or quota blocks.
 */
export class MultiProviderAIService extends BaseAIService {
  constructor(providers = null) {
    super('multi-provider');
    this.providers = providers;
  }

  getProviders() {
    if (!this.providers || this.providers.length === 0) {
      this.providers = AIFactory.getAvailableProviders();
    }
    return this.providers;
  }

  /**
   * Helper that iterates through the provider chain, falling back upon errors.
   */
  async executeWithFallback(operationName, executeFn) {
    const SUB_CONTEXT = `${this.constructor.name}.${operationName}`;
    const providers = this.getProviders();

    if (!providers || providers.length === 0) {
      if (process.env.ENV === constant.ENVS.TEST) {
        return executeFn(AIFactory.createProvider('gemini'));
      }
      throw new Error('No AI providers available to execute operation.');
    }

    let lastError = null;

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      const attemptNum = i + 1;
      const totalProviders = providers.length;

      try {
        logger.info(`[AI ORCHESTRATOR] Executing ${operationName} with provider [${attemptNum}/${totalProviders}]: ${provider.vendorName}`, CONTEXT, SUB_CONTEXT, {
          provider: provider.vendorName,
          attempt: attemptNum,
          totalProviders,
        });

        const result = await executeFn(provider);

        if (i > 0) {
          logger.info(`[AI ORCHESTRATOR FAILOVER SUCCESS] ${operationName} succeeded via fallback provider: ${provider.vendorName}`, CONTEXT, SUB_CONTEXT, {
            succeededProvider: provider.vendorName,
            attempt: attemptNum,
          });
        }

        return result;
      } catch (err) {
        lastError = err;
        const hasFallback = i < totalProviders - 1;

        if (hasFallback) {
          const nextProvider = providers[i + 1];
          logger.warn(
            `[AI ORCHESTRATOR FAILOVER] Provider ${provider.vendorName} failed on ${operationName}. Cascading to fallback provider [${i + 2}/${totalProviders}]: ${nextProvider.vendorName}`,
            CONTEXT,
            SUB_CONTEXT,
            {
              failedProvider: provider.vendorName,
              nextProvider: nextProvider.vendorName,
              errorMessage: err.message,
            }
          );
          await new Promise((r) => setTimeout(r, AI_ORCHESTRATION.RETRY_DELAY_MS));
        } else {
          logger.error(
            `[AI ORCHESTRATOR EXHAUSTED] All ${totalProviders} providers in chain failed on ${operationName}. Last error: ${err.message}`,
            CONTEXT,
            SUB_CONTEXT,
            { lastError: err.message }
          );
        }
      }
    }

    throw lastError || new Error(`All AI providers failed for ${operationName}.`);
  }

  async getEmbedding(text) {
    return this.executeWithFallback('getEmbedding', (provider) => provider.getEmbedding(text));
  }

  async getEmbeddingsBatch(texts) {
    return this.executeWithFallback('getEmbeddingsBatch', (provider) => provider.getEmbeddingsBatch(texts));
  }

  async getEmbeddingsForChunks(chunks, userId, options = {}) {
    return this.executeWithFallback('getEmbeddingsForChunks', (provider) =>
      provider.getEmbeddingsForChunks(chunks, userId, options)
    );
  }

  async generateDocumentSummary(rawText) {
    return this.executeWithFallback('generateDocumentSummary', (provider) =>
      provider.generateDocumentSummary(rawText)
    );
  }

  /**
   * Cascading streaming RAG completion.
   * If primary provider fails to establish the stream, immediately falls back to the next provider.
   */
  async *streamRagCompletion(params) {
    const SUB_CONTEXT = `${this.constructor.name}.streamRagCompletion`;
    const providers = this.getProviders();

    if (!providers || providers.length === 0) {
      if (process.env.ENV === constant.ENVS.TEST) {
        const testProvider = AIFactory.createProvider('gemini');
        yield* testProvider.streamRagCompletion(params);
        return;
      }
      throw new Error('No AI providers available for streaming completion.');
    }

    let lastError = null;

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      const attemptNum = i + 1;
      const totalProviders = providers.length;

      try {
        logger.info(`[AI STREAM ORCHESTRATOR] Initiating stream with provider [${attemptNum}/${totalProviders}]: ${provider.vendorName}`, CONTEXT, SUB_CONTEXT, {
          provider: provider.vendorName,
          attempt: attemptNum,
          totalProviders,
        });

        const generator = provider.streamRagCompletion(params);
        let receivedFirstChunk = false;

        // Iterate through generator chunks
        for await (const chunk of generator) {
          receivedFirstChunk = true;
          yield chunk;
        }

        if (receivedFirstChunk) {
          logger.info(`[AI STREAM ORCHESTRATOR] Stream completed successfully with provider: ${provider.vendorName}`, CONTEXT, SUB_CONTEXT);
          return;
        }
      } catch (err) {
        lastError = err;
        const hasFallback = i < totalProviders - 1;

        if (hasFallback) {
          const nextProvider = providers[i + 1];
          logger.warn(
            `[AI STREAM ORCHESTRATOR FAILOVER] Provider ${provider.vendorName} stream failed. Falling back to [${i + 2}/${totalProviders}]: ${nextProvider.vendorName}`,
            CONTEXT,
            SUB_CONTEXT,
            {
              failedProvider: provider.vendorName,
              nextProvider: nextProvider.vendorName,
              errorMessage: err.message,
            }
          );
          await new Promise((r) => setTimeout(r, AI_ORCHESTRATION.RETRY_DELAY_MS));
        } else {
          logger.error(
            `[AI STREAM ORCHESTRATOR EXHAUSTED] All ${totalProviders} providers failed for stream. Last error: ${err.message}`,
            CONTEXT,
            SUB_CONTEXT,
            { lastError: err.message }
          );
        }
      }
    }

    throw lastError || new Error('All AI providers failed to generate stream response.');
  }
}
