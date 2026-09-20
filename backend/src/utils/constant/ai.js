export const AI_VENDORS = {
  GEMINI: 'gemini',
  GROQ: 'groq',
  OPENAI: 'openai',
};

export const GROQ_CONFIG = {
  DEFAULT_LLM_MODEL: 'openai/gpt-oss-120b',
  LLM_CANDIDATE_MODELS: [
    'openai/gpt-oss-120b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b',
    'groq/compound',
    'groq/compound-mini',
  ],
  SUMMARY_MAX_CHAR_LENGTH: 25000,
  RETRY_DELAY_MS: 300,
  CAPACITY_RETRY_DELAY_MS: 500,
  RATE_LIMIT_ERROR_SIGNALS: [
    '429',
    'rate_limit_exceeded',
    'rate limit',
    'tokens per minute',
    'requests per minute',
    '503',
    'overloaded',
    'service unavailable',
  ],
};

export const OPENAI_CONFIG = {
  DEFAULT_LLM_MODEL: 'gpt-4o-mini',
  LLM_CANDIDATE_MODELS: [
    'gpt-4o-mini',
    'gpt-4o',
  ],
  DEFAULT_EMBEDDING_MODEL: 'text-embedding-3-small',
  EMBEDDING_CANDIDATE_MODELS: [
    'text-embedding-3-small',
  ],
  EMBEDDING_DIMENSIONS: 768,
  SUMMARY_MAX_CHAR_LENGTH: 25000,
  RETRY_DELAY_MS: 300,
  RATE_LIMIT_ERROR_SIGNALS: [
    '429',
    'rate_limit',
    'rate limit',
    'insufficient_quota',
    '503',
    'overloaded',
    'service unavailable',
    'capacity',
  ],
  CAPACITY_RETRY_DELAY_MS: 500,
};

export const AI_ORCHESTRATION = {
  DEFAULT_PROVIDER_CHAIN: [AI_VENDORS.GEMINI, AI_VENDORS.GROQ, AI_VENDORS.OPENAI],
  RETRY_DELAY_MS: 300,
};
