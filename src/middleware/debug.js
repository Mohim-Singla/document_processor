import debug from 'debug';

const log = debug('app:request');

/**
 * Wrapper function to log every incomming client requests
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Express.Next} next
 */
export const debugLogger = (req, res, next) => {
  log(`METHOD: ${req.method} | URL: ${req.url} | Timestamp: ${Date.now()}`);
  next();
};
