import { GoogleGenAI } from '@google/genai';
import { constant } from '../utils/constant/index.js';
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
    return new Array(768).fill(0).map((_, i) => Math.sin(i + text.length) * 0.05);
  }

  const ai = getAI();
  const model = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

  logger.info('Generating embedding via Gemini API', CONTEXT, SUB_CONTEXT, { model, textLength: text.length });

  const response = await ai.models.embedContent({
    model,
    contents: text,
  });

  // Extract embedding values from SDK response
  if (response.embeddings && response.embeddings[0]?.values) {
    logger.info('Embedding generated successfully', CONTEXT, SUB_CONTEXT, { dimensions: response.embeddings[0].values.length });
    return response.embeddings[0].values;
  }
  if (response.embedding?.values) {
    logger.info('Embedding generated successfully', CONTEXT, SUB_CONTEXT, { dimensions: response.embedding.values.length });
    return response.embedding.values;
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
Your goal is to answer the user's questions truthfully and comprehensively using ONLY the provided document context excerpts.

Rules:
1. Every major fact, statement, figure, or claim must be accompanied by an inline citation bracket referring to the source excerpt number, e.g. "[1]" or "[2]".
2. If the answer is not present in the excerpts, state clearly: "I cannot find information about this in the uploaded documents."
3. Format output clearly with markdown (bullet points, bold highlights, tables if applicable).
`;

  const ai = getAI();
  const primaryModel = process.env.GEMINI_LLM_MODEL || 'gemini-3.5-flash';
  // Candidate fallback models in case the primary experiences temporary 503 demand spikes
  const candidateModels = [
    primaryModel,
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.6-flash',
  ].filter((v, idx, arr) => arr.indexOf(v) === idx);

  const fullUserPrompt = `Context Documents:\n${formattedContext}\n\nUser Question:\n${prompt}`;

  let streamResult = null;
  let activeModel = primaryModel;

  for (const candidate of candidateModels) {
    try {
      logger.info('Invoking Gemini generateContentStream', CONTEXT, SUB_CONTEXT, { model: candidate });
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
      break;
    } catch (err) {
      const isCapacityError =
        err.message?.includes('503') ||
        err.message?.includes('high demand') ||
        err.message?.includes('UNAVAILABLE');

      if (isCapacityError) {
        logger.warn(`Model ${candidate} is experiencing high demand (503). Trying fallback candidate...`, CONTEXT, SUB_CONTEXT, {
          candidate,
          error: err.message,
        });
        // Short pause before attempting the next candidate
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      throw err;
    }
  }

  if (!streamResult) {
    throw new Error('All Gemini model clusters are currently at capacity (503). Please retry in a few moments.');
  }

  for await (const chunk of streamResult) {
    const text = chunk.text;
    if (text) {
      yield text;
    }
  }

  logger.info('Gemini stream generation completed', CONTEXT, SUB_CONTEXT, { activeModel });
}

export const geminiService = {
  getEmbedding,
  streamRagCompletion,
};
