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
let submissionService: SubmissionService;

// Initialize service lazily
function getSubmissionService(): SubmissionService {
  if (!submissionService) {
    submissionService = new SubmissionService();
  }
  return submissionService;
}

// Create submission (user-facing)
router.post(
  '/submissions',
  authenticateUser,
  rateLimitSubmissions,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const input = SubmissionSchema.parse(req.body);
      const result = await getSubmissionService().createSubmission(req.user!.uid, input);
      
      res.status(201).json({
        ...result,
        estimatedReviewTime: '24-48 hours',
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Invalid submission data', details: error.errors });
        return;
      }
      console.error('[Route] Create submission error:', error);
      console.error('[Route] Error stack:', error.stack);
      console.error('[Route] Error details:', JSON.stringify(error, null, 2));
      res.status(500).json({ 
        error: 'Failed to create submission',
        details: error.message || 'Unknown error'
      });
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
      const result = await getSubmissionService().getUserSubmissions(
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
      const success = await getSubmissionService().withdrawSubmission(
        req.params.id,
        req.user!.uid
      );
      
      if (!success) {
        res.status(404).json({ error: 'Submission not found or not owned by user' });
        return;
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
      const queue = await getSubmissionService().getModerationQueue(
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
      const entryId = await getSubmissionService().approveSubmission(
        req.params.id,
        req.user!.uid,
        input.collectionId,
        input.trendScore
      );
      
      res.json({ entryId, approved: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Invalid approval data', details: error.errors });
        return;
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
      const success = await getSubmissionService().rejectSubmission(
        req.params.id,
        req.user!.uid,
        input.reason
      );
      
      if (!success) {
        res.status(404).json({ error: 'Submission not found' });
        return;
      }
      
      res.json({ rejected: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Invalid rejection data', details: error.errors });
        return;
      }
      console.error('[Route] Reject submission error:', error);
      res.status(500).json({ error: 'Failed to reject submission' });
    }
  }
);

export default router;
