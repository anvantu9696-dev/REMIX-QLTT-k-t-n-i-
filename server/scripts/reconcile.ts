import fs from 'fs';
import { getTargetFirestore } from '../firebaseAdmin';

async function reconcile() {
    const data = JSON.parse(fs.readFileSync('backup_sqlite_2026-08-26T15-28-32-595Z.json', 'utf-8'));
    const db = getTargetFirestore();
    const tables = Object.keys(data);
    
    const report: any = {
        reconciliation: [],
        systemDocs: [],
        businessTotal: 0,
        systemTotal: 0,
        allTotal: 0
    };

    // 1. Reconcile Business Data
    for (const table of tables) {
        const rows = data[table];
        const snap = await db.collection(table).count().get();
        const firestoreCount = snap.data().count;
        
        report.reconciliation.push({
            table,
            sqliteCount: rows.length,
            firestoreCount,
            diff: rows.length - firestoreCount
        });
        report.businessTotal += firestoreCount;
    }

    // 2. Identify System Docs
    const collections = await db.listCollections();
    for (const col of collections) {
        if (!tables.includes(col.id)) {
            const snap = await col.count().get();
            report.systemDocs.push({
                collection: col.id,
                count: snap.data().count
            });
            report.systemTotal += snap.data().count;
        }
    }
    
    report.allTotal = report.businessTotal + report.systemTotal;
    console.log(JSON.stringify(report, null, 2));
}

reconcile().catch(console.error);
