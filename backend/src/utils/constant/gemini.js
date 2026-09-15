export const GEMINI_CONFIG = {
  DEFAULT_EMBEDDING_MODEL: 'gemini-embedding-001',
  DEFAULT_LLM_MODEL: 'gemini-3.5-flash',
  EMBEDDING_CANDIDATE_MODELS: [
    'gemini-embedding-001',
    'text-embedding-004',
    'gemini-embedding-exp-03-07',
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
  RETRY_DELAY_MS: 400,
};
