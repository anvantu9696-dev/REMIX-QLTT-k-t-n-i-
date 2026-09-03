const fs = require('fs');
let code = fs.readFileSync('server/middleware.ts', 'utf8');

const oldAuth = `    const db = getTargetFirestore();
    const uid = decodedToken.uid;
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, errorType: 'PROFILE_NOT_FOUND', message: 'Không tìm thấy hồ sơ người dùng.' });
    }
    const userRow = doc.data() as any;
    userRow.id = doc.id;`;

const newAuth = `    const db = getTargetFirestore();
    const uid = decodedToken.uid;
    
    let userRow: any;
    const cacheKey = \`user_profile_\${uid}\`;
    const cachedUser = getCached(cacheKey);
    
    if (cachedUser) {
        logCacheHit('users', cacheKey);
        userRow = cachedUser;
    } else {
        const doc = await db.collection('users').doc(uid).get();
        if (!doc.exists) {
            return res.status(404).json({ success: false, errorType: 'PROFILE_NOT_FOUND', message: 'Không tìm thấy hồ sơ người dùng.' });
        }
        userRow = doc.data();
        userRow.id = doc.id;
        setCached(cacheKey, userRow, 300000); // 5 minutes TTL
    }`;

code = code.replace(oldAuth, newAuth);

fs.writeFileSync('server/middleware.ts', code);
console.log('Patched auth middleware caching');
