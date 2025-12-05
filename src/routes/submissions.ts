import { Router } from 'express';
import { authenticateUser, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { rateLimitSubmissions } from '../middleware/rate-limit.js';
import { SubmissionService } from '../services/submissions.js';
import {
  SubmissionSchema,
  SubmissionFilterSchema,
  ApprovalSchema,
  RejectionSchema,
} from '../lib/validation.js';

const router = Router();
const submissionService = new SubmissionService();

// Create submission (user-facing)
router.post(
  '/submissions',
  authenticateUser,
  rateLimitSubmissions,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const input = SubmissionSchema.parse(req.body);
      const result = await submissionService.createSubmission(req.user!.uid, input);
      
      res.status(201).json({
        ...result,
        estimatedReviewTime: '24-48 hours',
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid submission data', details: error.errors });
      }
      console.error('[Route] Create submission error:', error);
      res.status(500).json({ error: 'Failed to create submission' });
    }
  }
);

// Get my submissions
router.get(
  '/submissions/mine',
  authenticateUser,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const params = SubmissionFilterSchema.parse(req.query);
      const result = await submissionService.getUserSubmissions(
        req.user!.uid,
        params.status,
        params.limit,
        params.cursor
      );
      res.json(result);
    } catch (error: any) {
      console.error('[Route] Get submissions error:', error);
      res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  }
);

// Withdraw submission
router.post(
  '/submissions/:id/withdraw',
  authenticateUser,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const success = await submissionService.withdrawSubmission(
        req.params.id,
        req.user!.uid
      );
      
      if (!success) {
        return res.status(404).json({ error: 'Submission not found or not owned by user' });
      }
      
      res.json({ withdrawn: true });
    } catch (error: any) {
      console.error('[Route] Withdraw submission error:', error);
      res.status(500).json({ error: 'Failed to withdraw submission' });
    }
  }
);

// Get moderation queue (admin/moderator only)
router.get(
  '/moderation/queue',
  authenticateUser,
  requireRole('moderator'),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const { filter, limit } = req.query;
      const queue = await submissionService.getModerationQueue(
        filter as string | undefined,
        limit ? Number(limit) : 50
      );
      res.json({ queue });
    } catch (error: any) {
      console.error('[Route] Get moderation queue error:', error);
      res.status(500).json({ error: 'Failed to fetch moderation queue' });
    }
  }
);

// Approve submission (moderator only)
router.post(
  '/moderation/:id/approve',
  authenticateUser,
  requireRole('moderator'),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const input = ApprovalSchema.parse(req.body);
      const entryId = await submissionService.approveSubmission(
        req.params.id,
        req.user!.uid,
        input.collectionId,
        input.trendScore
      );
      
      res.json({ entryId, approved: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid approval data', details: error.errors });
      }
      console.error('[Route] Approve submission error:', error);
      res.status(500).json({ error: 'Failed to approve submission' });
    }
  }
);

// Reject submission (moderator only)
router.post(
  '/moderation/:id/reject',
  authenticateUser,
  requireRole('moderator'),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const input = RejectionSchema.parse(req.body);
      const success = await submissionService.rejectSubmission(
        req.params.id,
        req.user!.uid,
        input.reason
      );
      
      if (!success) {
        return res.status(404).json({ error: 'Submission not found' });
      }
      
      res.json({ rejected: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid rejection data', details: error.errors });
      }
      console.error('[Route] Reject submission error:', error);
      res.status(500).json({ error: 'Failed to reject submission' });
    }
  }
);

export default router;
