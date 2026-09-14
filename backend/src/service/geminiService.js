import { GoogleGenAI } from '@google/genai';

let aiInstance = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey && process.env.ENV !== 'test') {
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
  // Mock only runs when ENV === 'test'
  if (process.env.ENV === 'test') {
    return new Array(768).fill(0).map((_, i) => Math.sin(i + text.length) * 0.05);
  }

  const ai = getAI();
  const model = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

  const response = await ai.models.embedContent({
    model,
    contents: text,
  });

  // Extract embedding values from SDK response
  if (response.embeddings && response.embeddings[0]?.values) {
    return response.embeddings[0].values;
  }
  if (response.embedding?.values) {
    return response.embedding.values;
  }
  return [];
}

/**
 * Streams conversational RAG answer given user prompt and relevant context chunks
 */
export async function* streamRagCompletion({ prompt, contextChunks = [] }) {
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
  const model = process.env.GEMINI_LLM_MODEL || 'gemini-3.6-flash';
  const fullUserPrompt = `Context Documents:\n${formattedContext}\n\nUser Question:\n${prompt}`;

  const streamResult = await ai.models.generateContentStream({
    model,
    contents: [
      { role: 'user', parts: [{ text: fullUserPrompt }] }
    ],
    config: {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      }
    }
  });

  for await (const chunk of streamResult) {
    const text = chunk.text;
    if (text) {
      yield text;
    }
  }
}

export const geminiService = {
  getEmbedding,
  streamRagCompletion,
};
