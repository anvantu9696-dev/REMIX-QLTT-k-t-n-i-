import re

with open('src/components/PrintChecklistModal.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_code = """                const resKey = `${deviceChecklist.device_id}_${item.id}`;
                const resVal = itemResults[resKey] || { result_value: '', is_pass: true, notes: '' };"""

new_code = """                const resKey = deviceChecklist.device_id ? `${deviceChecklist.device_id}_${item.id}` : `legacy_${item.id}`;
                const resVal = itemResults[resKey] || { result_value: '', is_pass: true, notes: '' };"""

code = code.replace(old_code, new_code)

with open('src/components/PrintChecklistModal.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
