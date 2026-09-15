import { ALLOWED_MIME_TYPES, ALLOWED_FILE_EXTENSIONS, UPLOAD_LIMITS } from './fileTypes.js';
import { QUEUES } from './queues.js';
import { SESSION_STATUS, DOCUMENT_STATUS, MESSAGE_SENDER } from './status.js';
import { CHUNKING_CONFIG } from './chunking.js';
import { RAG_CONFIG } from './rag.js';
import { GEMINI_CONFIG } from './gemini.js';
import { AWS_CONFIG } from './aws.js';
import { AUTH_CONFIG } from './auth.js';

export const constant = {
  ENVS: {
    LOCAL: 'local',
    DEV: 'development',
    PROD: 'production',
    TEST: 'test',
  },
  ALLOWED_MIME_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  UPLOAD_LIMITS,
  QUEUES,
  SESSION_STATUS,
  DOCUMENT_STATUS,
  MESSAGE_SENDER,
  CHUNKING_CONFIG,
  RAG_CONFIG,
  GEMINI_CONFIG,
  AWS_CONFIG,
  AUTH_CONFIG,
};

export {
  ALLOWED_MIME_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  UPLOAD_LIMITS,
  QUEUES,
  SESSION_STATUS,
  DOCUMENT_STATUS,
  MESSAGE_SENDER,
  CHUNKING_CONFIG,
  RAG_CONFIG,
  GEMINI_CONFIG,
  AWS_CONFIG,
  AUTH_CONFIG,
};

