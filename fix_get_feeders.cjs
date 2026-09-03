const fs = require('fs');
let code = fs.readFileSync('src/pages/DevicesPage.tsx', 'utf8');

code = code.replace(
  "        api.getFeeders(),",
  "        // api.getFeeders() removed"
);

fs.writeFileSync('src/pages/DevicesPage.tsx', code);
console.log('Fixed DevicesPage.tsx getFeeders()');
