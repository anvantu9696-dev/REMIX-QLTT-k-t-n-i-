import { initializeApp, applicationDefault, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
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

async function runDiagnostics() {
    try {
        const adminApp = getApps().length > 0 ? getApp() : initializeApp({ credential: applicationDefault() });
        const projectId = adminApp.options.projectId || process.env.GOOGLE_CLOUD_PROJECT || 'UNKNOWN';
        const serviceAccountEmail = await getServiceAccountEmail();
        const databaseId = 'ai-studio-remixqunlthitbli-d646d96a-f5c6-4aef-9fca-c34a3e1200a6';

        const results: any = {
            processEnvProjectId: process.env.GOOGLE_CLOUD_PROJECT,
            processEnvGCloudProject: process.env.GCLOUD_PROJECT,
            firebaseAppProjectId: adminApp.options.projectId,
            serviceAccountEmail,
            databaseId,
            resourceName: `projects/${projectId}/databases/${databaseId}`,
        };

        // Tests
        const defaultDb = getFirestore(adminApp);
        const namedDb = getFirestore(adminApp, databaseId);

        const testRunId = Math.random().toString(36).substring(7);

        // Default DB Test
        try {
            await defaultDb.collection('_system').doc('admin_diagnostic').set({ testRunId, testedAt: FieldValue.serverTimestamp() });
            await defaultDb.collection('_system').doc('admin_diagnostic').get();
            results.defaultDb = 'PASS';
        } catch (e: any) {
            results.defaultDb = 'FAIL: ' + e.message;
        }

        // Named DB Test
        try {
            await namedDb.collection('_system').doc('admin_diagnostic').set({ testRunId, testedAt: FieldValue.serverTimestamp() });
            await namedDb.collection('_system').doc('admin_diagnostic').get();
            results.namedDb = 'PASS';
        } catch (e: any) {
            results.namedDb = 'FAIL: ' + e.message;
        }

        console.log(JSON.stringify(results, null, 2));
    } catch (err: any) {
        console.error(err);
    }
}

runDiagnostics();
