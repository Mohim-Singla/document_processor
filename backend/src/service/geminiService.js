import { GoogleGenAI } from '@google/genai';
import { constant, GEMINI_CONFIG } from '../utils/constant/index.js';
import { logger } from '../utils/logger.js';

const CONTEXT = 'geminiService';
let aiInstance = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey && process.env.ENV !== 'test') {
      logger.critical('GEMINI_API_KEY is missing in environment', CONTEXT, getAI.name);
      throw new Error('GEMINI_API_KEY is missing in environment.');
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

/**
 * Computes vector embedding for a given text snippet using Google GenAI embedding models
 */
export async function getEmbedding(text) {
  const SUB_CONTEXT = getEmbedding.name;
  // Mock only runs when ENV === 'test'
  if (process.env.ENV === constant.ENVS.TEST) {
    logger.debug('Returning test mock embedding vector', CONTEXT, SUB_CONTEXT, { textLength: text.length });
    return new Array(GEMINI_CONFIG.TEST_MOCK_EMBEDDING_DIMENSIONS).fill(0).map((_, i) => Math.sin(i + text.length) * 0.05);
  }

  const ai = getAI();
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

      if (response.embeddings && response.embeddings[0]?.values) {
        if (idx > 0) {
          logger.info(`[RETRY SUCCESS] Embedding generated successfully with fallback model: ${candidate}`, CONTEXT, SUB_CONTEXT, {
            model: candidate,
            dimensions: response.embeddings[0].values.length,
            successfulAttempt: attemptNum,
          });
        } else {
          logger.info('Embedding generated successfully', CONTEXT, SUB_CONTEXT, { dimensions: response.embeddings[0].values.length });
        }
        return response.embeddings[0].values;
      }
      if (response.embedding?.values) {
        if (idx > 0) {
          logger.info(`[RETRY SUCCESS] Embedding generated successfully with fallback model: ${candidate}`, CONTEXT, SUB_CONTEXT, {
            model: candidate,
            dimensions: response.embedding.values.length,
            successfulAttempt: attemptNum,
          });
        } else {
          logger.info('Embedding generated successfully', CONTEXT, SUB_CONTEXT, { dimensions: response.embedding.values.length });
        }
        return response.embedding.values;
      }
    } catch (err) {
      const isCapacityError =
        err.message?.includes('503') ||
        err.message?.includes('high demand') ||
        err.message?.includes('UNAVAILABLE') ||
        err.message?.includes('429') ||
        err.message?.includes('RESOURCE_EXHAUSTED');

      if (isCapacityError && idx < totalCandidates - 1) {
        const nextModel = candidateModels[idx + 1];
        logger.warn(`[RETRYING EMBEDDING] Model ${candidate} capacity busy (503/429). Still retrying... Switching to next candidate [${idx + 2}/${totalCandidates}]: ${nextModel}`, CONTEXT, SUB_CONTEXT, {
          failedModel: candidate,
          nextModel,
          attempt: attemptNum,
          remainingAttempts: totalCandidates - attemptNum,
          error: err.message,
        });
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      if (idx === totalCandidates - 1) {
        logger.error(`[RETRY EXHAUSTED] All ${totalCandidates} embedding candidate models failed. Last error: ${err.message}`, CONTEXT, SUB_CONTEXT, {
          error: err.message,
        });
        throw err;
      }
    }
  }

  logger.warn('Empty embedding response received', CONTEXT, SUB_CONTEXT);
  return [];
}

/**
 * Streams conversational RAG answer given user prompt and relevant context chunks
 */
export async function* streamRagCompletion({ prompt, contextChunks = [] }) {
  const SUB_CONTEXT = streamRagCompletion.name;
  logger.info('Starting streaming RAG generation with Gemini', CONTEXT, SUB_CONTEXT, { chunkCount: contextChunks.length, promptLength: prompt.length });

  // Mock only runs when ENV === 'test'
  if (process.env.ENV === 'test') {
    const fallbackText = `[Test Mode] Answer for: ${prompt} based on ${contextChunks.length} documents. [1]`;
    for (const word of fallbackText.split(' ')) {
      yield `${word} `;
      await new Promise((r) => setTimeout(r, 20));
    }
    return;
  }

  const formattedContext = contextChunks
    .map((chunk, index) => {
      const docName = chunk.fileName || `Document_${chunk.documentId}`;
      const pageInfo = chunk.pageNumber ? `(Page ${chunk.pageNumber})` : '';
      return `[${index + 1}] Source: ${docName} ${pageInfo}\nContent:\n${chunk.content}\n---`;
    })
    .join('\n\n');

  const systemInstruction = `
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
11. Preserve important names, dates, numbers, terminology, and other specific details accurately.
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
`;

  const ai = getAI();
  const primaryModel = process.env.GEMINI_LLM_MODEL || GEMINI_CONFIG.DEFAULT_LLM_MODEL;
  // Candidate fallback models in case the primary experiences temporary 503 demand spikes
  const candidateModels = [
    primaryModel,
    ...GEMINI_CONFIG.LLM_CANDIDATE_MODELS,
  ].filter((v, idx, arr) => arr.indexOf(v) === idx);

  const fullUserPrompt = `Context Documents:\n${formattedContext}\n\nUser Question:\n${prompt}`;

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
      if (idx > 0) {
        logger.info(`[RETRY SUCCESS] Stream generation established with fallback model: ${candidate}`, CONTEXT, SUB_CONTEXT, {
          model: candidate,
          successfulAttempt: attemptNum,
        });
      }
      break;
    } catch (err) {
      const isCapacityError =
        err.message?.includes('503') ||
        err.message?.includes('high demand') ||
        err.message?.includes('UNAVAILABLE') ||
        err.message?.includes('429') ||
        err.message?.includes('RESOURCE_EXHAUSTED');

      if (isCapacityError && idx < totalCandidates - 1) {
        const nextModel = candidateModels[idx + 1];
        logger.warn(`[RETRYING STREAM] Model ${candidate} capacity busy (503/429). Still retrying... Switching to next candidate [${idx + 2}/${totalCandidates}]: ${nextModel}`, CONTEXT, SUB_CONTEXT, {
          failedModel: candidate,
          nextModel,
          attempt: attemptNum,
          remainingAttempts: totalCandidates - attemptNum,
          error: err.message,
        });
        await new Promise((r) => setTimeout(r, GEMINI_CONFIG.RETRY_DELAY_MS));
        continue;
      }
      if (idx === totalCandidates - 1) {
        logger.error(`[RETRY EXHAUSTED] All ${totalCandidates} streaming LLM candidates failed. Last error: ${err.message}`, CONTEXT, SUB_CONTEXT, {
          error: err.message,
        });
        throw err;
      }
    }
  }

  if (!streamResult) {
    throw new Error('All Gemini model clusters are currently at capacity (503/429). Please retry in a few moments.');
  }

  for await (const chunk of streamResult) {
    const text = chunk.text;
    if (text) {
      yield text;
    }
  }

  logger.info('Gemini stream generation completed', CONTEXT, SUB_CONTEXT, { activeModel });
}

/**
 * Generates a concise high-level document summary
 */
export async function generateDocumentSummary(rawText) {
  const SUB_CONTEXT = generateDocumentSummary.name;
  if (!rawText || !rawText.trim()) return '';

  if (process.env.ENV === constant.ENVS.TEST || process.env.ENV === 'test') {
    logger.debug('Returning test mock document summary', CONTEXT, SUB_CONTEXT);
    return 'Summary of the uploaded document based on parsed content.';
  }

  const ai = getAI();
  const primaryModel = process.env.GEMINI_LLM_MODEL || GEMINI_CONFIG.DEFAULT_LLM_MODEL;
  const candidateModels = [
    primaryModel,
    ...GEMINI_CONFIG.LLM_CANDIDATE_MODELS,
  ].filter((v, idx, arr) => arr.indexOf(v) === idx);

  // Trim rawText to configured maximum characters to keep latency fast while capturing key sections
  const truncatedText = rawText.slice(0, GEMINI_CONFIG.SUMMARY_MAX_CHAR_LENGTH);
  const prompt = `Please provide a concise, high-level executive summary (2-4 sentences) capturing the main topics, purpose, and key takeaways of the following document content:\n\n${truncatedText}`;

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
        if (idx > 0) {
          logger.info(`[RETRY SUCCESS] Successfully generated summary with fallback model: ${candidate}`, CONTEXT, SUB_CONTEXT, {
            model: candidate,
            summaryLength: summary.length,
            successfulAttempt: attemptNum,
          });
        } else {
          logger.info('Document summary generated successfully', CONTEXT, SUB_CONTEXT, { model: candidate, summaryLength: summary.length });
        }
        return summary;
      }
    } catch (err) {
      const isCapacityError =
        err.message?.includes('503') ||
        err.message?.includes('high demand') ||
        err.message?.includes('UNAVAILABLE') ||
        err.message?.includes('429') ||
        err.message?.includes('RESOURCE_EXHAUSTED');

      if (isCapacityError && idx < totalCandidates - 1) {
        const nextModel = candidateModels[idx + 1];
        logger.warn(`[RETRYING SUMMARY] Model ${candidate} busy (503/429). Still retrying... Switching to candidate [${idx + 2}/${totalCandidates}]: ${nextModel}`, CONTEXT, SUB_CONTEXT, {
          failedCandidate: candidate,
          nextCandidate: nextModel,
          attempt: attemptNum,
          remainingAttempts: totalCandidates - attemptNum,
          error: err.message,
        });
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      logger.warn('Error generating summary with candidate', CONTEXT, SUB_CONTEXT, { candidate, error: err.message });
    }
  }

  logger.warn('All candidate models failed or returned empty summary', CONTEXT, SUB_CONTEXT);
  return '';
}

export const geminiService = {
  getEmbedding,
  generateDocumentSummary,
  streamRagCompletion,
};
