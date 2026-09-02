const fs = require('fs');
let code = fs.readFileSync('src/pages/DevicesPage.tsx', 'utf8');

code = code.replace("  const [totalDevicesCount, setTotalDevicesCount] = useState<number>(0);\n", "");

fs.writeFileSync('src/pages/DevicesPage.tsx', code);
