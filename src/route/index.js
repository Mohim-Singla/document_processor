import express from 'express';
import { v1 } from './v1/index.js';

const router = new express.Router();

router.use('/v1', v1);

export const routeMap = router;
