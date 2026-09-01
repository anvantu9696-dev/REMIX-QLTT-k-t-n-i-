import re

with open('src/pages/TasksPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Replace type of itemResults
code = code.replace(
    'const [itemResults, setItemResults] = useState<Record<number, { result_value: string; is_pass: boolean; notes: string }>>({});',
    'const [itemResults, setItemResults] = useState<Record<string, { result_value: string; is_pass: boolean; notes: string }>>({});'
)

# 2. Update initialResults inside openTaskDetail
old_initial = """        // Initialize checklist item results state
        const initialResults: Record<number, { result_value: string; is_pass: boolean; notes: string }> = {};
        if (res.data.checklist_items) {
          res.data.checklist_items.forEach((item: any) => {
            const existingRes = res.data.results?.find((r: any) => r.checklist_item_id === item.id);
            initialResults[item.id] = {
              result_value: existingRes?.result_value || '',
              is_pass: existingRes ? Boolean(existingRes.is_pass) : true,
              notes: existingRes?.notes || ''
            };
          });
        }
        setItemResults(initialResults);"""

new_initial = """        // Initialize checklist item results state
        const initialResults: Record<string, { result_value: string; is_pass: boolean; notes: string }> = {};
        
        if (res.data.task_devices && res.data.task_devices.length > 0) {
          res.data.task_devices.forEach((td: any) => {
            if (td.checklist_items) {
              td.checklist_items.forEach((item: any) => {
                const existingRes = td.results?.find((r: any) => r.checklist_item_id === item.id);
                initialResults[`${td.device_id}_${item.id}`] = {
                  result_value: existingRes?.result_value || '',
                  is_pass: existingRes ? Boolean(existingRes.is_pass) : true,
                  notes: existingRes?.notes || ''
                };
              });
            }
          });
        }
        
        if (res.data.checklist_items) {
          res.data.checklist_items.forEach((item: any) => {
            const existingRes = res.data.results?.find((r: any) => r.checklist_item_id === item.id && !r.device_id);
            initialResults[`legacy_${item.id}`] = {
              result_value: existingRes?.result_value || '',
              is_pass: existingRes ? Boolean(existingRes.is_pass) : true,
              notes: existingRes?.notes || ''
            };
          });
        }
        setItemResults(initialResults);"""

code = code.replace(old_initial, new_initial)

# 3. Update formattedResults inside handleSubmitChecklistResults
old_submit = """      const formattedResults = Object.entries(itemResults).map(([itemIdStr, val]: [string, { result_value: string; is_pass: boolean; notes: string }]) => {
        const itemObj = selectedTask.checklist_items?.find(i => String(i.id) === String(itemIdStr));
        return {
          checklist_item_id: itemIdStr,
          item_content: itemObj?.content || '',
          standard_value: itemObj?.standard_value || '',
          unit: itemObj?.unit || '',
          result_value: val.result_value,
          is_pass: val.is_pass,
          notes: val.notes
        };
      });"""

new_submit = """      const formattedResults = Object.entries(itemResults).map(([key, val]: [string, any]) => {
        const [devIdStr, itemIdStr] = key.split('_');
        let itemObj;
        if (devIdStr === 'legacy') {
           itemObj = selectedTask.checklist_items?.find((i: any) => String(i.id) === String(itemIdStr));
        } else {
           const td = selectedTask.task_devices?.find((t: any) => String(t.device_id) === String(devIdStr));
           itemObj = td?.checklist_items?.find((i: any) => String(i.id) === String(itemIdStr));
        }
        return {
          device_id: devIdStr === 'legacy' ? undefined : parseInt(devIdStr, 10),
          checklist_item_id: itemIdStr,
          item_content: itemObj?.content || '',
          standard_value: itemObj?.standard_value || '',
          unit: itemObj?.unit || '',
          result_value: val.result_value,
          is_pass: val.is_pass,
          notes: val.notes
        };
      });"""

code = code.replace(old_submit, new_submit)

with open('src/pages/TasksPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

