import { initializeApp, applicationDefault, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

async function verifyAccess() {
    try {
        const adminApp = getApps().length > 0 ? getApp() : initializeApp({ 
            credential: applicationDefault(),
            projectId: 'gen-lang-client-0467602660'
        });
        const databaseId = 'ai-studio-remixqunlthitbli-d646d96a-f5c6-4aef-9fca-c34a3e1200a6';
        const namedDb = getFirestore(adminApp, databaseId);

        const testRunId = Math.random().toString(36).substring(7);
        const docRef = namedDb.collection('_system').doc('admin_connection_test');
        
        // Write
        await docRef.set({
            testRunId,
            targetProjectId: 'gen-lang-client-0467602660',
            databaseId,
            testedAt: FieldValue.serverTimestamp()
        });

        // Read
        const doc = await docRef.get();
        const data = doc.data();

        // Verify
        const match = data?.testRunId === testRunId;
        
        // Cleanup
        await docRef.delete();

        console.log(JSON.stringify({
            TARGET_RESOURCE: `projects/gen-lang-client-0467602660/databases/${databaseId}`,
            NAMED_DATABASE_WRITE: 'PASS',
            NAMED_DATABASE_READ: 'PASS',
            TEST_RUN_ID_MATCH: match ? 'PASS' : 'FAIL',
            NAMED_DATABASE_ADMIN_ACCESS: match ? 'PASS' : 'FAIL',
            SAFE_TO_MIGRATE: match ? 'YES' : 'NO'
        }));

    } catch (e: any) {
        console.log(JSON.stringify({
            TARGET_RESOURCE: 'projects/gen-lang-client-0467602660/databases/ai-studio-remixqunlthitbli-d646d96a-f5c6-4aef-9fca-c34a3e1200a6',
            NAMED_DATABASE_WRITE: 'FAIL',
            NAMED_DATABASE_READ: 'FAIL',
            TEST_RUN_ID_MATCH: 'FAIL',
            NAMED_DATABASE_ADMIN_ACCESS: 'FAIL',
            SAFE_TO_MIGRATE: 'NO',
            ERROR: e.message
        }));
    }
}

verifyAccess();
