const fs = require('fs');
let code = fs.readFileSync('src/pages/TasksPage.tsx', 'utf8');

code = code.replace(
  /if \(devRes\.success\) setDevices\(devRes\.data\);/g,
  "if (devRes.success) setDevices(devRes.data || []);"
);

code = code.replace(
  /if \(userRes\.success\) setUsersList\(userRes\.data\);/g,
  "if (userRes.success) setUsersList(userRes.data || userRes.users || []);"
);

code = code.replace(
  /if \(chkRes\.success\) setChecklists\(chkRes\.data\);/g,
  "if (chkRes.success) setChecklists(chkRes.data || []);"
);

fs.writeFileSync('src/pages/TasksPage.tsx', code);
