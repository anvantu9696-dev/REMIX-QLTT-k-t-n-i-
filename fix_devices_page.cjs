const fs = require('fs');
let code = fs.readFileSync('src/pages/DevicesPage.tsx', 'utf8');

code = code.replace(
  "const [stRes, fdRes, allDevRes]",
  "const [stRes, allDevRes]"
);

fs.writeFileSync('src/pages/DevicesPage.tsx', code);
console.log('Fixed DevicesPage destructuring');
