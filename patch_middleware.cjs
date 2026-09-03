const fs = require('fs');
let code = fs.readFileSync('server/middleware.ts', 'utf8');

if (!code.includes('getCached')) {
  code = code.replace(
    "import { getTargetFirestore, getTargetAuth } from './firebaseAdmin.js';",
    "import { getTargetFirestore, getTargetAuth } from './firebaseAdmin.js';\nimport { getCached, setCached, logCacheHit } from './utils/firestoreCache';"
  );
}

const findAuth = `    const db = getTargetFirestore();
    const uid = decodedToken.uid;
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, errorType: 'PROFILE_NOT_FOUND', message: 'Không tìm thấy hồ sơ người dùng.' });
    }
    const userRow = doc.data() as any;
    userRow.id = doc.id;`;

const replaceAuth = `    const db = getTargetFirestore();
    const uid = decodedToken.uid;
    const cacheKey = \`user_doc_\${uid}\`;
    let userRow = getCached<any>(cacheKey);
    
    if (userRow) {
      logCacheHit('users', cacheKey);
    } else {
      const doc = await db.collection('users').doc(uid).get();
      if (!doc.exists) {
        return res.status(404).json({ success: false, errorType: 'PROFILE_NOT_FOUND', message: 'Không tìm thấy hồ sơ người dùng.' });
      }
      userRow = doc.data() as any;
      userRow.id = doc.id;
      setCached(cacheKey, userRow, 300000); // Cache 5 phút
    }`;

code = code.replace(findAuth, replaceAuth);
fs.writeFileSync('server/middleware.ts', code);
console.log('Middleware patched.');
