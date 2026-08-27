import {
  applicationDefault,
  getApp,
  getApps,
  initializeApp
} from 'firebase-admin/app';

import { getFirestore } from 'firebase-admin/firestore';

const TARGET_PROJECT_ID = 'gen-lang-client-0467602660';

const TARGET_DATABASE_ID =
  'ai-studio-remixqunlthitbli-d646d96a-f5c6-4aef-9fca-c34a3e1200a6';

const ADMIN_APP_NAME = 'grid-firestore-target';

export function getTargetAdminApp() {
  const existing = getApps().find(
    app => app.name === ADMIN_APP_NAME
  );

  if (existing) {
    if (existing.options.projectId !== TARGET_PROJECT_ID) {
      throw new Error(
        `FIREBASE_PROJECT_MISMATCH: expected ${TARGET_PROJECT_ID}, received ${existing.options.projectId}`
      );
    }

    return existing;
  }

  return initializeApp(
    {
      credential: applicationDefault(),
      projectId: TARGET_PROJECT_ID
    },
    ADMIN_APP_NAME
  );
}

let targetDbInstance: FirebaseFirestore.Firestore | null = null;

export function getTargetFirestore() {
  if (targetDbInstance) return targetDbInstance;

  const app = getTargetAdminApp();

  if (app.name !== ADMIN_APP_NAME) {
    throw new Error(`FIREBASE_APP_MISMATCH: ${app.name}`);
  }

  if (app.options.projectId !== TARGET_PROJECT_ID) {
    throw new Error(
      `FIREBASE_PROJECT_MISMATCH: ${app.options.projectId}`
    );
  }

  const db = getFirestore(app, TARGET_DATABASE_ID);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch (e) {
    // Ignore error if settings have already been configured
  }
  targetDbInstance = db;
  return db;
}

export const FIRESTORE_TARGET = {
  projectId: TARGET_PROJECT_ID,
  databaseId: TARGET_DATABASE_ID,
  appName: ADMIN_APP_NAME,
  resource:
    `projects/${TARGET_PROJECT_ID}/databases/${TARGET_DATABASE_ID}`
};
