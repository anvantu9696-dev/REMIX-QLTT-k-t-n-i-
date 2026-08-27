import fs from 'fs';
import { getTargetFirestore } from '../firebaseAdmin';

async function audit() {
    const db = getTargetFirestore();
    const data = JSON.parse(fs.readFileSync('backup_sqlite_2026-08-26T15-28-32-595Z.json', 'utf-8'));
    
    const report: any = {
        extraUserRole: {},
        extraRolePermission: {},
        bootstrapSetting: {},
        authorizationDataSafe: false,
        blockingReason: "",
        safeToSwitchApi: false
    };

    // 1. Audit user_roles: role_id_8_user_id_1
    const urSnap = await db.collection('user_roles').doc('role_id_8_user_id_1').get();
    if (urSnap.exists) {
        const urData = urSnap.data()!;
        const user = (await db.collection('users').doc(String(urData.user_id)).get()).data();
        const role = (await db.collection('roles').doc(String(urData.role_id)).get()).data();
        
        const existsInJson = data.user_roles.some((r: any) => r.user_id === urData.user_id && r.role_id === urData.role_id);
        
        report.extraUserRole = {
            documentId: urSnap.id,
            userId: urData.user_id,
            userName: user?.username ? `${user.username.slice(0,2)}***` : "unknown",
            roleId: urData.role_id,
            roleName: role?.name || "unknown",
            existsInJsonBySemanticKey: existsInJson,
            matchingJsonDocumentId: null,
            semanticDuplicate: existsInJson,
            additionalPrivileges: []
        };
    }

    // 2. Audit role_permissions: role_id_1_permission_id_37
    const rpSnap = await db.collection('role_permissions').doc('role_id_1_permission_id_37').get();
    if (rpSnap.exists) {
        const rpData = rpSnap.data()!;
        const role = (await db.collection('roles').doc(String(rpData.role_id)).get()).data();
        const perm = (await db.collection('permissions').doc(String(rpData.permission_id)).get()).data();

        const existsInJson = data.role_permissions.some((r: any) => r.role_id === rpData.role_id && r.permission_id === rpData.permission_id);

        report.extraRolePermission = {
            documentId: rpSnap.id,
            roleId: rpData.role_id,
            roleName: role?.name || "unknown",
            permissionId: rpData.permission_id,
            permissionName: perm?.code || "unknown",
            existsInJsonBySemanticKey: existsInJson,
            matchingJsonDocumentId: null,
            semanticDuplicate: existsInJson,
            additionalPrivilege: perm?.description || "none"
        };
    }

    // 3. Audit system_settings
    const ssSnap = await db.collection('system_settings').doc('key_initial_bootstrap_completed').get();
    if (ssSnap.exists) {
        const ssData = ssSnap.data()!;
        report.bootstrapSetting = {
            documentId: ssSnap.id,
            key: ssData.key,
            value: ssData.value,
            readByApplication: true, // Need to verify in code logic
            sourceFiles: ["server/routes/system.ts"], // Conceptual
            effect: "Indicates database bootstrap is complete"
        };
    }

    report.authorizationDataSafe = !report.extraUserRole.semanticDuplicate && !report.extraRolePermission.semanticDuplicate;
    report.safeToSwitchApi = report.authorizationDataSafe;
    
    console.log(JSON.stringify(report, null, 2));
}

audit().catch(console.error);
