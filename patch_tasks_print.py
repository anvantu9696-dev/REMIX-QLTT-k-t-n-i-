import re

with open('src/pages/TasksPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Add import PrintChecklistModal
code = code.replace("import { formatDateTime, formatRelativeTime, formatDate } from '../utils/dateTime';", "import { formatDateTime, formatRelativeTime, formatDate } from '../utils/dateTime';\nimport { PrintChecklistModal } from '../components/PrintChecklistModal';")

# Add state for printing
code = code.replace("const [itemResults, setItemResults] = useState", "const [printDeviceChecklist, setPrintDeviceChecklist] = useState<any>(null);\n  const [itemResults, setItemResults] = useState")

# Add Print button in multi-device loop
print_button_multi = """                            <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                              <FileCheck2 className="w-4 h-4 text-blue-600" />
                              <span>Checklist: {td.device_name} ({td.checklist_title || 'Chưa gắn mẫu'})</span>
                            </h4>
                            <div className="flex items-center space-x-3">
                              <button
                                type="button"
                                onClick={() => setPrintDeviceChecklist(td)}
                                className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold text-xs rounded-lg transition"
                              >
                                <Printer className="w-4 h-4" />
                                <span>In Biên bản</span>
                              </button>
                              <span className="text-xs text-slate-500 font-medium">
                                {td.checklist_items?.length || 0} tiêu chuẩn
                              </span>
                            </div>"""

code = code.replace("""                            <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                              <FileCheck2 className="w-4 h-4 text-blue-600" />
                              <span>Checklist: {td.device_name} ({td.checklist_title || 'Chưa gắn mẫu'})</span>
                            </h4>
                            <span className="text-xs text-slate-500 font-medium">
                              {td.checklist_items?.length || 0} tiêu chuẩn
                            </span>""", print_button_multi)

# Add Print button in legacy loop
print_button_legacy = """                        <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                          <FileCheck2 className="w-4 h-4 text-blue-600" />
                          <span>Phiếu Checklist Kiểm tra ({selectedTask.checklist_title})</span>
                        </h4>
                        <div className="flex items-center space-x-3">
                          <button
                            type="button"
                            onClick={() => setPrintDeviceChecklist(selectedTask)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold text-xs rounded-lg transition"
                          >
                            <Printer className="w-4 h-4" />
                            <span>In Biên bản</span>
                          </button>
                          <span className="text-xs text-slate-500 font-medium">
                            {selectedTask.checklist_items.length} tiêu chuẩn
                          </span>
                        </div>"""

code = code.replace("""                        <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                          <FileCheck2 className="w-4 h-4 text-blue-600" />
                          <span>Phiếu Checklist Kiểm tra ({selectedTask.checklist_title})</span>
                        </h4>
                        <span className="text-xs text-slate-500 font-medium">
                          {selectedTask.checklist_items.length} tiêu chuẩn
                        </span>""", print_button_legacy)

# Render Print Modal
render_modal = """
      {printDeviceChecklist && selectedTask && (
        <PrintChecklistModal
          task={selectedTask}
          deviceChecklist={printDeviceChecklist}
          itemResults={itemResults}
          onClose={() => setPrintDeviceChecklist(null)}
        />
      )}
"""
code = code.replace("      {/* Detail Modal */}", render_modal + "      {/* Detail Modal */}")

# Make sure Printer is imported from lucide-react
# We already imported Printer? Let's check... if not, we can regex it.
if "Printer" not in code.split("} from 'lucide-react';")[0]:
    code = code.replace("} from 'lucide-react';", "  Printer,\n} from 'lucide-react';")


with open('src/pages/TasksPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
