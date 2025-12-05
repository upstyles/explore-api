# Explore API

Backend service for UpStyles Explore feature supporting user submissions, external content integrations, and ML-powered recommendations.

## Features

### Phase 1: User Submissions ✅ (Current)
- User-generated content submission
- Automated content moderation (Vision API)
- Admin moderation queue
- Submission approval/rejection workflow

### Phase 2: External Integrations (Planned)
- Instagram content import
- TikTok content import
- OAuth connection management

### Phase 3: ML Recommendations (Planned)
- Personalized feed generation
- Trend score calculation
- User preference learning

## Architecture

```
explore-api/
├── src/
│   ├── index.ts              # Express server entry point
│   ├── routes/
│   │   ├── index.ts          # Route aggregation
│   │   └── submissions.ts    # Submission endpoints
│   ├── services/
│   │   ├── submissions.ts    # Business logic
│   │   └── moderation.ts     # Content moderation
│   ├── middleware/
│   │   ├── auth.ts           # Firebase Auth verification
│   │   └── rate-limit.ts     # Rate limiting
│   └── lib/
│       ├── firebase.ts       # Firebase initialization
│       └── validation.ts     # Zod schemas
└── package.json
```

## Getting Started

### Prerequisites
- Node.js 20+
- Firebase project with Firestore enabled
- Service account key (for local development)

### Installation

```bash
cd explore-api
npm install
```

### Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your Firebase project settings:
   ```env
   FIREBASE_PROJECT_ID=your-project-id
   GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
   PORT=8080
   ```

3. Download your Firebase service account key and save as `service-account-key.json`

### Development

```bash
npm run dev
```

Server will start on `http://localhost:8080`

### Build & Deploy

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## API Endpoints

### User Submissions

#### POST `/api/explore/submissions`
Create a new submission (requires auth, rate limited to 10/day)

**Headers:**
```
Authorization: Bearer <firebase-id-token>
```

**Body:**
```json
{
  "type": "design",
  "title": "Chrome Aura Nails",
  "description": "Step-by-step chrome finish tutorial",
  "mediaUrls": [
    "https://storage.googleapis.com/...",
    "https://storage.googleapis.com/..."
  ],
  "tags": ["chrome", "tutorial", "intermediate"],
  "difficulty": "intermediate",
  "priceRange": "mid",
  "materials": ["chrome powder", "gel base"]
}
```

**Response:**
```json
{
  "submissionId": "abc123",
  "status": "pending",
  "estimatedReviewTime": "24-48 hours"
}
```

#### GET `/api/explore/submissions/mine?status=pending&limit=20&cursor=xyz`
Get current user's submissions

**Response:**
```json
{
  "submissions": [
    {
      "id": "abc123",
      "status": "pending",
      "title": "Chrome Aura Nails",
      "submittedAt": "2025-12-05T10:00:00Z",
      ...
    }
  ],
  "nextCursor": "def456"
}
```

#### POST `/api/explore/submissions/:id/withdraw`
Withdraw a pending submission

**Response:**
```json
{
  "withdrawn": true
}
```

### Moderation (Admin/Moderator Only)

#### GET `/api/explore/moderation/queue?filter=pending&limit=50`
Get submissions awaiting review (requires moderator role)

**Response:**
```json
{
  "queue": [
    {
      "id": "abc123",
      "userId": "user123",
      "status": "pending",
      "title": "Chrome Aura Nails",
      "moderationFlags": {
        "spam": 0.1,
        "inappropriate": 0.05,
        "aiGenerated": false
      },
      "submittedAt": "2025-12-05T10:00:00Z"
    }
  ]
}
```

#### POST `/api/explore/moderation/:id/approve`
Approve submission and add to Explore

**Body:**
```json
{
  "collectionId": "design_spotlight",
  "trendScore": 0.85
}
```

**Response:**
```json
{
  "entryId": "entry123",
  "approved": true
}
```

#### POST `/api/explore/moderation/:id/reject`
Reject submission

**Body:**
```json
{
  "reason": "Low image quality - please resubmit with clearer photos"
}
```

**Response:**
```json
{
  "rejected": true
}
```

### Health Check

#### GET `/api/health`
Check service status

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-05T12:00:00Z"
}
```

## Security

### Authentication
All endpoints (except health check) require Firebase ID token in Authorization header:
```
Authorization: Bearer <firebase-id-token>
```

### Rate Limiting
- Submissions: 10 per day per user
- General API calls: 60 per minute per IP

### Content Moderation
All submissions are automatically scanned using Cloud Vision API for:
- Adult content
- Violence
- Inappropriate imagery
- Spam patterns

Safe content → `pending` status
Flagged content → `flagged` status (requires manual review)

## Firestore Collections

### `explore_submissions`
User-generated submissions awaiting review
```typescript
{
  userId: string;
  status: "pending" | "approved" | "rejected" | "flagged";
  type: "design" | "technique" | "product" | "tutorial";
  title: string;
  description: string;
  mediaUrls: string[];
  tags: string[];
  moderationFlags: { spam: number; inappropriate: number; };
  submittedAt: Timestamp;
  reviewedBy?: string;
  approvedEntryId?: string;
}
```

### `explore_collections/{id}/entries`
Approved entries (curated + user-submitted)
```typescript
{
  title: string;
  type: string;
  mediaUrl: string;
  tags: string[];
  trendScore: number;
  source: "curated" | "user_submission";
  submitterId?: string;
  createdAt: Timestamp;
}
```

## Testing

```bash
# Run tests
npm test

# Test submission creation
curl -X POST http://localhost:8080/api/explore/submissions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "design",
    "title": "Test Submission",
    "mediaUrls": ["https://example.com/image.jpg"],
    "tags": ["test"]
  }'
```

## Deployment

### Firebase App Hosting (Recommended)

1. Create `apphosting.yaml`:
   ```yaml
   runConfig:
     runtime: nodejs20
     minInstances: 0
     maxInstances: 10
   env:
     - variable: NODE_ENV
       value: production
   ```

2. Deploy:
   ```bash
   firebase apphosting:backends:create explore-api
   ```

### Cloud Run (Alternative)

1. Create `Dockerfile`:
   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY dist ./dist
   CMD ["node", "dist/index.js"]
   ```

2. Deploy:
   ```bash
   gcloud run deploy explore-api --source .
   ```

## Monitoring

Key metrics to track:
- Submission creation rate
- Moderation queue depth
- Approval/rejection ratio
- Content moderation API costs
- API error rates

## Roadmap

- [x] Phase 1: User submissions & moderation
- [ ] Phase 2: Instagram/TikTok integration
- [ ] Phase 3: ML recommendations
- [ ] Phase 4: Analytics dashboard

## Contributing

Follow the monorepo conventions:
1. Use TypeScript with ES modules
2. Include `.js` extensions in imports
3. Validate input with Zod schemas
4. Log with structured context
5. Test locally with emulators

## Support

For issues or questions, refer to:
- Main docs: `../upstyles_app/EXPLORE_API_ARCHITECTURE.md`
- Chat API example: `../chat-api/`
- Map API example: `../map-api/`
