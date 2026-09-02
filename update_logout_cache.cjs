const fs = require('fs');

let code = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');

if (!code.includes("import { clearAllCache } from '../lib/idbCache';")) {
  code = code.replace(
    "import React, { createContext, useContext, useState, useEffect } from 'react';",
    "import React, { createContext, useContext, useState, useEffect } from 'react';\nimport { clearAllCache } from '../lib/idbCache';"
  );
}

if (code.includes("setAuthToken(null);") && !code.includes("clearAllCache();")) {
  code = code.replace(
    "setAuthToken(null);",
    "setAuthToken(null);\n    clearAllCache();"
  );
}

fs.writeFileSync('src/context/AuthContext.tsx', code);
