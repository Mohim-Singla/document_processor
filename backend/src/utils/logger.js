/**
 * Application Logger Module
 * Log levels: info, debug, error, warn, critical
 * Format: [ISO Timestamp] [LEVEL] [Context > SubContext] Message | Body: {...}
 *
 * Parameters:
 * @param {string} level - Log level (default: 'INFO')
 * @param {string} message - Log message (default: '')
 * @param {string} context - File / Class / Module reference (default: '')
 * @param {string} subContext - Function / Handler reference (default: '')
 * @param {Object|any} [body] - Optional JSON object / metadata payload (default: {})
 */

function formatLog(level = 'INFO', message = '', context = '', subContext = '', body = {}) {
  const timestamp = new Date().toISOString();
  const location = `${context} > ${subContext}`;
  let logOutput = `[${timestamp}] [${level.toUpperCase()}] [${location}] ${message}`;

  if (body !== undefined && body !== null) {
    try {
      const stringifiedBody = typeof body === 'object' ? JSON.stringify(body) : String(body);
      logOutput += ` | Body: ${stringifiedBody}`;
    } catch {
      logOutput += ' | Body: [Unserializable Object]';
    }
  }

  return logOutput;
}

export const logger = {
  info(message, context, subContext, body) {
    console.info(formatLog('INFO', message, context, subContext, body));
  },

  debug(message, context, subContext, body) {
    console.debug(formatLog('DEBUG', message, context, subContext, body));
  },

  warn(message, context, subContext, body) {
    console.warn(formatLog('WARN', message, context, subContext, body));
  },

  error(message, context, subContext, body) {
    console.error(formatLog('ERROR', message, context, subContext, body));
  },

  critical(message, context, subContext, body) {
    console.error(formatLog('CRITICAL', message, context, subContext, body));
  },
};

export { formatLog };
export default logger;
