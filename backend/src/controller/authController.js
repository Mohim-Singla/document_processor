import { authService } from '../service/authService.js';

export async function signup(req, res) {
  try {
    const { name, email, password } = req.body;
    const result = await authService.signup({ name, email, password });
    return res.success('User registered successfully', result, 201);
  } catch (error) {
    console.error('Signup error:', error.message);
    return res.error(error.message, 'SIGNUP_ERROR', 400);
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    return res.success('Login successful', result, 200);
  } catch (error) {
    console.error('Login error:', error.message);
    return res.error(error.message, 'LOGIN_ERROR', 401);
  }
}

export async function getCurrentUser(req, res) {
  try {
    return res.success('Current user profile', { user: req.user }, 200);
  } catch (error) {
    return res.error(error.message, 'PROFILE_ERROR', 500);
  }
}

export const authController = {
  signup,
  login,
  getCurrentUser,
};
