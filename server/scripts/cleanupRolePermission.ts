import fs from 'fs';
import { getTargetFirestore } from '../firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

async function cleanup() {
    const db = getTargetFirestore();
    const roleId = 1;
    const permId = 37;

    const snap = await db.collection('role_permissions')
        .where('role_id', '==', roleId)
        .where('permission_id', '==', permId)
        .get();

    console.log(`Found ${snap.size} documents for role_id=${roleId}, permission_id=${permId}`);

    if (snap.size < 2) {
        console.error("CLEANUP_SAFE: NO - Less than 2 documents found.");
        return;
    }

    const docs = snap.docs.map(d => ({ id: d.id, data: d.data(), updateTime: d.updateTime }));
    
    // Find canonical (migrated from JSON, keeping ID if it matches semantic key or similar)
    // The user stated the duplicate to delete is "role_id_1_permission_id_37".
    // We assume the other one is canonical.
    
    const duplicateId = 'role_id_1_permission_id_37';
    const duplicate = docs.find(d => d.id === duplicateId);
    const canonical = docs.find(d => d.id !== duplicateId);

    if (!duplicate || !canonical) {
        console.error("CLEANUP_SAFE: NO - Could not identify duplicate or canonical.");
        return;
    }

    console.log("Canonical:", canonical.id);
    console.log("Duplicate:", duplicate.id);

    // 1. Backup
    const backupDir = 'backups';
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
    const backupPath = `${backupDir}/firestore_duplicate_cleanup_${Date.now()}.json`;
    const backupData = {
        targetProject: 'gen-lang-client-0467602660',
        databaseId: 'ai-studio-remixqunlthitbli-d646d96a-f5c6-4aef-9fca-c34a3e1200a6',
        collection: 'role_permissions',
        documents: { canonical, duplicate },
        reason: 'Semantic duplicate cleanup',
        timestamp: new Date().toISOString()
    };
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

    // 2. Audit
    await db.collection('audit_logs').add({
        user_id: 1,
        action: 'FIRESTORE_SEMANTIC_DUPLICATE_CLEANUP',
        module: 'ROLE_PERMISSIONS',
        target_id: duplicateId,
        details: `Deleted semantic duplicate of ${canonical.id}`,
        created_at: FieldValue.serverTimestamp()
    });

    // 3. Delete
    await db.collection('role_permissions').doc(duplicateId).delete();
    console.log("Successfully deleted duplicate:", duplicateId);

    // 4. Verification
    const finalSnap = await db.collection('role_permissions')
        .where('role_id', '==', roleId)
        .where('permission_id', '==', permId)
        .get();
    
    console.log(`Remaining documents: ${finalSnap.size}`);
}

cleanup().catch(console.error);
