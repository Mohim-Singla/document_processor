import { authService } from '../service/authService.js';
import { logger } from '../utils/logger.js';
import { HTTP_STATUS, ERROR_CODES } from '../utils/constant/index.js';

const CONTEXT = 'authController';

export async function signup(req, res) {
  const SUB_CONTEXT = signup.name;
  try {
    const { name, email, password } = req.body;
    logger.info('Processing user signup', CONTEXT, SUB_CONTEXT, { email, name });
    const result = await authService.signup({ name, email, password });
    logger.info('User signup successful', CONTEXT, SUB_CONTEXT, { userId: result.user.userId, email });
    return res.success('User registered successfully', result, 201);
  } catch (error) {
    logger.error('Signup error', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error(error.message, ERROR_CODES.SIGNUP_ERROR, HTTP_STATUS.BAD_REQUEST);
  }
}

export async function login(req, res) {
  const SUB_CONTEXT = login.name;
  try {
    const { email, password } = req.body;
    logger.info('Processing user login', CONTEXT, SUB_CONTEXT, { email });
    const result = await authService.login({ email, password });
    logger.info('User login successful', CONTEXT, SUB_CONTEXT, { userId: result.user.userId, email });
    return res.success('Login successful', result, HTTP_STATUS.OK);
  } catch (error) {
    logger.warn('Login failure', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error(error.message, ERROR_CODES.LOGIN_ERROR, HTTP_STATUS.UNAUTHORIZED);
  }
}

export async function getCurrentUser(req, res) {
  const SUB_CONTEXT = getCurrentUser.name;
  try {
    logger.info('Retrieving current user profile', CONTEXT, SUB_CONTEXT, { userId: req.user?.userId });
    return res.success('Current user profile', { user: req.user }, HTTP_STATUS.OK);
  } catch (error) {
    logger.error('Error fetching current user profile', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error(error.message, ERROR_CODES.PROFILE_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export const authController = {
  signup,
  login,
  getCurrentUser,
};
