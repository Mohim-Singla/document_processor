export const SSE_CONFIG = {
  HEADERS: {
    CONTENT_TYPE: 'text/event-stream',
    CACHE_CONTROL: 'no-cache',
    CONNECTION: 'keep-alive',
  },
  EVENT_TYPES: {
    TOKEN: 'token',
    CITATIONS: 'citations',
    ERROR: 'error',
  },
  DONE_MESSAGE: 'data: [DONE]\n\n',
};
