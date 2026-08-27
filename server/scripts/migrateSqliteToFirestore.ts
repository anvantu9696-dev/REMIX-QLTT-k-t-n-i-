import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
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

async function migrate() {
    const dbPath = path.resolve(process.cwd(), 'grid_management.sqlite');
    const SQL = await initSqlJs();
    const data = fs.readFileSync(dbPath);
    const sqliteDb = new SQL.Database(data);

    // Try migrating just the 'roles' table
    console.log('Migrating table: roles');
    const rows = sqliteDb.exec(`SELECT * FROM roles`);
    if (!rows.length) return;

    const columns = rows[0].columns;
    for (const row of rows[0].values) {
        const doc: any = {};
        columns.forEach((col, index) => {
            doc[col] = row[index];
        });

        console.log('Writing doc:', doc);
        await db.collection('roles').doc(String(doc.id)).set(doc);
    }
    console.log('Finished migrating roles');
}

migrate().catch(console.error);
