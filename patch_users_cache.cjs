const fs = require('fs');
let code = fs.readFileSync('server/routes/users.ts', 'utf8');

// replace 
code = code.replace(/await db\.collection\('users'\)\.doc\(id\)\.update\((.*?)\);/g, 
"await db.collection('users').doc(id).update($1);\n      invalidateCache(`user_profile_${id}`);");

// Make sure invalidateCache is imported
if (!code.includes('invalidateCache')) {
    code = code.replace("import { getTargetFirestore }", "import { invalidateCache } from '../utils/firestoreCache';\nimport { getTargetFirestore }");
}

fs.writeFileSync('server/routes/users.ts', code);
console.log('Patched users route');
