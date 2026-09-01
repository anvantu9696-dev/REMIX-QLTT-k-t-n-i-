const fs = require('fs');
let code = fs.readFileSync('src/pages/DevicesPage.tsx', 'utf8');
code = code.replace(/\/\*[\s\S]*?\*\//g, ''); // strip block comments
code = code.replace(/^\s*\/\/.*$/gm, ''); // strip line comments
code = code.replace(/\n\s*\n/g, '\n'); // remove empty lines
fs.writeFileSync('src/pages/DevicesPage-stripped.tsx', code);
