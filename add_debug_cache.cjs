const fs = require('fs');
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

if (!appCode.includes("import { clearAllCache } from './lib/idbCache';")) {
  appCode = appCode.replace(
    "import React, { useState, useEffect } from 'react';",
    "import React, { useState, useEffect } from 'react';\nimport { clearAllCache } from './lib/idbCache';"
  );
}

if (!appCode.includes("window.clearGridCache")) {
  appCode = appCode.replace(
    "export default function App() {",
    "if (typeof window !== 'undefined') {\n  (window as any).clearGridCache = clearAllCache;\n}\n\nexport default function App() {"
  );
}

fs.writeFileSync('src/App.tsx', appCode);
