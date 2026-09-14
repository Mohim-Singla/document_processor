import PDFParser from 'pdf2json';
import mammoth from 'mammoth';
import { v4 as uuidv4 } from 'uuid';

/**
 * Safely decodes text from pdf2json without crashing on malformed URI sequences
 */
function safeDecodeText(str) {
  if (!str) return '';
  try {
    return decodeURIComponent(str);
  } catch {
    try {
      // Replace isolated '%' not followed by two hex digits
      return decodeURIComponent(str.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'));
    } catch {
      // Unescape or return raw string if un-decodable
      return unescape(str);
    }
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
  let pages = [];
  let totalPageCount = 1;

  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    const parsed = await extractPdfText(buffer);
    totalPageCount = parsed.pageCount;
    pages = parsed.pages;
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer });
    pages.push({ pageNumber: 1, text: result.value });
  } else {
    // Plain text or fallback
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

  return {
    pageCount: totalPageCount,
    chunks: documentChunks,
  };
}

export const parsingService = {
  parseDocument,
  chunkText,
};
