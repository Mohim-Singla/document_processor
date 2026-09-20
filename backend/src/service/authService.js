import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { mongoRepositories } from '../db/mongo/repository/index.js';
import { AUTH_CONFIG } from '../utils/constant/index.js';
import { logger } from '../utils/logger.js';

const CONTEXT = 'authService';
const JWT_SECRET = process.env.JWT_SECRET || AUTH_CONFIG.DEFAULT_JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || AUTH_CONFIG.DEFAULT_JWT_EXPIRES_IN;

/**
 * Signs a JWT token for a user
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verifies a JWT token
 */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Registers a new user
 */
export async function signup({ name, email, password }) {
  const SUB_CONTEXT = signup.name;
  logger.info('Attempting user registration', CONTEXT, SUB_CONTEXT, { email });

  const existingUser = await mongoRepositories.users.fetchOne({
    email: email.toLowerCase().trim(),
  });

  if (existingUser) {
    logger.warn('User already exists with email', CONTEXT, SUB_CONTEXT, { email });
    throw new Error('User with this email already exists.');
  }

  const salt = await bcrypt.genSalt(AUTH_CONFIG.BCRYPT_SALT_ROUNDS);
  const hashedPassword = await bcrypt.hash(password, salt);
  const userId = uuidv4();

  const user = await mongoRepositories.users.create({
    userId,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    isEnabled: true,
  });

  logger.info('User created in MongoDB', CONTEXT, SUB_CONTEXT, { userId, email });

  const token = generateToken({
    userId: user.userId,
    email: user.email,
    name: user.name,
  });

  return {
    user: {
      userId: user.userId,
      name: user.name,
      email: user.email,
    },
    token,
  };
}

/**
 * Authenticates user credentials and returns JWT
 */
export async function login({ email, password }) {
  const SUB_CONTEXT = login.name;
  logger.info('Attempting user login authentication', CONTEXT, SUB_CONTEXT, { email });

  const user = await mongoRepositories.users.fetchOne({
    email: email.toLowerCase().trim(),
  });

  if (!user) {
    logger.warn('User not found during login', CONTEXT, SUB_CONTEXT, { email });
    throw new Error('Invalid email or password.');
  }

  if (user.isEnabled === false) {
    logger.warn('Disabled user attempted to login', CONTEXT, SUB_CONTEXT, { email, userId: user.userId });
    throw new Error('This user account is disabled.');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    logger.warn('Password mismatch during login', CONTEXT, SUB_CONTEXT, { email });
    throw new Error('Invalid email or password.');
  }

  logger.info('User authenticated successfully', CONTEXT, SUB_CONTEXT, { userId: user.userId });

  const token = generateToken({
    userId: user.userId,
    email: user.email,
    name: user.name,
  });

  return {
    user: {
      userId: user.userId,
      name: user.name,
      email: user.email,
    },
    token,
  };
}

export const authService = {
  signup,
  login,
  generateToken,
  verifyToken,
};
