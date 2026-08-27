import { getTargetFirestore } from '../firebaseAdmin';
import fs from 'fs';

async function verifyMigration() {
    const db = getTargetFirestore();
    const data = JSON.parse(fs.readFileSync('backup_sqlite_2026-08-26T15-28-32-595Z.json', 'utf-8'));
    const tables = Object.keys(data);
    
    let totalDocs = 0;
    const report: any = {
        counts: {},
        sampleDocs: {},
        idempotencyCreateCount: 0
    };

    // 1. Verify counts
    for (const table of tables) {
        const snap = await db.collection(table).count().get();
        const count = snap.data().count;
        report.counts[table] = count;
        totalDocs += count;
        
        // Read sample
        const sampleSnap = await db.collection(table).limit(1).get();
        if (!sampleSnap.empty) {
            report.sampleDocs[table] = sampleSnap.docs[0].data();
        }
    }

    // 2. Idempotency check (run same migration logic but expect 0 creates)
    let idempotencyCreateCount = 0;
    for (const table of tables) {
        for (const row of data[table]) {
            const docRef = db.collection(table).doc(String(row.id));
            const snap = await docRef.get();
            if (!snap.exists) {
                idempotencyCreateCount++;
            }
        }
    }
    report.idempotencyCreateCount = idempotencyCreateCount;
    report.totalDocs = totalDocs;
    
    console.log(JSON.stringify(report, null, 2));
}

verifyMigration().catch(console.error);
