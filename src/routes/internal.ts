import { Router, Request, Response } from 'express';
import { moderateSubmission, moderateImage } from '../services/moderation.js';

const router = Router();

/**
 * Internal API for moderation service - used by other backend services
 * No auth required as this should only be called internally
 */

/**
 * POST /api/internal/moderate
 * Run Vision API SafeSearch moderation on media URLs
 * Body: { userId: string, mediaUrls: string[] }
 */
router.post('/moderate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, mediaUrls } = req.body;

    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'userId is required and must be a string' });
      return;
    }

    if (!Array.isArray(mediaUrls) || mediaUrls.length === 0) {
      res.status(400).json({ error: 'mediaUrls array is required and must not be empty' });
      return;
    }

    // Validate all URLs are strings
    if (!mediaUrls.every(url => typeof url === 'string')) {
      res.status(400).json({ error: 'All mediaUrls must be strings' });
      return;
    }

    console.log(`[Internal] Moderating ${mediaUrls.length} media URLs for user ${userId}`);

    const result = await moderateSubmission(userId, mediaUrls);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('[Internal] Error in moderation:', error);
    res.status(500).json({
      error: 'Moderation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/internal/moderate-single
 * Run Vision API SafeSearch moderation on a single image URL
 * Body: { imageUrl: string }
 */
router.post('/moderate-single', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      res.status(400).json({ error: 'imageUrl is required and must be a string' });
      return;
    }

    console.log(`[Internal] Moderating single image: ${imageUrl}`);

    const result = await moderateImage(imageUrl);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('[Internal] Error in single image moderation:', error);
    res.status(500).json({
      error: 'Moderation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
