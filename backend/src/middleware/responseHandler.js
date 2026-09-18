import { HTTP_STATUS } from '../utils/constant/index.js';

/**
 * Wrapper function to handle successful express requests
 * @param {string} message Message to be sent to client
 * @param {object} response Response object to be sent to client
 * @param {number} statusCode Status code of the http request
 * @returns {Express.Response}
 */
function successHandler(message, response, statusCode = HTTP_STATUS.OK) {
  return this.status(statusCode).send({
    status: 'Success',
    message,
    statusCode,
    response,
  });
}

/**
 * Wrapper function to handle errored express requests
 * @param {string} message Message to be sent to client
 * @param {string | object} error
 * @param {number} statusCode Status code of the http request
 * @param {number} errorCode Error code
 * @returns {Express.Response}
 */
function errorHandler(message, error, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, errorCode = HTTP_STATUS.INTERNAL_SERVER_ERROR) {
  return this.status(statusCode).send({
    status: 'Success',
    message,
    errorCode,
    error,
  });
}

/**
 * Wrapper around incomming Express req/res
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Express.Next} next
 */
export const responseHandler = (req, res, next) => {
  res.success = successHandler;
  res.error = errorHandler;
  next();
};
