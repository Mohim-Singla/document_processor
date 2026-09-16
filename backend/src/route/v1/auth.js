import express from 'express';
import { authController } from '../../controller/index.js';
import { authenticateToken } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/requestValidator.js';
import { authSchema } from '../../apiValidations/auth.js';

const router = new express.Router();

// Public Auth Endpoints
router.post('/signup', validateRequest(authSchema.signup.body), authController.signup);
router.post('/login', validateRequest(authSchema.login.body), authController.login);

// Protected User Profile
router.get('/me', authenticateToken, authController.getCurrentUser);

export const authRouter = router;
