const fs = require('fs');
const glob = require('glob');

const replaceInFile = (file, searchRegex, replaceStr) => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    let newContent = content.replace(searchRegex, replaceStr);
    if (content !== newContent) {
      fs.writeFileSync(file, newContent, 'utf8');
      console.log(`Updated ${file}`);
    }
  }
};

const replaceAllInFile = (file, searchRegex, replaceStr) => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    let newContent = content;
    while (searchRegex.test(newContent)) {
       newContent = newContent.replace(searchRegex, replaceStr);
    }
    if (content !== newContent) {
      fs.writeFileSync(file, newContent, 'utf8');
      console.log(`Updated all in ${file}`);
    }
  }
}

// 1. Types
replaceInFile('src/types/index.ts', /\| 'MANAGER'\s*\| 'STAFF'/, "| 'MANAGER'\n  | 'SHIFT_LEADER'\n  | 'STAFF'");

// 2. server/middleware.ts
replaceInFile('server/middleware.ts', /!\[\'ADMIN\', \'MANAGER\', \'STAFF\', \'VIEWER\'\]\.includes/, "!['ADMIN', 'MANAGER', 'SHIFT_LEADER', 'STAFF', 'VIEWER'].includes");
replaceInFile('server/middleware.ts', /some\(r => \[\'ADMIN\', \'MANAGER\', \'STAFF\'\]\.includes/, "some(r => ['ADMIN', 'MANAGER', 'SHIFT_LEADER', 'STAFF'].includes");

// 3. server/routes/roles.ts
replaceInFile('server/routes/roles.ts', /\{ id: 3, code: 'STAFF'/, "{ id: 25, code: 'SHIFT_LEADER', name: 'SHIFT_LEADER', description: 'Trưởng ca vận hành', level: 2, status: 'ACTIVE' },\n    { id: 3, code: 'STAFF'");

// 4. Update requireRole in all routes
const routeFiles = glob.sync('server/routes/*.ts');
for (const file of routeFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;
  // anywhere requireRole(['ADMIN', 'MANAGER']) appears -> replace with requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER'])
  // BUT WAIT. The prompt said: "KHÔNG được tạo/giao/sửa/xóa công việc. KHÔNG được tạo/sửa/xóa mẫu checklist."
  // So we should NOT add SHIFT_LEADER to tasks.ts and checklists.ts mutations.
  if (!file.includes('tasks.ts') && !file.includes('checklists.ts') && !file.includes('schedules.ts') && !file.includes('users.ts') && !file.includes('roles.ts') && !file.includes('auditLogs.ts') && !file.includes('import.ts')) {
     newContent = newContent.replace(/requireRole\(\['ADMIN', 'MANAGER'\]\)/g, "requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER'])");
  }
  // For GET requests that allow 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER' -> add SHIFT_LEADER
  newContent = newContent.replace(/requireRole\(\['ADMIN', 'MANAGER', 'STAFF', 'VIEWER'\]\)/g, "requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER', 'STAFF', 'VIEWER'])");
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Updated requireRole in ${file}`);
  }
}

// 5. Check frontend AppLayout.tsx
replaceInFile('src/components/layout/AppLayout.tsx', /rolesAllowed\?: \(\'ADMIN\' \| \'MANAGER\' \| \'STAFF\' \| \'VIEWER\'\)\[\]/, "rolesAllowed?: ('ADMIN' | 'MANAGER' | 'SHIFT_LEADER' | 'STAFF' | 'VIEWER')[]");
replaceInFile('src/components/layout/AppLayout.tsx', /\['ADMIN', 'MANAGER', 'STAFF'\]/g, "['ADMIN', 'MANAGER', 'SHIFT_LEADER', 'STAFF']");
// For specific elements, make sure we get them all.
let appLayoutContent = fs.readFileSync('src/components/layout/AppLayout.tsx', 'utf8');
appLayoutContent = appLayoutContent.replace(/\['ADMIN', 'MANAGER'\]/g, "['ADMIN', 'MANAGER', 'SHIFT_LEADER']");
fs.writeFileSync('src/components/layout/AppLayout.tsx', appLayoutContent, 'utf8');

