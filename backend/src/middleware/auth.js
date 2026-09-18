import { authService } from '../service/authService.js';
import { mongoRepositories } from '../db/mongo/repository/index.js';
import { logger } from '../utils/logger.js';
import { HTTP_STATUS, ERROR_CODES } from '../utils/constant/index.js';

const CONTEXT = 'authMiddleware';

/**
 * Middleware to validate Bearer JWT token from Authorization header
 * and verify that the user exists and is enabled in the database.
 * Attaches verified user payload to req.user.
 */
export async function authenticateToken(req, res, next) {
  const SUB_CONTEXT = authenticateToken.name;
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Auth token missing or invalid format', CONTEXT, SUB_CONTEXT, { url: req.originalUrl, method: req.method });
      return res.error('Access denied. No Bearer token provided.', ERROR_CODES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      logger.warn('Token empty in Bearer header', CONTEXT, SUB_CONTEXT);
      return res.error('Access denied. Token missing.', ERROR_CODES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
    }

    const decoded = authService.verifyToken(token);
    if (!decoded || !decoded.userId) {
      logger.warn('Invalid token payload', CONTEXT, SUB_CONTEXT);
      return res.error('Invalid token payload.', ERROR_CODES.INVALID_TOKEN, HTTP_STATUS.UNAUTHORIZED);
    }

    // Verify that the user actually exists in the database and is enabled
    const user = await mongoRepositories.users.fetchOne({ userId: decoded.userId });
    if (!user) {
      logger.warn('Token refers to non-existent user in DB', CONTEXT, SUB_CONTEXT, { userId: decoded.userId });
      return res.error('User account does not exist or has been removed.', ERROR_CODES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
    }

    if (user.isEnabled === false) {
      logger.warn('Token refers to disabled user', CONTEXT, SUB_CONTEXT, { userId: decoded.userId });
      return res.error('This user account is disabled.', ERROR_CODES.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    }

    req.user = {
      userId: user.userId,
      email: user.email,
      name: user.name,
    };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.warn('Token expired', CONTEXT, SUB_CONTEXT);
      return res.error('Token expired. Please login again.', ERROR_CODES.TOKEN_EXPIRED, HTTP_STATUS.UNAUTHORIZED);
    }
    logger.warn('Token verification failed', CONTEXT, SUB_CONTEXT, { error: err.message });
    return res.error('Invalid token.', ERROR_CODES.INVALID_TOKEN, HTTP_STATUS.UNAUTHORIZED);
  }
}
