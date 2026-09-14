import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { mysqlRepositories } from '../db/mysql/repository/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'document_processor_super_secret_jwt_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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
  const existingUser = await mysqlRepositories.users.fetchOne({
    where: { email: email.toLowerCase().trim() },
  });

  if (existingUser) {
    throw new Error('User with this email already exists.');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const userId = uuidv4();

  const user = await mysqlRepositories.users.create({
    userId,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    isEnabled: true,
  });

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
  const user = await mysqlRepositories.users.fetchOne({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    throw new Error('Invalid email or password.');
  }

  if (user.isEnabled === false) {
    throw new Error('This user account is disabled.');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error('Invalid email or password.');
  }

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
