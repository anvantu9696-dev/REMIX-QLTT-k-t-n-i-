const fs = require('fs');
let code = fs.readFileSync('server/routes/users.ts', 'utf8');

code = code.replace(/await getTargetFirestore\(\)\.collection\('users'\)\.doc\(uid\)\.update\(\{ deleted_at: new Date\(\)\.toISOString\(\) \}\);\n\s*res\.json/g, 
  "await getTargetFirestore().collection('users').doc(uid).update({ deleted_at: new Date().toISOString() });\n    invalidateCache(`user_profile_${uid}`);\n    res.json");

code = code.replace(/await getTargetFirestore\(\)\.collection\('users'\)\.doc\(user\.id\)\.update\(\{\s*deleted_at: new Date\(\)\.toISOString\(\)\s*\}\);\n\s*res\.json/g, 
  "await getTargetFirestore().collection('users').doc(user.id).update({ deleted_at: new Date().toISOString() });\n    invalidateCache(`user_profile_${user.id}`);\n    res.json");

fs.writeFileSync('server/routes/users.ts', code);
console.log('Patched DELETE routes to invalidate cache');
