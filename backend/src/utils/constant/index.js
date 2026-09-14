import { ALLOWED_MIME_TYPES, ALLOWED_FILE_EXTENSIONS } from './fileTypes.js';
import { QUEUES } from './queues.js';

export const constant = {
  ENVS: {
    LOCAL: 'local',
    DEV: 'development',
    PROD: 'production',
  },
  ALLOWED_MIME_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  QUEUES,
};

export { ALLOWED_MIME_TYPES, ALLOWED_FILE_EXTENSIONS, QUEUES };
