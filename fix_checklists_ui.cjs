const fs = require('fs');
let code = fs.readFileSync('src/pages/ChecklistsPage.tsx', 'utf8');

// Replace the div containing Edit, Clone, Delete buttons with role check
code = code.replace(
  /<div className="flex items-center space-x-1">\s*<button\s*onClick=\{\(\) => handleEditChecklist\(c\)\}[\s\S]*?<Trash2 className="w-4 h-4" \/>\s*<\/button>\s*<\/div>/,
  `{(hasRole('ADMIN') || hasRole('MANAGER')) && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleEditChecklist(c)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 cursor-pointer"
                        title="Chỉnh sửa nội dung checklist"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCloneChecklist(c.id)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 cursor-pointer"
                        title="Nhân bản mẫu checklist"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteChecklist(c.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                        title="Xóa mẫu checklist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}`
);

// We should also check where else we need it. Let's write it and see if it applies.
fs.writeFileSync('src/pages/ChecklistsPage.tsx', code);
