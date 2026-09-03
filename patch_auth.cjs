const fs = require('fs');
let code = fs.readFileSync('server/middleware.ts', 'utf8');

const regex = /const db = getTargetFirestore\(\);\s*const uid = decodedToken\.uid;\s*const doc = await db\.collection\('users'\)\.doc\(uid\)\.get\(\);\s*if \(!doc\.exists\) \{\s*return res\.status\(404\)\.json\(\{ success: false, errorType: 'PROFILE_NOT_FOUND', message: 'Không tìm thấy hồ sơ người dùng\.' \}\);\s*\}\s*const userRow = doc\.data\(\) as any;\s*userRow\.id = doc\.id;/m;

const newCode = `const db = getTargetFirestore();
    const uid = decodedToken.uid;
    
    const cacheKey = \`user_profile_\${uid}\`;
    let userRow: any;
    const cachedUser = getCached(cacheKey);
    
    if (cachedUser) {
        // logCacheHit('users', cacheKey);
        userRow = cachedUser;
    } else {
        const doc = await db.collection('users').doc(uid).get();
        if (!doc.exists) {
            return res.status(404).json({ success: false, errorType: 'PROFILE_NOT_FOUND', message: 'Không tìm thấy hồ sơ người dùng.' });
        }
        userRow = doc.data();
        userRow.id = doc.id;
        setCached(cacheKey, userRow, 60000); // 60 seconds TTL
    }`;

code = code.replace(regex, newCode);
fs.writeFileSync('server/middleware.ts', code);
console.log('Patched auth cache TTL to 60s');
