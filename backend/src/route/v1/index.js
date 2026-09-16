import express from 'express';
import { authRouter } from './auth.js';
import { sessionsRouter } from './sessions.js';

const router = new express.Router();

router.use('/auth', authRouter);
router.use('/sessions', sessionsRouter);

export const v1 = router;
