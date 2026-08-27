import fs from 'fs';
import { getTargetFirestore, getTargetAdminApp, FIRESTORE_TARGET } from '../firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

const JSON_FILE = 'backup_sqlite_2026-08-26T15-28-32-595Z.json';

async function executeMigration() {
    // 1. Validation
    const db = getTargetFirestore();
    const app = getTargetAdminApp();

    if (app.name !== FIRESTORE_TARGET.appName ||
        app.options.projectId !== FIRESTORE_TARGET.projectId) {
        throw new Error('CONFIGURATION_MISMATCH');
    }

    const data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
    const tables = Object.keys(data);
    const migrationRunId = `run_${Date.now()}`;
    const startTime = new Date();

    console.log(`Starting migration: ${migrationRunId}`);
    await db.collection('migration_runs').doc(migrationRunId).set({
        status: 'RUNNING',
        startTime,
        file: JSON_FILE
    });

    let createdCount = 0;
    let unchangedCount = 0;
    let failedCount = 0;
    let conflictCount = 0;
    const failures: any[] = [];
    const conflicts: any[] = [];

    for (const table of tables) {
        const rows = data[table];
        for (const row of rows) {
            try {
                let docId = String(row.id || '');
                if (!docId || docId === 'undefined') {
                    // Create composite ID for junction tables
                    docId = Object.keys(row).map(k => `${k}_${row[k]}`).join('_');
                }
                const sanitizedDoc: any = {};
                for (const [key, value] of Object.entries(row)) {
                    if (value === undefined || value === null) continue;
                    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
                        sanitizedDoc[key] = Timestamp.fromDate(new Date(value.replace(' ', 'T')));
                    } else {
                        sanitizedDoc[key] = value;
                    }
                }

                const docRef = db.collection(table).doc(docId);
                const docSnap = await docRef.get();

                if (docSnap.exists) {
                    const existingData = docSnap.data();
                    // Basic deep equality check for idempotent update
                    if (JSON.stringify(existingData) === JSON.stringify(sanitizedDoc)) {
                        unchangedCount++;
                    } else {
                        conflictCount++;
                        conflicts.push({ table, id: docId });
                    }
                } else {
                    await docRef.set(sanitizedDoc);
                    createdCount++;
                }
            } catch (e: any) {
                failedCount++;
                failures.push({ table, id: row.id, error: e.message });
            }
        }
    }

    await db.collection('migration_runs').doc(migrationRunId).update({
        status: 'COMPLETED',
        endTime: new Date(),
        createdCount,
        unchangedCount,
        failedCount,
        conflictCount
    });

    console.log(JSON.stringify({
        status: 'COMPLETE',
        migrationRunId,
        createdCount,
        unchangedCount,
        failedCount,
        conflictCount,
        failures,
        conflicts
    }, null, 2));
}

executeMigration().catch(console.error);
