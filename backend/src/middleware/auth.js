import { authService } from '../service/authService.js';
import { mongoRepositories } from '../db/mongo/repository/index.js';
import { logger } from '../utils/logger.js';

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
      return res.error('Access denied. No Bearer token provided.', 'UNAUTHORIZED', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      logger.warn('Token empty in Bearer header', CONTEXT, SUB_CONTEXT);
      return res.error('Access denied. Token missing.', 'UNAUTHORIZED', 401);
    }

    const decoded = authService.verifyToken(token);
    if (!decoded || !decoded.userId) {
      logger.warn('Invalid token payload', CONTEXT, SUB_CONTEXT);
      return res.error('Invalid token payload.', 'INVALID_TOKEN', 401);
    }

    // Verify that the user actually exists in the database and is enabled
    const user = await mongoRepositories.users.fetchOne({ userId: decoded.userId });
    if (!user) {
      logger.warn('Token refers to non-existent user in DB', CONTEXT, SUB_CONTEXT, { userId: decoded.userId });
      return res.error('User account does not exist or has been removed.', 'UNAUTHORIZED', 401);
    }

    if (user.isEnabled === false) {
      logger.warn('Token refers to disabled user', CONTEXT, SUB_CONTEXT, { userId: decoded.userId });
      return res.error('This user account is disabled.', 'FORBIDDEN', 403);
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
      return res.error('Token expired. Please login again.', 'TOKEN_EXPIRED', 401);
    }
    logger.warn('Token verification failed', CONTEXT, SUB_CONTEXT, { error: err.message });
    return res.error('Invalid token.', 'INVALID_TOKEN', 401);
  }
}
