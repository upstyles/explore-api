import { Router, Request, Response } from 'express';
import { moderateSubmission, moderateImage, moderateSubmissionEnhanced, moderateImageEnhanced, checkNailRelevance } from '../services/moderation.js';

const router = Router();

/**
 * Internal API for moderation service - used by other backend services
 * No auth required as this should only be called internally
 */

/**
 * POST /api/internal/moderate
 * Run Vision API moderation on media URLs
 * Body: { userId: string, mediaUrls: string[], checkRelevance?: boolean }
 * checkRelevance: if true, also checks if content is nail-related (default: false for backward compat)
 */
router.post('/moderate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, mediaUrls, checkRelevance = false } = req.body;

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

    console.log(`[Internal] Moderating ${mediaUrls.length} media URLs for user ${userId} (checkRelevance: ${checkRelevance})`);

    const result = checkRelevance 
      ? await moderateSubmissionEnhanced(userId, mediaUrls, true)
      : await moderateSubmission(userId, mediaUrls);

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
 * POST /api/internal/moderate-enhanced
 * Run enhanced Vision API moderation with nail relevance checking
 * Body: { userId: string, mediaUrls: string[] }
 */
router.post('/moderate-enhanced', async (req: Request, res: Response): Promise<void> => {
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

    if (!mediaUrls.every(url => typeof url === 'string')) {
      res.status(400).json({ error: 'All mediaUrls must be strings' });
      return;
    }

    console.log(`[Internal] Enhanced moderation for ${mediaUrls.length} media URLs`);

    const result = await moderateSubmissionEnhanced(userId, mediaUrls, true);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('[Internal] Error in enhanced moderation:', error);
    res.status(500).json({
      error: 'Enhanced moderation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/internal/moderate-single
 * Run Vision API moderation on a single image URL
 * Body: { imageUrl: string, checkRelevance?: boolean }
 */
router.post('/moderate-single', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageUrl, checkRelevance = false } = req.body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      res.status(400).json({ error: 'imageUrl is required and must be a string' });
      return;
    }

    console.log(`[Internal] Moderating single image: ${imageUrl} (checkRelevance: ${checkRelevance})`);

    const result = checkRelevance 
      ? await moderateImageEnhanced(imageUrl)
      : await moderateImage(imageUrl);

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

/**
 * POST /api/internal/check-relevance
 * Check if an image is nail-related (label detection only)
 * Body: { imageUrl: string }
 */
router.post('/check-relevance', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      res.status(400).json({ error: 'imageUrl is required and must be a string' });
      return;
    }

    console.log(`[Internal] Checking nail relevance: ${imageUrl}`);

    const result = await checkNailRelevance(imageUrl);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('[Internal] Error checking relevance:', error);
    res.status(500).json({
      error: 'Relevance check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
