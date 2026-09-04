const fs = require('fs');
let code = fs.readFileSync('src/pages/DashboardPage.tsx', 'utf8');

code = code.replace(/const pendingCount = pendingApprovalTasks\.length;/, "const pendingCount = stats?.pending_approval_tasks ?? pendingApprovalTasks.length;");

code = code.replace(/\{pendingApprovalTasks\.length > 4 && \(/, "{pendingCount > 4 && (");
code = code.replace(/Xem thêm \{pendingApprovalTasks\.length - 4\} công việc chờ xác nhận khác →/, "Xem thêm {pendingCount - 4} công việc chờ xác nhận khác \u2192");

fs.writeFileSync('src/pages/DashboardPage.tsx', code);
