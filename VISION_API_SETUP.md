# Vision API Setup Complete

## What Was Done

### 1. Enabled Cloud Vision API
```bash
gcloud services enable vision.googleapis.com --project=upstyles-pro
```

### 2. Granted Permissions to Firebase App Hosting Service Account
Service Account: `firebase-app-hosting-compute@upstyles-pro.iam.gserviceaccount.com`

**Roles Added:**
- ✅ `roles/ml.developer` - Provides Vision API access
- ✅ `roles/serviceusage.serviceUsageConsumer` - Allows API usage tracking

**Existing Roles (already had):**
- `roles/firebase.sdkAdminServiceAgent` - Firebase Admin SDK access
- `roles/firebaseapphosting.computeRunner` - App Hosting runtime
- `roles/storage.objectViewer` - Read Cloud Storage
- `roles/developerconnect.readTokenAccessor` - Developer Connect access

## How It Works

The explore-api uses the `@google-cloud/vision` NPM package, which automatically uses **Application Default Credentials (ADC)**. When running in Firebase App Hosting:

1. The service runs as `firebase-app-hosting-compute@upstyles-pro.iam.gserviceaccount.com`
2. The Vision client library automatically detects it's running in Google Cloud
3. It uses the service account's credentials without needing API keys
4. The `roles/ml.developer` role grants permission to call Vision API

## Testing Vision API

Once explore-api redeploys, you can test Vision moderation:

### From Admin Dashboard
1. Open a post in the admin dashboard
2. Click "Run Vision API Check"
3. View the moderation results (safe/unsafe, reasons)

### Direct API Test (with admin/moderator token)
```bash
# Get a post with media
curl -X POST https://moderation-api--upstyles-pro.us-east4.hosted.app/api/moderation/vision/check-post/POST_ID \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN"

# Or check arbitrary media URLs
curl -X POST https://moderation-api--upstyles-pro.us-east4.hosted.app/api/moderation/vision/check-media \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mediaUrls": ["https://example.com/image.jpg"]}'
```

## Cost Tracking

Vision API usage is automatically tracked in the `moderation_metrics` Firestore collection:
- Cost per image: $0.0015 (configurable via `VISION_API_COST_PER_IMAGE` env var)
- Alert threshold: $100/month (configurable via `VISION_API_ALERT_THRESHOLD`)

View costs in Admin Dashboard > Analytics > Costs tab.

## Environment Variables (Optional)

Add to explore-api if needed:
```env
VISION_API_COST_PER_IMAGE=0.0015
VISION_API_ALERT_THRESHOLD=100
```

## Troubleshooting

If Vision API calls fail:
1. Check the service account has `roles/ml.developer`
2. Verify Vision API is enabled: `gcloud services list --enabled | grep vision`
3. Check explore-api logs for authentication errors
4. Ensure media URLs are publicly accessible (Vision API fetches them)

## Next Deployment

The next time explore-api and moderation-api deploy, Vision moderation will be fully functional with no additional setup needed!
