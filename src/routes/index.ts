import { Router } from 'express';
import submissionsRouter from './submissions.js';
import adminRouter from './admin.js';
import internalRouter from './internal.js';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount routes
router.use('/explore', submissionsRouter);
router.use('/admin', adminRouter);
router.use('/internal', internalRouter);

export default router;
