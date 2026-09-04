const fs = require('fs');

function applyLimit(filePath, getRegex, limitStr) {
    if (!fs.existsSync(filePath)) return;
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Instead of regex, let's just do manual string replacement because we know exactly where it is.
}

function processTasks() {
    let code = fs.readFileSync('server/routes/tasks.ts', 'utf8');
    code = code.replace(
        /const snapshot = await query\.get\(\);/g,
        "const snapshot = await query.limit(Number(req.query.limit) || 200).get();"
    );
    fs.writeFileSync('server/routes/tasks.ts', code);
}

function processIssues() {
    let code = fs.readFileSync('server/routes/issues.ts', 'utf8');
    // It currently has: let q: any = db.collection('issues');
    code = code.replace(
        /let q: any = db\.collection\('issues'\);/g,
        "let q: any = db.collection('issues').where('isDeleted', '==', false);"
    );
    code = code.replace(
        /const snapshot = await q\.get\(\);/g,
        "const snapshot = await q.limit(Number(req.query.limit) || 200).get();"
    );
    // Also change hard delete to soft delete
    code = code.replace(
        /await db\.collection\('issues'\)\.doc\(req\.params\.id\)\.delete\(\);/g,
        "await db.collection('issues').doc(req.params.id).update({ isDeleted: true, deleted_at: new Date().toISOString() });"
    );
    fs.writeFileSync('server/routes/issues.ts', code);
}

function processSchedules() {
    let code = fs.readFileSync('server/routes/schedules.ts', 'utf8');
    code = code.replace(
        /const snap = await db\.collection\('inspection_schedules'\)\.get\(\);/g,
        "const snap = await q.limit(Number(req.query.limit) || 200).get();"
    );
    code = code.replace(
        /await db\.collection\('inspection_schedules'\)\.doc\(req\.params\.id\)\.delete\(\);/g,
        "await db.collection('inspection_schedules').doc(req.params.id).update({ isDeleted: true, deleted_at: new Date().toISOString() });"
    );
    fs.writeFileSync('server/routes/schedules.ts', code);
}

function processUsers() {
    let code = fs.readFileSync('server/routes/users.ts', 'utf8');
    code = code.replace(
        /const snapshot = await query\.get\(\);/g,
        "const snapshot = await query.limit(Number(req.query.limit) || 200).get();"
    );
    code = code.replace(
        /const snapshot = await getTargetFirestore\(\)\.collection\('users'\)\.where\('status', '==', 'PENDING'\)\.where\('deleted_at', '==', null\)\.get\(\);/g,
        "const snapshot = await getTargetFirestore().collection('users').where('status', '==', 'PENDING').where('deleted_at', '==', null).limit(100).get();"
    );
    fs.writeFileSync('server/routes/users.ts', code);
}

function processNotifications() {
    let code = fs.readFileSync('server/routes/notifications.ts', 'utf8');
    code = code.replace(
        /const snapshot = await q\.get\(\);/g,
        "const snapshot = await q.limit(Number(req.query.limit) || 100).get();"
    );
    fs.writeFileSync('server/routes/notifications.ts', code);
}

function processProposals() {
    let code = fs.readFileSync('server/routes/proposals.ts', 'utf8');
    // let query: any = db.collection('device_proposals').where('isDeleted', '==', false); already there
    code = code.replace(
        /const snapshot = await query\.get\(\);/g,
        "const snapshot = await query.limit(Number(req.query.limit) || 200).get();"
    );
    fs.writeFileSync('server/routes/proposals.ts', code);
}

function processChecklists() {
    let code = fs.readFileSync('server/routes/checklists.ts', 'utf8');
    code = code.replace(
        /const snapshot = await query\.get\(\);/g,
        "const snapshot = await query.limit(Number(req.query.limit) || 200).get();"
    );
    code = code.replace(
        /let query: any = db\.collection\('checklists'\);/g,
        "let query: any = db.collection('checklists').where('isDeleted', '==', false);"
    );
    fs.writeFileSync('server/routes/checklists.ts', code);
}

processTasks();
processIssues();
processSchedules();
processUsers();
processNotifications();
processProposals();
processChecklists();
console.log('done');
