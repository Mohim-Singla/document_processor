import { GeminiService } from './GeminiService.js';
import { GroqService } from './GroqService.js';
import { OpenAIService } from './OpenAIService.js';
import { AI_VENDORS, constant, AI_ORCHESTRATION } from '../../utils/constant/index.js';
import { logger } from '../../utils/logger.js';

const CONTEXT = 'AIFactory';

/**
 * Factory for creating and discovering AI provider instances.
 */
export class AIFactory {
  /**
   * Instantiates a concrete BaseAIService provider by vendor name.
   * @param {string} vendor
   * @param {Object} [config]
   * @returns {import('./BaseAIService.js').BaseAIService}
   */
  static createProvider(vendor, config = {}) {
    switch (vendor?.toLowerCase()) {
    case AI_VENDORS.GEMINI:
      return new GeminiService(config.apiKey);
    case AI_VENDORS.GROQ:
      return new GroqService(config.apiKey);
    case AI_VENDORS.OPENAI:
      return new OpenAIService(config.apiKey);
    default:
      logger.error(`Unknown AI vendor requested: ${vendor}`, CONTEXT, this.createProvider.name);
      throw new Error(`Unsupported AI vendor '${vendor}'. Supported vendors: ${Object.values(AI_VENDORS).join(', ')}`);
    }
  }

  /**
   * Discovers and instantiates available providers in prioritized order.
   * Order can be customized via AI_PROVIDER_ORDER environment variable (default: "gemini,groq,openai").
   * @returns {import('./BaseAIService.js').BaseAIService[]}
   */
  static getAvailableProviders() {
    const SUB_CONTEXT = this.getAvailableProviders.name;
    const isTest = process.env.ENV === constant.ENVS.TEST;

    // Prioritized vendor order from env or default
    const defaultOrder = AI_ORCHESTRATION.DEFAULT_PROVIDER_CHAIN.join(',');
    const configuredOrder = (process.env.AI_PROVIDER_ORDER || defaultOrder)
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const providers = [];

    for (const vendor of configuredOrder) {
      if (vendor === AI_VENDORS.GEMINI) {
        if (process.env.GEMINI_API_KEY || isTest) {
          providers.push(new GeminiService());
        } else {
          logger.warn('GEMINI_API_KEY not found in environment; Gemini provider skipped in chain', CONTEXT, SUB_CONTEXT);
        }
      } else if (vendor === AI_VENDORS.GROQ) {
        if (process.env.GROQ_API_KEY || isTest) {
          providers.push(new GroqService());
        } else {
          logger.warn('GROQ_API_KEY not found in environment; Groq provider skipped in chain', CONTEXT, SUB_CONTEXT);
        }
      } else if (vendor === AI_VENDORS.OPENAI) {
        if (process.env.OPENAI_API_KEY || isTest) {
          providers.push(new OpenAIService());
        } else {
          logger.warn('OPENAI_API_KEY not found in environment; OpenAI provider skipped in chain', CONTEXT, SUB_CONTEXT);
        }
      }
    }

    if (providers.length === 0 && !isTest) {
      logger.critical('No AI providers configured! Ensure at least GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY is set', CONTEXT, SUB_CONTEXT);
    }

    logger.info('Initialized active AI provider chain', CONTEXT, SUB_CONTEXT, {
      chain: providers.map((p) => p.vendorName),
    });

    return providers;
  }
}
