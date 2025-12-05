# 🚀 Explore API Quick Start

Get the Explore API running locally in 5 minutes.

## Prerequisites

- Node.js 20+
- Firebase project (upstyles-pro)
- Service account key downloaded

## Setup

### 1. Install Dependencies
```bash
cd explore-api
npm install
```

### 2. Configure Environment
```bash
# Copy example config
cp .env.example .env

# Edit .env with your values:
# FIREBASE_PROJECT_ID=upstyles-pro
# GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

### 3. Add Service Account Key
Download from Firebase Console → Project Settings → Service Accounts → Generate New Private Key

Save as `explore-api/service-account-key.json`

### 4. Start Server
```bash
npm run dev
```

Server runs on http://localhost:8080

### 5. Test It
```bash
# Health check
curl http://localhost:8080/api/health

# Should return:
# {"status":"healthy","timestamp":"2025-12-05T..."}
```

## Test with Authentication

### Get Firebase Token
```bash
# From Flutter app or Firebase Console
# User must be authenticated

# Then test submission:
export TOKEN="your-firebase-id-token"

curl -X POST http://localhost:8080/api/explore/submissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "design",
    "title": "My First Submission",
    "description": "Testing the API",
    "mediaUrls": ["https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91"],
    "tags": ["test", "design"],
    "difficulty": "beginner"
  }'
```

Expected response:
```json
{
  "submissionId": "abc123...",
  "status": "pending",
  "estimatedReviewTime": "24-48 hours"
}
```

## Deploy to Production

### Option A: Firebase App Hosting (Recommended)
```bash
# Create apphosting.yaml
cat > apphosting.yaml << EOF
runConfig:
  runtime: nodejs20
  minInstances: 0
  maxInstances: 10
env:
  - variable: NODE_ENV
    value: production
EOF

# Deploy
firebase apphosting:backends:create explore-api
```

### Option B: Cloud Run
```bash
# Build
npm run build

# Deploy
gcloud run deploy explore-api \
  --source . \
  --region us-east4 \
  --allow-unauthenticated
```

## Update Flutter App

Add to `upstyles_app/dart_defines.json`:
```json
{
  "EXPLORE_API_BASE_URL": "https://explore-api--upstyles-pro.us-east4.hosted.app"
}
```

## Troubleshooting

### "Cannot find module 'express'"
→ Run `npm install`

### "Firebase Admin not initialized"
→ Check `.env` has correct `FIREBASE_PROJECT_ID`
→ Verify service account key path

### "Rate limit exceeded"
→ Increase `RATE_LIMIT_SUBMISSIONS_DAILY` in `.env` for testing

### TypeScript errors about missing `.js` extensions
→ This is expected before npm install
→ After install, ensure all local imports have `.js` extension

## Next Steps

1. ✅ Deploy Firestore security rules
2. ✅ Test submission flow end-to-end
3. ✅ Set up moderation queue UI
4. ✅ Configure Cloud Monitoring alerts
5. ⏭️ Phase 2: Add Instagram integration
6. ⏭️ Phase 3: Enable ML recommendations

## Useful Commands

```bash
# Development
npm run dev          # Start with hot reload

# Production
npm run build        # Compile TypeScript
npm start            # Run compiled code

# Testing
npm test             # Run tests (when added)

# Linting
npm run lint         # Check code style
```

## Documentation

- Architecture: `../upstyles_app/EXPLORE_API_ARCHITECTURE.md`
- Full README: `README.md`
- API Reference: See README "API Endpoints" section

Need help? Check similar APIs:
- `../chat-api/` - Similar REST architecture
- `../map-api/` - Similar deployment pattern
