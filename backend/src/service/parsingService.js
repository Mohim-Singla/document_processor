import PDFParser from 'pdf2json';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import { v4 as uuidv4 } from 'uuid';
import { CHUNKING_CONFIG } from '../utils/constant/index.js';
import { logger } from '../utils/logger.js';

const CONTEXT = 'parsingService';

let ocrWorkerInstance = null;

/**
 * Lazily initializes and caches a Tesseract OCR worker
 */
async function getOcrWorker() {
  if (!ocrWorkerInstance) {
    logger.info('Initializing Tesseract OCR worker', CONTEXT, getOcrWorker.name);
    ocrWorkerInstance = await createWorker('eng');
  }
  return ocrWorkerInstance;
}

/**
 * Extracts text from image buffer using Tesseract OCR
 */
async function extractImageText(buffer) {
  const SUB_CONTEXT = extractImageText.name;
  logger.info('Running Tesseract OCR on image buffer', CONTEXT, SUB_CONTEXT, { byteLength: buffer?.length });
  const worker = await getOcrWorker();
  const ret = await worker.recognize(buffer);
  const text = ret.data.text ? ret.data.text.replace(/\s+/g, ' ').trim() : '';
  logger.info('Tesseract OCR extraction finished', CONTEXT, SUB_CONTEXT, { extractedLength: text.length });
  return text;
}

/**
 * Safely decodes URI-encoded text from pdf2json without throwing on unescaped '%' signs
 */
function safeDecodeText(text) {
  if (!text) return '';
  try {
    return decodeURIComponent(text);
  } catch {
    return text.replace(/%([0-9A-Fa-f]{2})/g, (match, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return match;
      }
    });
  }
}

/**
 * Extracts text page-by-page from a PDF buffer using pdf2json
 */
function extractPdfText(buffer) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);

    pdfParser.on('pdfParser_dataError', (errData) => {
      reject(new Error(errData.parserError || 'Failed to parse PDF'));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        const pages = [];
        if (pdfData && pdfData.Pages) {
          pdfData.Pages.forEach((page, pageIndex) => {
            const pageTexts = [];
            if (page.Texts) {
              page.Texts.forEach((textObj) => {
                if (textObj.R) {
                  textObj.R.forEach((r) => {
                    if (r.T) {
                      pageTexts.push(safeDecodeText(r.T));
                    }
                  });
                }
              });
            }
            pages.push({
              pageNumber: pageIndex + 1,
              text: pageTexts.join(' ').replace(/\s+/g, ' ').trim(),
            });
          });
        }
        resolve({
          pageCount: pages.length || 1,
          pages,
        });
      } catch (e) {
        reject(e);
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}

const setImmediatePromise = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Splits text into chunks with token overlap in an event-loop cooperative manner
 */
export async function chunkText(
  text,
  {
    chunkSize = CHUNKING_CONFIG.DEFAULT_CHUNK_SIZE,
    overlap = CHUNKING_CONFIG.DEFAULT_OVERLAP,
    maxChunks = CHUNKING_CONFIG.DEFAULT_MAX_CHUNKS,
  } = {}
) {
  const chunks = [];
  let startIndex = 0;
  let iteration = 0;

  while (startIndex < text.length && chunks.length < maxChunks) {
    // Yield execution to the Node.js event loop every N iterations so HTTP requests and other I/O are never blocked
    if (++iteration % CHUNKING_CONFIG.EVENT_LOOP_YIELD_INTERVAL === 0) {
      await setImmediatePromise();
    }

    let endIndex = startIndex + chunkSize;
    if (endIndex >= text.length) {
      chunks.push(text.slice(startIndex).trim());
      break;
    }

    // Try to break cleanly on paragraph or sentence boundary
    const nextNewline = text.indexOf('\n\n', endIndex - CHUNKING_CONFIG.PARAGRAPH_LOOKBACK);
    if (nextNewline !== -1 && nextNewline < endIndex + CHUNKING_CONFIG.PARAGRAPH_LOOKAHEAD) {
      endIndex = nextNewline;
    } else {
      const nextPeriod = text.indexOf('. ', endIndex - CHUNKING_CONFIG.SENTENCE_LOOKBACK);
      if (nextPeriod !== -1 && nextPeriod < endIndex + CHUNKING_CONFIG.SENTENCE_LOOKAHEAD) {
        endIndex = nextPeriod + 1;
      }
    }

    const chunk = text.slice(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    startIndex = Math.max(startIndex + 1, endIndex - overlap);
  }

  return chunks;
}

/**
 * Parses file buffer based on mimeType / extension and returns extracted chunks
 */
export async function parseDocument({ buffer, fileName, mimeType, documentId, sessionId }) {
  const SUB_CONTEXT = parseDocument.name;
  logger.info('Starting document parsing', CONTEXT, SUB_CONTEXT, { fileName, mimeType, documentId });

  let pages = [];
  let totalPageCount = 1;

  const isImage = mimeType?.startsWith('image/') || /\.(png|jpe?g|webp|bmp|tiff)$/i.test(fileName);
  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.toLowerCase().endsWith('.docx');

  if (isPdf) {
    logger.info('Parsing PDF file with pdf2json', CONTEXT, SUB_CONTEXT, { fileName });
    const parsed = await extractPdfText(buffer);
    totalPageCount = parsed.pageCount;
    pages = parsed.pages;
  } else if (isDocx) {
    logger.info('Parsing DOCX document with mammoth', CONTEXT, SUB_CONTEXT, { fileName });
    const result = await mammoth.extractRawText({ buffer });
    pages.push({ pageNumber: 1, text: result.value });
  } else if (isImage) {
    logger.info('Parsing Image with Tesseract OCR', CONTEXT, SUB_CONTEXT, { fileName, mimeType });
    const ocrText = await extractImageText(buffer);
    pages.push({ pageNumber: 1, text: ocrText });
  } else {
    logger.info('Parsing plaintext document', CONTEXT, SUB_CONTEXT, { fileName });
    const text = buffer.toString('utf-8');
    pages.push({ pageNumber: 1, text });
  }

  const documentChunks = [];
  let chunkIndexCounter = 0;
  const maxTotalChunks = CHUNKING_CONFIG.MAX_TOTAL_DOCUMENT_CHUNKS;

  for (const page of pages) {
    if (documentChunks.length >= maxTotalChunks) break;
    const remainingBudget = maxTotalChunks - documentChunks.length;
    const textChunks = await chunkText(page.text, {
      chunkSize: CHUNKING_CONFIG.DEFAULT_CHUNK_SIZE,
      overlap: CHUNKING_CONFIG.DEFAULT_OVERLAP,
      maxChunks: remainingBudget,
    });
    for (const chunkTextContent of textChunks) {
      if (!chunkTextContent) continue;
      documentChunks.push({
        chunkId: uuidv4(),
        documentId,
        sessionId,
        pageNumber: page.pageNumber,
        chunkIndex: chunkIndexCounter++,
        content: chunkTextContent,
        metadata: {
          charLength: chunkTextContent.length,
          fileName,
        },
      });
      if (documentChunks.length >= CHUNKING_CONFIG.MAX_TOTAL_DOCUMENT_CHUNKS) break;
    }
  }

  const fullRawText = pages.map((p) => p.text).filter(Boolean).join('\n\n');

  logger.info('Document parsing completed', CONTEXT, SUB_CONTEXT, {
    fileName,
    totalPageCount,
    totalChunks: documentChunks.length,
    rawTextLength: fullRawText.length,
  });

  return {
    pageCount: totalPageCount,
    rawText: fullRawText,
    chunks: documentChunks,
  };
}

export const parsingService = {
  chunkText,
  parseDocument,
  extractImageText,
};
