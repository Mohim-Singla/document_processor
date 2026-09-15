export const GEMINI_CONFIG = {
  DEFAULT_EMBEDDING_MODEL: 'gemini-embedding-001',
  DEFAULT_LLM_MODEL: 'gemini-3.5-flash',
  EMBEDDING_CANDIDATE_MODELS: [
    'gemini-embedding-001',
    'gemini-embedding-2',
    'text-embedding-004',
  ],
  LLM_CANDIDATE_MODELS: [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.6-flash',
    'gemini-2.5-flash',
  ],
  SUMMARY_MAX_CHAR_LENGTH: 25000,
  TEST_MOCK_EMBEDDING_DIMENSIONS: 768,
  RETRY_DELAY_MS: 200,
  EMBEDDING_BATCH_SIZE: 50,
  EMBEDDING_BATCH_CONCURRENCY: 2,
  EMBEDDING_RATE_LIMIT_DELAY_MS: 200,
};
