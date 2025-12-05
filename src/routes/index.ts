import { Router } from 'express';
import submissionsRouter from './submissions.js';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount routes
router.use('/explore', submissionsRouter);

export default router;
