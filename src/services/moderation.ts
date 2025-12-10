import vision from '@google-cloud/vision';
import { getFirestore } from '../lib/firebase.js';

const client = new vision.ImageAnnotatorClient();

// Cost tracking constants
const VISION_API_COST_PER_IMAGE = parseFloat(process.env.VISION_API_COST_PER_IMAGE || '0.0015');
const VISION_API_COST_PER_LABEL = parseFloat(process.env.VISION_API_COST_PER_LABEL || '0.0015');
const COST_ALERT_THRESHOLD = parseFloat(process.env.VISION_API_ALERT_THRESHOLD || '100');

// Nail-related keywords for content relevance detection
const NAIL_RELATED_LABELS = [
  'nail', 'nails', 'manicure', 'pedicure', 'nail art', 'nail polish',
  'fingernail', 'toenail', 'nail salon', 'nail design', 'acrylic nail',
  'gel nail', 'nail extension', 'nail tip', 'cuticle', 'nail bed',
  'french manicure', 'nail technician', 'nail care', 'nail treatment',
  'hand', 'finger', 'cosmetics', 'beauty', 'spa', 'beauty salon',
  'nail lacquer', 'nail color', 'nail file', 'nail brush', 'nail lamp',
  'press on nails', 'dip powder', 'shellac', 'nail wrap', 'nail sticker',
  'rhinestone', 'glitter', 'nail gem', 'nail charm', 'ombre nails',
  'chrome nails', 'matte nails', 'glossy', 'stiletto nails', 'coffin nails',
  'almond nails', 'square nails', 'oval nails', 'nail shape',
];

// Beauty product related labels (allowed as nail-adjacent content)
const BEAUTY_PRODUCT_LABELS = [
  'cosmetic', 'beauty product', 'makeup', 'skincare', 'lotion',
  'cream', 'bottle', 'container', 'beauty', 'salon', 'spa',
];

export interface ModerationResult {
  safe: boolean;
  spam: number; // 0-1 confidence
  inappropriate: number; // 0-1 confidence
  reasons: string[];
  metadata?: {
    imagesProcessed: number;
    estimatedCost: number;
    processingTime: number;
  };
}

export interface EnhancedModerationResult extends ModerationResult {
  nailRelated: boolean;
  nailRelevanceScore: number;
  detectedLabels: string[];
}

export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  try {
    console.log('[Moderation] Analyzing image:', imageUrl);
    const [result] = await client.safeSearchDetection(imageUrl);
    const safeSearch = result.safeSearchAnnotation;

    if (!safeSearch) {
      console.warn('[Moderation] No safe search annotation returned');
      return {
        safe: false,
        spam: 0,
        inappropriate: 1,
        reasons: ['Unable to analyze image'],
      };
    }

    const likelihood = (level: string | null | undefined): number => {
      const map: Record<string, number> = {
        'VERY_UNLIKELY': 0,
        'UNLIKELY': 0.2,
        'POSSIBLE': 0.5,
        'LIKELY': 0.8,
        'VERY_LIKELY': 1,
      };
      return map[level || 'UNKNOWN'] || 0.5;
    };

    const adult = likelihood(String(safeSearch.adult || 'UNKNOWN'));
    const violence = likelihood(String(safeSearch.violence || 'UNKNOWN'));
    const racy = likelihood(String(safeSearch.racy || 'UNKNOWN'));

    const inappropriate = Math.max(adult, violence, racy);
    const reasons: string[] = [];

    if (adult > 0.6) reasons.push('Adult content');
    if (violence > 0.6) reasons.push('Violence');
    if (racy > 0.6) reasons.push('Racy content');

    return {
      safe: inappropriate < 0.5,
      spam: 0, // Implement spam detection separately
      inappropriate,
      reasons,
    };
  } catch (error) {
    console.error('[Moderation] Error analyzing image:', imageUrl, error);
    console.error('[Moderation] Error stack:', error instanceof Error ? error.stack : 'No stack');
    // Return safe=true to allow submission even if moderation fails
    return {
      safe: true,
      spam: 0,
      inappropriate: 0,
      reasons: ['Moderation service temporarily unavailable'],
    };
  }
}

/**
 * Check if an image contains nail-related content using label detection
 */
export async function checkNailRelevance(imageUrl: string): Promise<{
  isNailRelated: boolean;
  relevanceScore: number;
  detectedLabels: string[];
  reasons: string[];
}> {
  try {
    console.log('[Moderation] Checking nail relevance for:', imageUrl);
    const [result] = await client.labelDetection(imageUrl);
    const labels = result.labelAnnotations || [];

    const detectedLabels = labels.map(l => l.description?.toLowerCase() || '');
    const labelScores = labels.map(l => ({
      label: l.description?.toLowerCase() || '',
      score: l.score || 0,
    }));

    // Check for nail-related labels
    let nailScore = 0;
    let beautyScore = 0;
    const matchedNailLabels: string[] = [];
    const matchedBeautyLabels: string[] = [];

    for (const { label, score } of labelScores) {
      // Check nail-specific labels
      for (const nailLabel of NAIL_RELATED_LABELS) {
        if (label.includes(nailLabel) || nailLabel.includes(label)) {
          nailScore = Math.max(nailScore, score);
          matchedNailLabels.push(label);
        }
      }
      // Check beauty product labels (secondary relevance)
      for (const beautyLabel of BEAUTY_PRODUCT_LABELS) {
        if (label.includes(beautyLabel) || beautyLabel.includes(label)) {
          beautyScore = Math.max(beautyScore, score * 0.7); // Lower weight for generic beauty
          matchedBeautyLabels.push(label);
        }
      }
    }

    // Combined relevance score (nail labels weighted higher)
    const relevanceScore = Math.min(1, nailScore + (beautyScore * 0.3));
    const isNailRelated = relevanceScore >= 0.3; // 30% threshold

    const reasons: string[] = [];
    if (!isNailRelated) {
      reasons.push('Content does not appear to be nail-related');
      if (detectedLabels.length > 0) {
        reasons.push(`Detected: ${detectedLabels.slice(0, 5).join(', ')}`);
      }
    }

    console.log(`[Moderation] Nail relevance: ${relevanceScore.toFixed(2)}, matched: ${matchedNailLabels.join(', ')}`);

    return {
      isNailRelated,
      relevanceScore,
      detectedLabels: detectedLabels.slice(0, 10),
      reasons,
    };
  } catch (error) {
    console.error('[Moderation] Error checking nail relevance:', error);
    // On error, allow the content (fail open)
    return {
      isNailRelated: true,
      relevanceScore: 0.5,
      detectedLabels: [],
      reasons: ['Relevance check temporarily unavailable'],
    };
  }
}

/**
 * Enhanced moderation that checks both safety AND nail relevance
 */
export async function moderateImageEnhanced(imageUrl: string): Promise<EnhancedModerationResult> {
  const [safetyResult, relevanceResult] = await Promise.all([
    moderateImage(imageUrl),
    checkNailRelevance(imageUrl),
  ]);

  const allReasons = [...safetyResult.reasons, ...relevanceResult.reasons];
  
  // Content is safe only if it passes safety check AND is nail-related
  const safe = safetyResult.safe && relevanceResult.isNailRelated;

  return {
    ...safetyResult,
    safe,
    nailRelated: relevanceResult.isNailRelated,
    nailRelevanceScore: relevanceResult.relevanceScore,
    detectedLabels: relevanceResult.detectedLabels,
    reasons: allReasons,
  };
}

/**
 * Enhanced submission moderation with nail relevance checking
 */
export async function moderateSubmissionEnhanced(
  userId: string,
  mediaUrls: string[],
  checkRelevance = true
): Promise<EnhancedModerationResult> {
  const startTime = Date.now();
  
  // Check for spam (rapid submissions)
  const recentCount = await checkRecentSubmissionCount(userId);
  const spamScore = Math.min(recentCount / 10, 1);

  // Moderate all images with enhanced checks
  const imageResults = await Promise.all(
    mediaUrls.map(url => checkRelevance ? moderateImageEnhanced(url) : moderateImage(url).then(r => ({
      ...r,
      nailRelated: true,
      nailRelevanceScore: 1,
      detectedLabels: [],
    })))
  );

  const maxInappropriate = Math.max(...imageResults.map(r => r.inappropriate));
  const minNailRelevance = Math.min(...imageResults.map(r => r.nailRelevanceScore));
  const allNailRelated = imageResults.every(r => r.nailRelated);
  const allReasons = imageResults.flatMap(r => r.reasons);
  const allLabels = [...new Set(imageResults.flatMap(r => r.detectedLabels))];

  if (spamScore > 0.7) {
    allReasons.push('Rapid submission pattern detected');
  }

  const processingTime = Date.now() - startTime;
  // Cost: SafeSearch + Label detection per image
  const estimatedCost = mediaUrls.length * (VISION_API_COST_PER_IMAGE + (checkRelevance ? VISION_API_COST_PER_LABEL : 0));

  await trackModerationCost(userId, mediaUrls.length, estimatedCost);

  const safe = maxInappropriate < 0.5 && spamScore < 0.7 && allNailRelated;

  return {
    safe,
    spam: spamScore,
    inappropriate: maxInappropriate,
    nailRelated: allNailRelated,
    nailRelevanceScore: minNailRelevance,
    detectedLabels: allLabels.slice(0, 20),
    reasons: [...new Set(allReasons)],
    metadata: {
      imagesProcessed: mediaUrls.length,
      estimatedCost,
      processingTime,
    },
  };
}

export async function moderateSubmission(
  userId: string,
  mediaUrls: string[]
): Promise<ModerationResult> {
  const startTime = Date.now();
  
  // Check for spam (rapid submissions)
  const recentCount = await checkRecentSubmissionCount(userId);
  const spamScore = Math.min(recentCount / 10, 1); // Flag if >10 in last hour

  // Moderate all images
  const imageResults = await Promise.all(
    mediaUrls.map(url => moderateImage(url))
  );

  const maxInappropriate = Math.max(...imageResults.map(r => r.inappropriate));
  const allReasons = imageResults.flatMap(r => r.reasons);

  if (spamScore > 0.7) {
    allReasons.push('Rapid submission pattern detected');
  }

  const processingTime = Date.now() - startTime;
  const estimatedCost = mediaUrls.length * VISION_API_COST_PER_IMAGE;

  // Log cost tracking
  await trackModerationCost(userId, mediaUrls.length, estimatedCost);

  return {
    safe: maxInappropriate < 0.5 && spamScore < 0.7,
    spam: spamScore,
    inappropriate: maxInappropriate,
    reasons: [...new Set(allReasons)],
    metadata: {
      imagesProcessed: mediaUrls.length,
      estimatedCost,
      processingTime,
    },
  };
}

async function checkRecentSubmissionCount(userId: string): Promise<number> {
  const db = getFirestore();
  const oneHourAgo = new Date(Date.now() - 3600 * 1000);

  const snapshot = await db
    .collection('explore_submissions')
    .where('userId', '==', userId)
    .where('submittedAt', '>', oneHourAgo)
    .count()
    .get();

  return snapshot.data().count;
}

/**
 * Track Vision API usage and costs in Firestore
 */
async function trackModerationCost(
  userId: string,
  imageCount: number,
  estimatedCost: number
): Promise<void> {
  try {
    const db = getFirestore();
    await db.collection('moderation_metrics').add({
      userId,
      imageCount,
      estimatedCost,
      timestamp: new Date(),
      apiService: 'vision',
    });

    // Check monthly total and alert if over threshold
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const snapshot = await db.collection('moderation_metrics')
      .where('timestamp', '>=', thisMonth)
      .get();

    const monthlyTotal = snapshot.docs.reduce((sum, doc) => 
      sum + (doc.data().estimatedCost || 0), 0
    );

    if (monthlyTotal > COST_ALERT_THRESHOLD) {
      console.warn(
        `[Moderation] Monthly Vision API cost ($${monthlyTotal.toFixed(2)}) ` +
        `exceeds threshold ($${COST_ALERT_THRESHOLD})`
      );
      // TODO: Send alert email/notification
    }

    console.log(
      `[Moderation] Processed ${imageCount} images for $${estimatedCost.toFixed(4)} ` +
      `(Monthly total: $${monthlyTotal.toFixed(2)})`
    );
  } catch (error) {
    console.error('[Moderation] Failed to track cost:', error);
    // Don't fail the request if tracking fails
  }
}

/**
 * Get Vision API cost statistics for admin dashboard
 */
export async function getModerationStats(startDate?: Date, endDate?: Date) {
  const db = getFirestore();
  let query = db.collection('moderation_metrics').orderBy('timestamp', 'desc');

  if (startDate) {
    query = query.where('timestamp', '>=', startDate);
  }
  if (endDate) {
    query = query.where('timestamp', '<=', endDate);
  }

  const snapshot = await query.limit(1000).get();
  
  const stats = {
    totalImages: 0,
    totalCost: 0,
    averageCostPerImage: 0,
    requestCount: snapshot.size,
    byDay: {} as Record<string, { images: number; cost: number }>,
  };

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    stats.totalImages += data.imageCount || 0;
    stats.totalCost += data.estimatedCost || 0;

    // Group by day
    const date = data.timestamp.toDate().toISOString().split('T')[0];
    if (!stats.byDay[date]) {
      stats.byDay[date] = { images: 0, cost: 0 };
    }
    stats.byDay[date].images += data.imageCount || 0;
    stats.byDay[date].cost += data.estimatedCost || 0;
  });

  stats.averageCostPerImage = stats.totalImages > 0 
    ? stats.totalCost / stats.totalImages 
    : 0;

  return stats;
}
