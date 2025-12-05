import admin from 'firebase-admin';

let firebaseApp: admin.app.App;

export function initializeFirebase() {
  if (firebaseApp) return firebaseApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (credentialsPath) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(credentialsPath),
      projectId,
      storageBucket: process.env.MEDIA_BUCKET,
    });
  } else {
    // Use Application Default Credentials in production (Cloud Run)
    firebaseApp = admin.initializeApp({
      projectId,
      storageBucket: process.env.MEDIA_BUCKET,
    });
  }

  console.log(`[Firebase] Initialized with project: ${projectId}`);
  return firebaseApp;
}

export function getFirestore() {
  return admin.firestore();
}

export function getStorage() {
  return admin.storage();
}

export function getAuth() {
  return admin.auth();
}
