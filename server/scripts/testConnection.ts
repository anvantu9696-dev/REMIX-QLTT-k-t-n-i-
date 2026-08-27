import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
    initializeApp({
        credential: applicationDefault(),
        projectId: 'gen-lang-client-0467602660'
    });
}
const db = getFirestore('ai-studio-remixqunlthitbli-d646d96a-f5c6-4aef-9fca-c34a3e1200a6');

async function testConnection() {
    try {
        await db.collection('_system').doc('connection_test').set({
            timestamp: new Date(),
            status: 'PASS'
        });
        console.log('Firebase connection test: PASS');
    } catch (error) {
        console.error('Firebase connection test: FAIL', error);
        process.exit(1);
    }
}

testConnection();
