import { Router, Request, Response } from 'express';
import { verifyAuth } from '../middleware/auth.js';
import { getModerationStats } from '../services/moderation.js';

const router = Router();

/**
 * GET /api/admin/moderation/stats
 * Get Vision API usage statistics (admin only)
 */
router.get('/moderation/stats', verifyAuth, async (req: Request, res: Response) => {
  try {
    // Check if user has admin or moderator role
    const customClaims = req.user?.customClaims || {};
    if (!customClaims.admin && !customClaims.moderator) {
      return res.status(403).json({ error: 'Admin or moderator access required' });
    }

    // Parse date range from query params
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string) 
      : undefined;
    const endDate = req.query.endDate 
      ? new Date(req.query.endDate as string) 
      : undefined;

    const stats = await getModerationStats(startDate, endDate);

    res.json({
      success: true,
      stats,
      period: {
        start: startDate?.toISOString() || 'all time',
        end: endDate?.toISOString() || 'now',
      },
    });
  } catch (error) {
    console.error('[Admin] Error fetching moderation stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch moderation statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/moderation/monthly-cost
 * Get current month's Vision API cost
 */
router.get('/moderation/monthly-cost', verifyAuth, async (req: Request, res: Response) => {
  try {
    const customClaims = req.user?.customClaims || {};
    if (!customClaims.admin && !customClaims.moderator) {
      return res.status(403).json({ error: 'Admin or moderator access required' });
    }

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const stats = await getModerationStats(thisMonth);

    res.json({
      success: true,
      month: thisMonth.toISOString().substring(0, 7), // YYYY-MM
      totalCost: stats.totalCost,
      totalImages: stats.totalImages,
      requestCount: stats.requestCount,
      averageCostPerImage: stats.averageCostPerImage,
      costPerRequest: stats.requestCount > 0 ? stats.totalCost / stats.requestCount : 0,
    });
  } catch (error) {
    console.error('[Admin] Error fetching monthly cost:', error);
    res.status(500).json({ 
      error: 'Failed to fetch monthly cost',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
