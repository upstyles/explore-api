import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';

// Daily submission limit per user
const submissionLimiter = new RateLimiterMemory({
  points: Number(process.env.RATE_LIMIT_SUBMISSIONS_DAILY) || 10,
  duration: 86400, // 24 hours
});

// General API rate limit
const apiLimiter = new RateLimiterMemory({
  points: Number(process.env.RATE_LIMIT_API_PER_MINUTE) || 60,
  duration: 60, // 1 minute
});

export async function rateLimitSubmissions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    await submissionLimiter.consume(req.user.uid);
    next();
  } catch (rejRes: any) {
    const retryAfter = Math.ceil(rejRes.msBeforeNext / 1000);
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'Daily submission limit reached',
      retryAfter,
    });
  }
}

export async function rateLimitAPI(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const key = req.ip || 'anonymous';

  try {
    await apiLimiter.consume(key);
    next();
  } catch (rejRes: any) {
    const retryAfter = Math.ceil(rejRes.msBeforeNext / 1000);
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter,
    });
  }
}
