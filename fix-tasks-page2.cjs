const fs = require('fs');
let code = fs.readFileSync('src/pages/TasksPage.tsx', 'utf8');

code = code.replace(
  /setUsersList\(userRes\.data \|\| userRes\.users \|\| \[\]\);/g,
  "setUsersList(userRes.data || (userRes as any).users || []);"
);

fs.writeFileSync('src/pages/TasksPage.tsx', code);
