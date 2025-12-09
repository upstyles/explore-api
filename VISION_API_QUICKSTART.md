# Vision API Quick Start

## 🚀 Fast Setup (5 minutes)

### 1. Enable Vision API
```bash
gcloud auth login
gcloud config set project upstyles-pro
gcloud services enable vision.googleapis.com
```

### 2. Download Service Account Key
1. Visit: https://console.cloud.google.com/iam-admin/serviceaccounts?project=upstyles-pro
2. Click your Firebase Admin service account
3. Keys → Add Key → Create new key → JSON
4. Save as `explore-api/service-account-key.json`

### 3. Set Environment Variables
```bash
cd explore-api
echo 'GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json' >> .env
echo 'VISION_API_COST_PER_IMAGE=0.0015' >> .env
echo 'VISION_API_ALERT_THRESHOLD=100' >> .env
```

### 4. Test Locally
```bash
npm install
npm run dev

# In another terminal:
curl http://localhost:8080/api/health
```

### 5. Deploy
```bash
npm run build
firebase deploy --only apphosting:explore-api
```

---

## 📊 New API Endpoints

### Get Vision API Stats (Admin only)
```bash
GET /api/admin/moderation/stats?startDate=2025-12-01&endDate=2025-12-31
Authorization: Bearer <firebase-admin-token>
```

Response:
```json
{
  "success": true,
  "stats": {
    "totalImages": 1250,
    "totalCost": 1.875,
    "averageCostPerImage": 0.0015,
    "requestCount": 450,
    "byDay": {
      "2025-12-08": { "images": 45, "cost": 0.0675 },
      "2025-12-09": { "images": 62, "cost": 0.093 }
    }
  }
}
```

### Get Current Month Cost
```bash
GET /api/admin/moderation/monthly-cost
Authorization: Bearer <firebase-admin-token>
```

Response:
```json
{
  "success": true,
  "month": "2025-12",
  "totalCost": 12.45,
  "totalImages": 8300,
  "requestCount": 3200,
  "averageCostPerImage": 0.0015
}
```

---

## 💰 Cost Examples

| Scenario | Images/Day | Cost/Day | Cost/Month |
|----------|------------|----------|------------|
| Light usage | 50 | $0.075 | $2.25 |
| Medium usage | 200 | $0.30 | $9.00 |
| Heavy usage | 1,000 | $1.50 | $45.00 |
| Very heavy | 5,000 | $7.50 | $225.00 |

**Free tier:** First 1,000 images/month = FREE

---

## 🔍 Monitoring

View logs:
```bash
# Local
npm run dev  # Watch console output

# Production (Firebase App Hosting)
firebase apphosting:logs explore-api

# Or in Cloud Console:
# https://console.cloud.google.com/logs/query?project=upstyles-pro
```

Look for:
```
[Moderation] Processed 3 images for $0.0045 (Monthly total: $12.34)
```

---

## ⚠️ Cost Alerts

Automatic alerts when monthly cost exceeds threshold:
```
[Moderation] Monthly Vision API cost ($105.23) exceeds threshold ($100)
```

Set up email alerts:
1. Go to https://console.cloud.google.com/billing/budgets
2. Create budget for Cloud Vision API
3. Set threshold: $50/month
4. Add your email

---

## 🛠️ Troubleshooting

### "Vision API not enabled"
```bash
gcloud services enable vision.googleapis.com --project=upstyles-pro
```

### "Permission denied"
```bash
# Grant Vision API access to service account
gcloud projects add-iam-policy-binding upstyles-pro \
  --member="serviceAccount:YOUR-SERVICE-ACCOUNT@upstyles-pro.iam.gserviceaccount.com" \
  --role="roles/cloudvision.user"
```

### "Could not load credentials"
Check:
1. `GOOGLE_APPLICATION_CREDENTIALS` path in `.env`
2. Service account key file exists
3. File has correct permissions (readable)

### High costs unexpectedly
Check `moderation_metrics` collection:
```javascript
// In Firebase Console → Firestore
db.collection('moderation_metrics')
  .where('timestamp', '>=', thisMonth)
  .orderBy('estimatedCost', 'desc')
  .limit(20)
```

Look for:
- Spam submissions (many images from one user)
- Duplicate processing (check for retries)
- Large batch submissions

---

## 📈 Dashboard Integration

Add to admin dashboard:

```typescript
// Fetch monthly cost
const response = await fetch(
  'https://explore-api--upstyles-pro.us-east4.hosted.app/api/admin/moderation/monthly-cost',
  {
    headers: {
      'Authorization': `Bearer ${await getIdToken()}`,
    },
  }
);

const { totalCost, totalImages } = await response.json();

// Display in UI
console.log(`This month: $${totalCost.toFixed(2)} (${totalImages} images)`);
```

---

## 🎯 Best Practices

1. ✅ Monitor costs weekly
2. ✅ Set budget alerts at $50, $100, $200
3. ✅ Review `moderation_metrics` for anomalies
4. ✅ Adjust thresholds if too many false positives
5. ✅ Consider caching results for re-submissions
6. ✅ Log all moderation decisions for audit

---

## 📚 References

- Full setup: `VISION_API_SETUP.md`
- Vision API docs: https://cloud.google.com/vision/docs
- Pricing: https://cloud.google.com/vision/pricing
- Admin dashboard: https://upstyles-admin-pro.web.app
