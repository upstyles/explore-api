# Google Cloud Vision API Setup Guide

Complete setup instructions for enabling and using Google Cloud Vision API for content moderation in UpStyles Explore.

## Prerequisites

- Google Cloud Project (use existing `upstyles-pro` project)
- Firebase Admin SDK configured
- Billing enabled on your GCP project

---

## Step 1: Enable Cloud Vision API

### Via Google Cloud Console (Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: **`upstyles-pro`**
3. Navigate to **APIs & Services** → **Library**
4. Search for "Cloud Vision API"
5. Click **Enable**

### Via gcloud CLI (Alternative)

```bash
# Login to gcloud
gcloud auth login

# Set your project
gcloud config set project upstyles-pro

# Enable the Vision API
gcloud services enable vision.googleapis.com

# Verify it's enabled
gcloud services list --enabled | grep vision
```

---

## Step 2: Set Up Authentication

The Vision API will use your existing Firebase Admin SDK credentials.

### Option A: Service Account (Local Development)

1. Go to [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Select your project: `upstyles-pro`
3. Find the Firebase Admin SDK service account (or create one):
   - Name: `firebase-adminsdk-xxxxx@upstyles-pro.iam.gserviceaccount.com`
4. Click **Actions** (three dots) → **Manage Keys**
5. Click **Add Key** → **Create new key** → **JSON**
6. Save the file as `explore-api/service-account-key.json`

**Add to `.gitignore`:**
```bash
echo "service-account-key.json" >> explore-api/.gitignore
```

**Set environment variable:**
```bash
# In explore-api/.env
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

### Option B: Application Default Credentials (Production)

When deployed to Firebase App Hosting or Cloud Run, the service automatically uses the project's default credentials. No additional setup needed!

---

## Step 3: Grant Required Permissions

Ensure your service account has the correct IAM roles:

```bash
# Get your service account email
gcloud iam service-accounts list

# Grant Cloud Vision API User role
gcloud projects add-iam-policy-binding upstyles-pro \
  --member="serviceAccount:firebase-adminsdk-xxxxx@upstyles-pro.iam.gserviceaccount.com" \
  --role="roles/cloudvision.user"

# Verify permissions
gcloud projects get-iam-policy upstyles-pro \
  --flatten="bindings[].members" \
  --filter="bindings.members:firebase-adminsdk"
```

**Required Roles:**
- ✅ `roles/cloudvision.user` - Access Vision API
- ✅ `roles/firebase.admin` - Access Firestore (already set)

---

## Step 4: Configure Cost Tracking

Update your `.env` file:

```bash
# explore-api/.env
FIREBASE_PROJECT_ID=upstyles-pro
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
PORT=8080
NODE_ENV=development

# Vision API Cost Tracking
VISION_API_COST_PER_IMAGE=0.0015
VISION_API_ALERT_THRESHOLD=100
```

---

## Step 5: Test the Integration

### Local Testing

```bash
cd explore-api
npm install
npm run dev
```

**Test moderation endpoint:**

```bash
# Get a Firebase auth token first (from your app or Firebase Console)
export TOKEN="your-firebase-id-token"

# Test with a sample image
curl -X POST http://localhost:8080/api/explore/submissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "design",
    "title": "Test Moderation",
    "description": "Testing Vision API",
    "mediaUrls": ["https://images.unsplash.com/photo-1604654894610-df63bc536371"],
    "tags": ["test"]
  }'
```

**Check logs for:**
```
[Moderation] Analyzing image: https://...
[Moderation] Result: { safe: true, inappropriate: 0.1, ... }
```

### Check Vision API Usage

1. Go to [Cloud Console APIs](https://console.cloud.google.com/apis/dashboard)
2. Select `upstyles-pro` project
3. Click **Cloud Vision API**
4. View **Metrics** tab
5. You should see requests counting up

---

## Step 6: Monitor Costs

### Set Up Budget Alerts

1. Go to [Billing → Budgets & alerts](https://console.cloud.google.com/billing/budgets)
2. Click **Create Budget**
3. Configure:
   - **Name:** Vision API Monthly Budget
   - **Projects:** upstyles-pro
   - **Services:** Cloud Vision API
   - **Budget amount:** $50 per month
   - **Alert thresholds:** 50%, 90%, 100%
   - **Email notifications:** Your email

### View Current Costs

```bash
# Using gcloud (requires billing account ID)
gcloud billing accounts list
gcloud beta billing projects describe upstyles-pro
```

Or visit: [Cost Table](https://console.cloud.google.com/billing/reports)

### Expected Costs

| Submissions/Month | Images/Month | Cost/Month |
|-------------------|--------------|------------|
| 1,000 | 2,500 | $3.75 |
| 5,000 | 12,500 | $18.75 |
| 10,000 | 25,000 | $37.50 |
| 50,000 | 125,000 | $187.50 |

**Free Tier:** First 1,000 images/month are free!

---

## Step 7: Deploy to Production

### Update Environment Variables

For Firebase App Hosting, set environment variables:

```bash
# Navigate to Firebase Console
# App Hosting → explore-api → Configuration → Environment variables

# Add:
VISION_API_COST_PER_IMAGE=0.0015
VISION_API_ALERT_THRESHOLD=100
```

Or in `apphosting.yaml`:

```yaml
runConfig:
  runtime: nodejs20
env:
  - variable: NODE_ENV
    value: production
  - variable: VISION_API_COST_PER_IMAGE
    value: "0.0015"
  - variable: VISION_API_ALERT_THRESHOLD
    value: "100"
```

### Deploy

```bash
cd explore-api
npm run build
firebase deploy --only apphosting:explore-api
```

---

## Troubleshooting

### Error: "Cloud Vision API has not been enabled"

**Solution:**
```bash
gcloud services enable vision.googleapis.com --project=upstyles-pro
```

### Error: "Permission denied on resource project"

**Solution:**
```bash
# Grant yourself Owner role (if you're the project owner)
gcloud projects add-iam-policy-binding upstyles-pro \
  --member="user:your-email@gmail.com" \
  --role="roles/owner"

# Or grant just Vision API permissions
gcloud projects add-iam-policy-binding upstyles-pro \
  --member="serviceAccount:your-service-account@upstyles-pro.iam.gserviceaccount.com" \
  --role="roles/cloudvision.user"
```

### Error: "Could not load the default credentials"

**Solution:**
1. Check `GOOGLE_APPLICATION_CREDENTIALS` path in `.env`
2. Verify the service account key file exists
3. For production, ensure the service is running with proper IAM permissions

### Vision API returns "safe: false" for valid images

**Solution:** Adjust thresholds in `moderation.ts`:

```typescript
// Make it more lenient
if (adult > 0.8) reasons.push('Adult content'); // Changed from 0.6
if (violence > 0.8) reasons.push('Violence');
```

---

## Cost Optimization Tips

1. **Pre-filter client-side:** Use basic checks before uploading
2. **Batch requests:** Process multiple images per submission together
3. **Cache results:** Store moderation results to avoid re-processing
4. **Smart sampling:** Only check 1-2 images for multi-image submissions
5. **Set quotas:** Limit API calls per day in Cloud Console

---

## Monitoring Dashboard

Track these metrics in your admin dashboard:

```typescript
// Log to Firestore for analytics
await db.collection('moderation_metrics').add({
  timestamp: new Date(),
  imageCount: mediaUrls.length,
  estimatedCost: mediaUrls.length * 0.0015,
  result: moderationResult,
});
```

Query monthly costs:
```typescript
const thisMonth = new Date();
thisMonth.setDate(1);
const snapshot = await db.collection('moderation_metrics')
  .where('timestamp', '>=', thisMonth)
  .get();
  
const totalCost = snapshot.docs.reduce((sum, doc) => 
  sum + (doc.data().estimatedCost || 0), 0
);
```

---

## Next Steps

- [ ] Enable Vision API in GCP Console
- [ ] Download service account key
- [ ] Test locally with sample submission
- [ ] Set up billing alerts
- [ ] Deploy to production
- [ ] Monitor first week of usage
- [ ] Adjust thresholds based on false positive rate

---

## Resources

- [Vision API Pricing](https://cloud.google.com/vision/pricing)
- [Safe Search Detection Docs](https://cloud.google.com/vision/docs/detecting-safe-search)
- [Firebase Admin SDK Setup](https://firebase.google.com/docs/admin/setup)
- [IAM Permissions Reference](https://cloud.google.com/iam/docs/understanding-roles)
