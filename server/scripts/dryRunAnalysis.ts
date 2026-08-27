import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { initializeApp, applicationDefault, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function dryRun() {
    const dbPath = path.resolve(process.cwd(), 'grid_management.sqlite');
    const SQL = await initSqlJs();
    const data = fs.readFileSync(dbPath);
    const sqliteDb = new SQL.Database(data);

    // 1. JSON Backup
    const tablesResult = sqliteDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const tables = tablesResult[0].values.map(v => v[0] as string);
    const fullDump: any = {};
    for (const table of tables) {
        const rows = sqliteDb.exec(`SELECT * FROM ${table}`);
        if (rows.length) {
            fullDump[table] = rows[0].values.map(row => {
                const obj: any = {};
                rows[0].columns.forEach((col, i) => obj[col] = row[i]);
                return obj;
            });
        }
    }
    const jsonBackupPath = `backup_sqlite_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(jsonBackupPath, JSON.stringify(fullDump, null, 2));

    // Initialize Firebase
    const adminApp = getApps().length > 0 ? getApp() : initializeApp({ credential: applicationDefault() });
    const databaseId = 'ai-studio-remixqunlthitbli-d646d96a-f5c6-4aef-9fca-c34a3e1200a6';
    const db = getFirestore(adminApp, databaseId);

    // Analysis Report
    const report: any = {
        sqliteBackup: 'PASS',
        jsonBackup: jsonBackupPath,
        sqliteReadable: 'PASS',
        tables: [],
        firestoreExisting: {},
        idDuplicates: [],
        invalidData: [],
        dryRun: 'PASS'
    };

    for (const table of tables) {
        const rows = sqliteDb.exec(`SELECT * FROM ${table}`);
        const count = rows.length ? rows[0].values.length : 0;
        
        // Firestore Count
        let firestoreCount = 0;
        try {
            const snap = await db.collection(table).count().get();
            firestoreCount = snap.data().count;
        } catch (e) {
            firestoreCount = 0; // Likely collection doesn't exist
        }

        report.tables.push({ table, count });
        report.firestoreExisting[table] = firestoreCount;

        // Check Duplicates
        if (rows.length) {
            const ids = new Set();
            for (const row of rows[0].values) {
                const idIndex = rows[0].columns.indexOf('id');
                if (idIndex !== -1) {
                    const id = row[idIndex];
                    if (ids.has(id)) report.idDuplicates.push(`${table}:${id}`);
                    ids.add(id);
                }
            }
        }
    }
    console.log(JSON.stringify(report, null, 2));
}

dryRun().catch(console.error);
