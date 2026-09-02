const fs = require('fs');
let code = fs.readFileSync('src/pages/TasksPage.tsx', 'utf8');

code = code.replace(/const checkIsSupervisor = \(\) => \{[\s\S]*?    \);\n  \};/, `const checkIsSupervisor = () => {
    return hasRole('ADMIN') || hasRole('MANAGER');
  };`);

code = code.replace(/const isCanBoPhuongThucOrAdmin = \(\) => \{[\s\S]*?    \);\n  \};/, `const isCanBoPhuongThucOrAdmin = () => {
    return hasRole('ADMIN') || hasRole('MANAGER');
  };`);

fs.writeFileSync('src/pages/TasksPage.tsx', code);
