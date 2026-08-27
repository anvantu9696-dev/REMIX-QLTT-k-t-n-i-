import { getTargetFirestore, FIRESTORE_TARGET } from '../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import http from 'http';

async function getServiceAccountEmail(): Promise<string> {
    return new Promise((resolve) => {
        const options = {
            hostname: 'metadata.google.internal',
            path: '/computeMetadata/v1/instance/service-accounts/default/email',
            headers: { 'Metadata-Flavor': 'Google' },
            timeout: 2000
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', () => resolve('NOT_AVAILABLE'));
        req.on('timeout', () => { req.destroy(); resolve('NOT_AVAILABLE'); });
        req.end();
    });
}

async function runProcessDiagnostics() {
    try {
        const db = getTargetFirestore();
        const serviceAccountEmail = await getServiceAccountEmail();

        console.log('--- DIAGNOSTICS START ---');
        console.log(`app.name: ${FIRESTORE_TARGET.appName}`);
        console.log(`app.options.projectId: ${FIRESTORE_TARGET.projectId}`);
        console.log(`databaseId: ${FIRESTORE_TARGET.databaseId}`);
        console.log(`target resource: ${FIRESTORE_TARGET.resource}`);
        console.log(`serviceAccountEmail: ${serviceAccountEmail}`);
        console.log(`runtimeProjectId: ${process.env.GOOGLE_CLOUD_PROJECT || 'UNKNOWN'}`);

        const testRunId = Math.random().toString(36).substring(7);
        const docRef = db.collection('_system').doc('migration_process_test');
        
        // Write
        await docRef.set({
            testRunId,
            testedAt: FieldValue.serverTimestamp()
        });

        // Read
        const doc = await docRef.get();
        const data = doc.data();

        // Verify
        const match = data?.testRunId === testRunId;
        
        // Cleanup
        await docRef.delete();

        console.log(`Process-level WRITE: ${match ? 'PASS' : 'FAIL'}`);
        console.log(`Process-level READ: ${match ? 'PASS' : 'FAIL'}`);
        console.log(`TEST_RUN_ID_MATCH: ${match ? 'PASS' : 'FAIL'}`);
        console.log('--- DIAGNOSTICS END ---');

    } catch (e: any) {
        console.error('--- DIAGNOSTICS FAILED ---');
        console.error(e);
    }
}

runProcessDiagnostics();
