import { ALLOWED_MIME_TYPES, ALLOWED_FILE_EXTENSIONS, UPLOAD_LIMITS } from './fileTypes.js';
import { QUEUES } from './queues.js';
import { SESSION_STATUS, DOCUMENT_STATUS, MESSAGE_SENDER } from './status.js';

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
};

export {
  ALLOWED_MIME_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  UPLOAD_LIMITS,
  QUEUES,
  SESSION_STATUS,
  DOCUMENT_STATUS,
  MESSAGE_SENDER,
};

