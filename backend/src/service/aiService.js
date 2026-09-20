import { MultiProviderAIService } from './ai/MultiProviderAIService.js';
import { AIFactory } from './ai/AIFactory.js';
import { GeminiService } from './ai/GeminiService.js';
import { OpenAIService } from './ai/OpenAIService.js';
import { BaseAIService } from './ai/BaseAIService.js';

export const aiService = new MultiProviderAIService();

export {
  BaseAIService,
  GeminiService,
  OpenAIService,
  AIFactory,
  MultiProviderAIService,
};
