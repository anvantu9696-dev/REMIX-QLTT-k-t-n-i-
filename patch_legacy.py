import re

with open('src/pages/TasksPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# I will find all instances of `[item.id]` inside the legacy map loop and change them to `[\`legacy_${item.id}\`]`
# Wait, let's just replace `[item.id]` with `[\`legacy_${item.id}\`]` inside the specific string segment.
# I will find the part after `selectedTask.checklist_items.map((item: any) => {` which is the legacy block, and do the replacement.

start_str = "                        {selectedTask.checklist_items.map((item: any) => {"
idx = code.find(start_str)
if idx != -1:
    end_idx = code.find("                      </div>", idx)
    legacy_segment = code[idx:end_idx]
    legacy_segment_patched = legacy_segment.replace('[item.id]', '[resKeyLegacy]')
    # also add const resKeyLegacy = `legacy_${item.id}`;
    legacy_segment_patched = legacy_segment_patched.replace('const resVal', 'const resKeyLegacy = `legacy_${item.id}`;\n                          const resVal')
    code = code[:idx] + legacy_segment_patched + code[end_idx:]
    with open('src/pages/TasksPage.tsx', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Patched!")
else:
    print("Not found")
