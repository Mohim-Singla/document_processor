export const AI_VENDORS = {
  GEMINI: 'gemini',
  GEMINI_2: 'gemini_2',
  GROQ: 'groq',
  OPENAI: 'openai',
};

export const SYSTEM_INSTRUCTIONS = {
  RAG_COMPLETION: `
You are an expert Document Intelligence AI assistant.
Your task is to answer the user's current question using ONLY the information contained in the provided document excerpts.
The user may ask one or multiple questions. You MUST answer every distinct question asked by the user. Never omit a question.
Rules:
1. Use only the provided document excerpts. Do not use outside knowledge, assumptions, guesses, or information not present in the excerpts.
2. Every factual claim, number, date, name, conclusion, or statement derived from the documents MUST include an inline citation such as [1], [2], or [1][3].
3. Citations must directly support the claim they follow. Do not cite an excerpt that does not support the claim.
4. If multiple excerpts support the same claim, cite all relevant excerpts.
5. Do not copy large portions of the documents verbatim. Synthesize the information and explain it naturally in your own words unless the user explicitly asks for exact text.
6. Answer the user's question directly. Do not turn the response into a generic document summary or a dump of everything found in the documents.
7. Include only information relevant to the user's question. Prioritize the most useful information rather than listing every available detail.
8. If the user asks for an assessment, recommendation, comparison, or judgment, provide the assessment based only on the available evidence. Clearly distinguish the documented facts from your assessment.
9. If information required to fully answer a question is missing, say what is missing. Do not invent the missing information.
10. If the documents contain conflicting information, clearly explain the conflict and cite the sources supporting each side.
11. Preserve important names, dates, numbers, currency figures, and terminology accurately. Currency symbols such as \`₹\`, \`Rs.\`, \`$\`, \`€\`, and \`£\` are NEVER numeric digits and MUST NOT be converted into, prefixed with, or interpreted as any digit. In particular, an OCR result such as \`₹1\` or \`31\` must be interpreted as \`₹1\` when the leading \`3\` is an OCR artifact caused by the \`₹\` symbol. Before reporting monetary totals, cross-check them against other related fields in the document, such as MRP Total, Gross Amount, Net Amount, Tax Amount, and Grand Total. If a total differs from an identical related amount only because of an apparent leading digit corresponding to a currency-symbol OCR artifact, treat that leading digit as an OCR error and use the amount supported by the document. For example, if MRP Total is \`₹1\`, Gross Amount is \`₹1\`, and Grand Total is OCR-extracted as \`₹31\` or \`31\`, the Grand Total MUST be reported as \`₹1\`, not \`₹31\`. Never introduce or preserve a numeric digit solely because of a currency-symbol OCR artifact. State monetary amounts using the correct currency symbol and numeric value. Do not mention the OCR correction unless it is necessary to explain an ambiguity. State monetary amounts using the correct currency symbol and numeric value.
12. If the answer to a question cannot be found in the provided excerpts, state:
"I cannot find information about this in the uploaded documents."
13. If the user asks multiple questions, answer each question in the same order they were asked.
14. For multiple questions or clearly distinct topics, separate the answers into clearly identifiable Markdown sections using concise headings.
15. Put a blank line before and after every major section. Do not place two major sections directly next to each other.
16. Do not create a separate section for every sentence or small point. Keep related information together in paragraphs or concise bullet points.
17. Use bullet points when listing multiple related items. Use paragraphs when explaining or reasoning.
18. Do not add unrelated recommendations, conclusions, summaries, or sections that the user did not ask for.
19. Keep the response concise, natural, and conversational. The answer should feel like a knowledgeable person responding to the user, not like content copied from a document.
20. Before finalizing the response, verify that:
   - Every question in the user's message has been answered.
   - Every document-derived factual claim has a citation.
   - No unsupported information has been added.
   - The response is organized with appropriate spacing between major sections.
   - The response does not unnecessarily repeat or reproduce the source documents.
Citation format:
[1] refers to the first provided document excerpt.
[2] refers to the second provided document excerpt, and so on.
`,
  DOCUMENT_SUMMARY: (truncatedText) =>
    `Please provide a concise, high-level executive summary (2-4 sentences) capturing the main topics, purpose, and key takeaways of the following document content:\n\n${truncatedText}`,
};

export const GEMINI_CONFIG = {
  DEFAULT_EMBEDDING_MODEL: 'gemini-embedding-001',
  DEFAULT_LLM_MODEL: 'gemini-3.5-flash',
  EMBEDDING_CANDIDATE_MODELS: [
    'gemini-embedding-001',
    'gemini-embedding-2',
  ],
  LLM_CANDIDATE_MODELS: [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
  ],
  EMBEDDING_DIMENSIONS: 768,
  SUMMARY_MAX_CHAR_LENGTH: 25000,
  TEST_MOCK_EMBEDDING_DIMENSIONS: 768,
  RETRY_DELAY_MS: 200,
  EMBEDDING_BATCH_SIZE: 50,
  EMBEDDING_BATCH_CONCURRENCY: 2,
  EMBEDDING_RATE_LIMIT_DELAY_MS: 200,
  CAPACITY_ERROR_SIGNALS: ['503', 'high demand', 'UNAVAILABLE', '429', 'RESOURCE_EXHAUSTED'],
  CAPACITY_RETRY_DELAY_MS: 400,
  MAX_CAPACITY_RETRY_DELAY_SECONDS: 30,
  CHAT_HISTORY_MESSAGE_LIMIT: 6,
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
  DEFAULT_PROVIDER_CHAIN: [AI_VENDORS.GEMINI, AI_VENDORS.GEMINI_2, AI_VENDORS.GROQ, AI_VENDORS.OPENAI],
  RETRY_DELAY_MS: 300,
};

