const fs = require('fs');
let code = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');

if (!code.includes("import { clearAllCache }")) {
  code = code.replace(
    "import { api, setAuthToken } from '../lib/api';",
    "import { api, setAuthToken } from '../lib/api';\nimport { clearAllCache } from '../lib/idbCache';"
  );
}
fs.writeFileSync('src/context/AuthContext.tsx', code);
