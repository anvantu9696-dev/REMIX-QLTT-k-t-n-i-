const fs = require('fs');
let code = fs.readFileSync('src/pages/DevicesPage.tsx', 'utf8');

const targetStr = `      if (batteryFilter) params.battery_status = batteryFilter;
      params.limit = 10;
      params.lastDocId = nextCursor;`;

const newStr = `      if (batteryFilter) params.battery_status = batteryFilter;
      params.limit = debouncedSearch ? 30 : 10;
      params.lastDocId = nextCursor;`;

code = code.replace(targetStr, newStr);
fs.writeFileSync('src/pages/DevicesPage.tsx', code);
