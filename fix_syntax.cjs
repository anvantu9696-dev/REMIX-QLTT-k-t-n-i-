const fs = require('fs');
let code = fs.readFileSync('src/pages/DevicesPage.tsx', 'utf8');

code = code.replace("  const fetchMetadata = async (options?: {forceRefresh?: boolean}) => {) => {", "  const fetchMetadata = async (options?: {forceRefresh?: boolean}) => {");

fs.writeFileSync('src/pages/DevicesPage.tsx', code);
