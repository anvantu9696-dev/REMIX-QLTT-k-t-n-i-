const fs = require('fs');
let code = fs.readFileSync('src/pages/ChecklistsPage.tsx', 'utf8');

// Replace the fragment for schedule buttons
code = code.replace(
  /<button\s*onClick=\{handleGenerateTasksFromSchedules\}[\s\S]*?<span>Thêm lịch định kỳ<\/span>\s*<\/button>/,
  `{(hasRole('ADMIN') || hasRole('MANAGER')) && (
                <>
                  <button
                    onClick={handleGenerateTasksFromSchedules}
                    className="inline-flex items-center justify-center px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition space-x-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Sinh công việc ngay</span>
                  </button>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs transition space-x-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm lịch định kỳ</span>
                  </button>
                </>
              )}`
);

// We should also hide "Đồng bộ Mẫu Chuẩn EVN"
code = code.replace(
  /<button\s*onClick=\{handleSyncEVNStandards\}[\s\S]*?<span>\{syncingTemplates \? 'Đang đồng bộ\.\.\.' : 'Đồng bộ Mẫu Chuẩn EVN'\}<\/span>\s*<\/button>/,
  `{(hasRole('ADMIN') || hasRole('MANAGER')) && (
              <button
                onClick={handleSyncEVNStandards}
                disabled={syncingTemplates}
                className="inline-flex items-center justify-center px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl shadow-2xs transition space-x-1.5 cursor-pointer disabled:opacity-50"
                title="Đồng bộ lại toàn bộ mẫu chuẩn EVN từ hệ thống"
              >
                <RefreshCw className={\`w-3.5 h-3.5 text-amber-700 \${syncingTemplates ? 'animate-spin' : ''}\`} />
                <span>{syncingTemplates ? 'Đang đồng bộ...' : 'Đồng bộ Mẫu Chuẩn EVN'}</span>
              </button>
            )}`
);

fs.writeFileSync('src/pages/ChecklistsPage.tsx', code);
