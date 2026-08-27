import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
    initializeApp({
        credential: applicationDefault(),
        projectId: 'gen-lang-client-0467602660'
    });
}
const db = getFirestore();

async function listCollections() {
    try {
        const collections = await db.listCollections();
        console.log('Collections:', collections.map(c => c.id));
    } catch (error) {
        console.error('List collections FAIL', error);
    }
}

listCollections();
