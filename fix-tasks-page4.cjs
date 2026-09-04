const fs = require('fs');
let code = fs.readFileSync('src/pages/TasksPage.tsx', 'utf8');

code = code.replace(
  /\{selectedTask\.checklist_items\.length\}/g,
  "{selectedTask.checklist_items?.length || 0}"
);

code = code.replace(
  /\{selectedTask\.checklist_items\.map/g,
  "{(selectedTask.checklist_items || []).map"
);

code = code.replace(
  /\{selectedTask\.task_devices\.map/g,
  "{(selectedTask.task_devices || []).map"
);

code = code.replace(
  /\{td\.checklist_items\.map/g,
  "{(td.checklist_items || []).map"
);

code = code.replace(
  /\{selectedTask\.history\.map/g,
  "{(selectedTask.history || []).map"
);

code = code.replace(
  /\{currentList\.map/g,
  "{(currentList || []).map"
);

fs.writeFileSync('src/pages/TasksPage.tsx', code);
