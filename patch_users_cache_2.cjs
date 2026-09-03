const fs = require('fs');
let code = fs.readFileSync('server/routes/users.ts', 'utf8');

if (!code.includes('invalidateCache')) {
    code = "import { invalidateCache } from '../utils/firestoreCache';\n" + code;
}

code = code.replace(/await userRef\.update\(\{([\s\S]*?)\}\);/g, "await userRef.update({$1});\n    invalidateCache(`user_profile_${req.params.id}`);");

fs.writeFileSync('server/routes/users.ts', code);
