const fs = require('fs');
let code = fs.readFileSync('src/pages/TasksPage.tsx', 'utf8');

code = code.replace(
  /setTasks\(allRes\.data\);/g,
  "setTasks(allRes.data || []);"
);

code = code.replace(
  /setMyTasks\(myRes\.data\);/g,
  "setMyTasks(myRes.data || []);"
);

code = code.replace(
  /setArchivedTasks\(myArchivedRes\.data\);/g,
  "setArchivedTasks(myArchivedRes.data || []);"
);

code = code.replace(
  /setArchivedTasks\(allArchivedRes\.data\);/g,
  "setArchivedTasks(allArchivedRes.data || []);"
);

fs.writeFileSync('src/pages/TasksPage.tsx', code);
