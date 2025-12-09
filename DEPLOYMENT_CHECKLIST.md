# Vision API Deployment Checklist

Complete these steps to enable Vision API for production content moderation.

## ☐ Step 1: Enable Vision API (2 min)

```bash
gcloud auth login
gcloud config set project upstyles-pro
gcloud services enable vision.googleapis.com
```

**Verify:**
```bash
gcloud services list --enabled | grep vision
# Should show: vision.googleapis.com
```

---

## ☐ Step 2: Grant IAM Permissions (1 min)

Get your service account email:
```bash
gcloud iam service-accounts list --project=upstyles-pro
```

Grant Vision API access:
```bash
gcloud projects add-iam-policy-binding upstyles-pro \
  --member="serviceAccount:firebase-adminsdk-xxxxx@upstyles-pro.iam.gserviceaccount.com" \
  --role="roles/cloudvision.user"
```

---

## ☐ Step 3: Set Up Local Development (3 min)

1. Download service account key:
   - https://console.cloud.google.com/iam-admin/serviceaccounts?project=upstyles-pro
   - Click Firebase Admin service account → Keys → Add Key → JSON
   - Save as `explore-api/service-account-key.json`

2. Configure environment:
```bash
cd explore-api
cp .env.example .env

# Edit .env to add:
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
VISION_API_COST_PER_IMAGE=0.0015
VISION_API_ALERT_THRESHOLD=100
```

3. Test locally:
```bash
npm install
npm run dev
```

---

## ☐ Step 4: Set Up Cost Monitoring (5 min)

### A. Create Budget Alert

1. Visit: https://console.cloud.google.com/billing/budgets?project=upstyles-pro
2. Click **Create Budget**
3. Configure:
   - Name: `Vision API Monthly Budget`
   - Scope: Cloud Vision API only
   - Amount: $50/month
   - Alerts: 50%, 90%, 100%
   - Email: your-email@example.com
4. Click **Finish**

### B. Create Firestore Index

The cost tracking uses a Firestore query that needs an index:

```bash
# In Firebase Console → Firestore → Indexes
# Or deploy from explore-api/:
firebase deploy --only firestore:indexes
```

Add this index to `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "moderation_metrics",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "timestamp", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## ☐ Step 5: Test with Sample Submission (5 min)

1. Get a Firebase auth token:
   - Open your app or use Firebase Console
   - Copy the ID token from browser DevTools

2. Test submission:
```bash
export TOKEN="your-firebase-id-token"

curl -X POST http://localhost:8080/api/explore/submissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "design",
    "title": "Test Vision API",
    "description": "Testing content moderation",
    "mediaUrls": ["https://images.unsplash.com/photo-1604654894610-df63bc536371"],
    "tags": ["test"]
  }'
```

3. Check logs for:
```
[Moderation] Analyzing image: https://...
[Moderation] Processed 1 images for $0.0015 (Monthly total: $0.0015)
```

4. Verify in Firestore:
   - Collection: `moderation_metrics`
   - Should have new document with cost data

---

## ☐ Step 6: Deploy to Production (5 min)

1. Build the API:
```bash
cd explore-api
npm run build
```

2. Configure production environment (Firebase Console):
   - App Hosting → explore-api → Configuration → Environment Variables
   - Add:
     - `VISION_API_COST_PER_IMAGE` = `0.0015`
     - `VISION_API_ALERT_THRESHOLD` = `100`

3. Deploy:
```bash
firebase deploy --only apphosting:explore-api
```

4. Verify deployment:
```bash
curl https://explore-api--upstyles-pro.us-east4.hosted.app/api/health
# Should return: {"status":"healthy","timestamp":"..."}
```

---

## ☐ Step 7: Test Production Moderation (5 min)

1. Submit from mobile app:
   - Open UpStyles app
   - Go to Explore → Submit
   - Upload a test image
   - Submit

2. Check admin dashboard:
   - https://upstyles-admin-pro.web.app
   - Navigate to Submissions moderation queue
   - Should see your submission with moderation flags

3. Verify cost tracking:
```bash
curl https://explore-api--upstyles-pro.us-east4.hosted.app/api/admin/moderation/monthly-cost \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## ☐ Step 8: Set Up Monitoring Dashboard (10 min)

Add to admin dashboard UI (`upstyles_admin`):

1. Create new Analytics widget for Vision API costs
2. Fetch from: `GET /api/admin/moderation/monthly-cost`
3. Display:
   - Monthly total cost
   - Images processed
   - Cost per image
   - Daily breakdown chart

Example Flutter code:
```dart
Future<Map<String, dynamic>> fetchModerationCosts() async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();
  final response = await http.get(
    Uri.parse('$exploreApiUrl/api/admin/moderation/monthly-cost'),
    headers: {'Authorization': 'Bearer $token'},
  );
  return jsonDecode(response.body);
}
```

---

## ☐ Step 9: Monitor First Week (Ongoing)

Track these metrics:

| Metric | Target | Check |
|--------|--------|-------|
| Submissions/day | 10-100 | ☐ |
| Vision API calls/day | 20-200 | ☐ |
| Daily cost | <$1 | ☐ |
| False positive rate | <5% | ☐ |
| Processing time | <2s | ☐ |

Check daily for first week:
```bash
# View logs
firebase apphosting:logs explore-api --lines=100

# Check monthly cost
curl https://explore-api--upstyles-pro.us-east4.hosted.app/api/admin/moderation/monthly-cost \
  -H "Authorization: Bearer $TOKEN"
```

---

## ☐ Step 10: Adjust Thresholds (As Needed)

If you see too many false positives/negatives:

1. Edit `explore-api/src/services/moderation.ts`:
```typescript
// Make more lenient (fewer rejections)
if (adult > 0.8) reasons.push('Adult content'); // was 0.6

// Make stricter (more rejections)
if (adult > 0.4) reasons.push('Adult content'); // was 0.6
```

2. Redeploy:
```bash
npm run build
firebase deploy --only apphosting:explore-api
```

3. Monitor for 24 hours and adjust again if needed

---

## 📊 Success Criteria

You're done when:

- ✅ Vision API enabled and working
- ✅ First test submission processed successfully
- ✅ Costs tracking in `moderation_metrics` collection
- ✅ Budget alerts configured
- ✅ Production deployment live
- ✅ Admin can view cost stats
- ✅ Monitoring dashboard showing data

---

## 🆘 Need Help?

**Common Issues:**
- See `VISION_API_SETUP.md` → Troubleshooting section
- Check logs: `firebase apphosting:logs explore-api`
- Test locally first: `npm run dev`

**Quick Reference:**
- `VISION_API_QUICKSTART.md` - Fast commands
- `VISION_API_SETUP.md` - Detailed guide
- `README.md` - API documentation

---

## 📈 Next Steps After Setup

1. Add cost analytics to admin dashboard
2. Set up weekly cost review meeting
3. Consider client-side pre-filtering (Phase 2)
4. Implement caching for re-submissions
5. Monitor false positive rate and adjust thresholds

---

**Estimated Total Time:** 30-40 minutes

**Monthly Cost (Expected):** $5-20 for first month

Good luck! 🚀
