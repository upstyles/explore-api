import { getFirestore, getStorage } from '../lib/firebase.js';
import { SubmissionInput } from '../lib/validation.js';
import { moderateSubmission, ModerationResult } from './moderation.js';
import admin from 'firebase-admin';

export interface Submission {
  id: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  type: string;
  title: string;
  description?: string;
  mediaUrls: string[];
  tags: string[];
  difficulty?: string;
  priceRange?: string;
  materials?: string[];
  moderationFlags: ModerationResult;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  approvedEntryId?: string;
}

export class SubmissionService {
  private db = getFirestore();
  private storage = getStorage();

  async createSubmission(
    userId: string,
    input: SubmissionInput
  ): Promise<{ submissionId: string; status: string }> {
    // Run moderation
    const moderationFlags = await moderateSubmission(userId, input.mediaUrls);

    // Determine initial status
    const status = moderationFlags.safe ? 'pending' : 'flagged';

    // Create submission document
    const submissionRef = this.db.collection('explore_submissions').doc();
    
    await submissionRef.set({
      userId,
      status,
      type: input.type,
      title: input.title,
      description: input.description || '',
      mediaUrls: input.mediaUrls,
      tags: input.tags.map(t => t.toLowerCase()),
      difficulty: input.difficulty || 'beginner',
      priceRange: input.priceRange || 'mid',
      materials: input.materials || [],
      moderationFlags: {
        spam: moderationFlags.spam,
        inappropriate: moderationFlags.inappropriate,
        aiGenerated: false, // TODO: Implement AI detection
      },
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
      approvedEntryId: null,
    });

    console.log(`[Submission] Created ${submissionRef.id} by ${userId} - status: ${status}`);

    return {
      submissionId: submissionRef.id,
      status,
    };
  }

  async getUserSubmissions(
    userId: string,
    status?: string,
    limit = 20,
    cursor?: string
  ): Promise<{ submissions: Submission[]; nextCursor?: string }> {
    let query = this.db
      .collection('explore_submissions')
      .where('userId', '==', userId)
      .orderBy('submittedAt', 'desc')
      .limit(limit + 1);

    if (status) {
      query = query.where('status', '==', status) as any;
    }

    if (cursor) {
      const cursorDoc = await this.db.collection('explore_submissions').doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc) as any;
      }
    }

    const snapshot = await query.get();
    const docs = snapshot.docs.slice(0, limit);
    const hasMore = snapshot.docs.length > limit;

    const submissions = docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      submittedAt: doc.data().submittedAt?.toDate(),
      reviewedAt: doc.data().reviewedAt?.toDate(),
    })) as Submission[];

    return {
      submissions,
      nextCursor: hasMore ? docs[docs.length - 1].id : undefined,
    };
  }

  async withdrawSubmission(submissionId: string, userId: string): Promise<boolean> {
    const docRef = this.db.collection('explore_submissions').doc(submissionId);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      return false;
    }

    await docRef.update({
      status: 'withdrawn',
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[Submission] Withdrawn ${submissionId} by ${userId}`);
    return true;
  }

  async approveSubmission(
    submissionId: string,
    reviewerId: string,
    collectionId: string,
    trendScore = 0.5
  ): Promise<string> {
    const submissionRef = this.db.collection('explore_submissions').doc(submissionId);
    const submissionDoc = await submissionRef.get();

    if (!submissionDoc.exists) {
      throw new Error('Submission not found');
    }

    const submission = submissionDoc.data();

    // Create entry in explore_collections
    const entryRef = this.db
      .collection('explore_collections')
      .doc(collectionId)
      .collection('entries')
      .doc();

    await entryRef.set({
      title: submission?.title,
      description: submission?.description || '',
      type: submission?.type,
      mediaUrl: submission?.mediaUrls[0], // Primary image
      thumbUrl: submission?.mediaUrls[0],
      tags: submission?.tags || [],
      difficulty: submission?.difficulty,
      priceRange: submission?.priceRange,
      materials: submission?.materials || [],
      trendScore,
      supportsBooking: false,
      source: 'user_submission',
      submitterId: submission?.userId,
      action: {
        kind: 'post',
        refPath: null,
      },
      metrics: {
        likes: 0,
        saves: 0,
        shares: 0,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      curatedBy: reviewerId,
    });

    // Update submission status
    await submissionRef.update({
      status: 'approved',
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: reviewerId,
      approvedEntryId: entryRef.id,
    });

    console.log(`[Submission] Approved ${submissionId} → entry ${entryRef.id}`);

    return entryRef.id;
  }

  async rejectSubmission(
    submissionId: string,
    reviewerId: string,
    reason: string
  ): Promise<boolean> {
    const submissionRef = this.db.collection('explore_submissions').doc(submissionId);
    const submissionDoc = await submissionRef.get();

    if (!submissionDoc.exists) {
      return false;
    }

    await submissionRef.update({
      status: 'rejected',
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: reviewerId,
      rejectionReason: reason,
    });

    console.log(`[Submission] Rejected ${submissionId}: ${reason}`);
    return true;
  }

  async getModerationQueue(
    filter?: string,
    limit = 50
  ): Promise<Submission[]> {
    let query = this.db
      .collection('explore_submissions')
      .orderBy('submittedAt', 'asc')
      .limit(limit);

    if (filter) {
      query = query.where('status', '==', filter) as any;
    } else {
      query = query.where('status', 'in', ['pending', 'flagged']) as any;
    }

    const snapshot = await query.get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      submittedAt: doc.data().submittedAt?.toDate(),
      reviewedAt: doc.data().reviewedAt?.toDate(),
    })) as Submission[];
  }
}
