import { z } from 'zod';

// Submission validation
export const SubmissionSchema = z.object({
  type: z.enum(['design', 'technique', 'product', 'tutorial', 'tip']),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000).optional(),
  mediaUrls: z.array(z.string().url()).min(1).max(10),
  tags: z.array(z.string()).max(20),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  priceRange: z.enum(['budget', 'mid', 'premium']).optional(),
  materials: z.array(z.string()).max(30).optional(),
});

export type SubmissionInput = z.infer<typeof SubmissionSchema>;

// Query validation
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const SubmissionFilterSchema = PaginationSchema.extend({
  status: z.enum(['pending', 'approved', 'rejected', 'flagged']).optional(),
});

// Moderation action validation
export const ApprovalSchema = z.object({
  collectionId: z.string().min(1),
  trendScore: z.number().min(0).max(1).optional(),
});

export const RejectionSchema = z.object({
  reason: z.string().min(10).max(500),
});

// Engagement tracking
export const EngagementSchema = z.object({
  entryId: z.string().min(1),
  action: z.enum(['view', 'save', 'share', 'book']),
  duration: z.number().int().min(0).optional(), // seconds spent viewing
});

// External connection
export const ExternalConnectionSchema = z.object({
  authCode: z.string().min(1),
  platform: z.enum(['instagram', 'tiktok']),
});
