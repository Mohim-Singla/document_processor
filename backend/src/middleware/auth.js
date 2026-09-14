import { authService } from '../service/authService.js';

/**
 * Middleware to validate Bearer JWT token from Authorization header.
 * Attaches decoded user payload to req.user.
 */
export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.error('Access denied. No Bearer token provided.', 'UNAUTHORIZED', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.error('Access denied. Token missing.', 'UNAUTHORIZED', 401);
    }

    const decoded = authService.verifyToken(token);
    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.error('Token expired. Please login again.', 'TOKEN_EXPIRED', 401);
    }
    return res.error('Invalid token.', 'INVALID_TOKEN', 401);
  }
}
