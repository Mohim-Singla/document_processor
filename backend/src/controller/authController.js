import { authService } from '../service/authService.js';
import { logger } from '../utils/logger.js';

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
    return res.error(error.message, 'SIGNUP_ERROR', 400);
  }
}

export async function login(req, res) {
  const SUB_CONTEXT = login.name;
  try {
    const { email, password } = req.body;
    logger.info('Processing user login', CONTEXT, SUB_CONTEXT, { email });
    const result = await authService.login({ email, password });
    logger.info('User login successful', CONTEXT, SUB_CONTEXT, { userId: result.user.userId, email });
    return res.success('Login successful', result, 200);
  } catch (error) {
    logger.warn('Login failure', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error(error.message, 'LOGIN_ERROR', 401);
  }
}

export async function getCurrentUser(req, res) {
  const SUB_CONTEXT = getCurrentUser.name;
  try {
    logger.info('Retrieving current user profile', CONTEXT, SUB_CONTEXT, { userId: req.user?.userId });
    return res.success('Current user profile', { user: req.user }, 200);
  } catch (error) {
    logger.error('Error fetching current user profile', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error(error.message, 'PROFILE_ERROR', 500);
  }
}

export const authController = {
  signup,
  login,
  getCurrentUser,
};
