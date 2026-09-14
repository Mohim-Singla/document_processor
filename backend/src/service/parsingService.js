import PDFParser from 'pdf2json';
import mammoth from 'mammoth';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

const CONTEXT = 'parsingService';

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

/**
 * Splits text into chunks with token overlap
 */
export function chunkText(text, { chunkSize = 1200, overlap = 200 } = {}) {
  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;
    if (endIndex >= text.length) {
      chunks.push(text.slice(startIndex).trim());
      break;
    }

    // Try to break cleanly on paragraph or sentence boundary
    const nextNewline = text.indexOf('\n\n', endIndex - 150);
    if (nextNewline !== -1 && nextNewline < endIndex + 100) {
      endIndex = nextNewline;
    } else {
      const nextPeriod = text.indexOf('. ', endIndex - 100);
      if (nextPeriod !== -1 && nextPeriod < endIndex + 50) {
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

  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    logger.info('Parsing PDF file with pdf2json', CONTEXT, SUB_CONTEXT, { fileName });
    const parsed = await extractPdfText(buffer);
    totalPageCount = parsed.pageCount;
    pages = parsed.pages;
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    logger.info('Parsing DOCX document with mammoth', CONTEXT, SUB_CONTEXT, { fileName });
    const result = await mammoth.extractRawText({ buffer });
    pages.push({ pageNumber: 1, text: result.value });
  } else {
    logger.info('Parsing plaintext or fallback document', CONTEXT, SUB_CONTEXT, { fileName });
    const text = buffer.toString('utf-8');
    pages.push({ pageNumber: 1, text });
  }

  const documentChunks = [];
  let chunkIndexCounter = 0;

  for (const page of pages) {
    const textChunks = chunkText(page.text);
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
    }
  }

  logger.info('Document parsing completed', CONTEXT, SUB_CONTEXT, {
    fileName,
    totalPageCount,
    totalChunks: documentChunks.length,
  });

  return {
    pageCount: totalPageCount,
    chunks: documentChunks,
  };
}

export const parsingService = {
  chunkText,
  parseDocument,
};
