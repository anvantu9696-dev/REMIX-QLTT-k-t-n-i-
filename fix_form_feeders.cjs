const fs = require('fs');
let code = fs.readFileSync('src/pages/DevicesPage.tsx', 'utf8');

code = code.replace(
  "  const formFeeders = formData.substation_id\n    ? feeders.filter(f => String(f.substation_id) === String(formData.substation_id))\n    : feeders;",
  ""
);

fs.writeFileSync('src/pages/DevicesPage.tsx', code);
console.log('Fixed DevicesPage.tsx duplicate formFeeders');
