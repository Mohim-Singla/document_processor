import { authService } from '../service/authService.js';
import { logger } from '../utils/logger.js';

const CONTEXT = 'authMiddleware';

/**
 * Middleware to validate Bearer JWT token from Authorization header.
 * Attaches decoded user payload to req.user.
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
    req.user = decoded;
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
