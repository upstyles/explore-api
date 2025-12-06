import vision from '@google-cloud/vision';
import { getFirestore } from '../lib/firebase.js';

const client = new vision.ImageAnnotatorClient();

export interface ModerationResult {
  safe: boolean;
  spam: number; // 0-1 confidence
  inappropriate: number; // 0-1 confidence
  reasons: string[];
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

export async function moderateSubmission(
  userId: string,
  mediaUrls: string[]
): Promise<ModerationResult> {
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

  return {
    safe: maxInappropriate < 0.5 && spamScore < 0.7,
    spam: spamScore,
    inappropriate: maxInappropriate,
    reasons: [...new Set(allReasons)],
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
